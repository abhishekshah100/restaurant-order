import type { KitchenStep } from '@/api/contracts';
import type { Branch, OrderMode } from '@/types/branch';
import type { CategoryId } from '@/types/menu';
import type {
  KitchenMarks,
  Order,
  OrderEvent,
  OrderItem,
  OrderRound,
  OrderStatus,
} from '@/types/order';
import type { ModeFilter } from './adminOrders';

/*
 * The kitchen board's logic, pure: every round of today's orders (GET
 * /admin/branches/:branchId/orders) as a ticket, the lane it's in (new, cooking, ready), how
 * late it is, the filters, the all-day counts and the board's numbers. No data of its own: the
 * kitchen reads the same orders guests and waiters place.
 */

/** Where a round is for the kitchen. */
export type KitchenStage = 'new' | 'cooking' | 'ready' | 'done' | 'cancelled';

/** The board's columns, in the order food moves through them. */
export const KITCHEN_LANES = ['new', 'cooking', 'ready'] as const;
export type KitchenLane = (typeof KITCHEN_LANES)[number];

/**
 * The kitchen's stage for an order (or round) status. Delivery is done once it's with the
 * rider; dine-in and takeaway wait in Ready until they're served or collected.
 */
export function kitchenStage(status: OrderStatus): KitchenStage {
  switch (status) {
    case 'received':
      return 'new';
    case 'preparing':
      return 'cooking';
    case 'ready':
      return 'ready';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'done';
  }
}

export const isOnBoard = (stage: KitchenStage): stage is KitchenLane =>
  (KITCHEN_LANES as readonly string[]).includes(stage);

/** The next step the kitchen can mark on a round in a lane (none once it's ready). */
export const nextKitchenStep = (stage: KitchenStage): KitchenStep | null =>
  stage === 'new' ? 'preparing' : stage === 'cooking' ? 'ready' : null;

/** The status a round has once the kitchen marks a step. */
export const statusAfter = (step: KitchenStep, mode: OrderMode): OrderStatus =>
  step === 'preparing' ? 'preparing' : mode === 'delivery' ? 'outForDelivery' : 'ready';

/**
 * How long the kitchen has for a dine-in round, until branches carry their own: the time the
 * mock kitchen takes (api/mock/kitchen), within the "18–22 min" guests are told.
 */
export const DINE_IN_TARGET_MINUTES = 18;

/** A ticket is "due soon" in the last part of its time: this share, and at least the minutes. */
const SOON_SHARE = 0.25;
const SOON_MIN_MINUTES = 3;

/** Food waiting at the pass longer than this is going cold. */
export const READY_WAIT_MINUTES = 5;

const MINUTE_MS = 60_000;

/** One round of an order, as the kitchen cooks it. */
export interface KitchenTicket {
  /** Unique on the board: "A105:2". */
  key: string;
  orderId: string;
  /** The round's number (1 for an order of one round). */
  round: number;
  /** Rounds on the order, not cancelled (the ticket says "Round 2 of 3" when more than one). */
  roundCount: number;
  mode: OrderMode;
  table?: number;
  customerName: string;
  /** Ordered on the guest's phone, or taken by a waiter (no guest session). */
  source: 'guest' | 'staff';
  /** The timeline's note when it was placed: "Taken by Abhishek". Staff orders only. */
  takenBy?: string;
  /** ISO. */
  placedAt: string;
  status: OrderStatus;
  stage: KitchenStage;
  items: OrderItem[];
  /** Items, counted by quantity. */
  itemCount: number;
  kitchenNote?: string;
  /** Takeaway: ISO, when the guest collects it. */
  pickupAt?: string;
  /** Takeaway: chosen "as soon as possible" rather than a slot. */
  asap?: boolean;
  /** Delivery: the area it goes to. */
  deliveryArea?: string;
  /** ISO: when it should be ready (see ticketDueAt). */
  dueAt: string;
  /** ISO: when it was ready (handed to the rider, for delivery), once it is. */
  readyAt?: string;
  /** ISO: when it was served or collected, once it is. */
  doneAt?: string;
  /** ISO: when it was cancelled, if it was. */
  cancelledAt?: string;
  kitchen?: KitchenMarks;
  timeline: OrderEvent[];
}

/** The rounds of an order; an order without rounds (the drawn history) is one round. */
function roundsOf(order: Order): OrderRound[] {
  return (
    order.rounds ?? [
      {
        number: 1,
        placedAt: order.placedAt,
        status: order.status,
        items: order.items,
        timeline: order.timeline,
        kitchenNote: order.kitchenNote,
        changeableUntil: order.placedAt,
        servedAt: order.servedAt,
        kitchen: order.kitchen,
      },
    ]
  );
}

/** ISO: `minutes` after `iso`. */
const plusMinutes = (iso: string, minutes: number) =>
  new Date(Date.parse(iso) + minutes * MINUTE_MS).toISOString();

/**
 * When a round should be ready: a takeaway at its pickup time, a delivery within the branch's
 * prep time (so the rider can leave), dine-in within DINE_IN_TARGET_MINUTES.
 */
export function ticketDueAt(
  order: Pick<Order, 'mode' | 'pickup'>,
  placedAt: string,
  branch: Pick<Branch, 'modes'>,
): string {
  if (order.mode === 'takeaway' && order.pickup) return order.pickup.at;
  if (order.mode === 'delivery') return plusMinutes(placedAt, branch.modes.delivery.prepMinutes);
  return plusMinutes(placedAt, DINE_IN_TARGET_MINUTES);
}

/** ISO of the first event in `statuses` that says when it happened. */
const eventAt = (timeline: readonly OrderEvent[], statuses: readonly OrderStatus[]) =>
  timeline.find((e) => statuses.includes(e.status) && e.at)?.at;

const quantity = (items: readonly OrderItem[]) => items.reduce((n, item) => n + item.quantity, 0);

/** Every round of the orders as a ticket, oldest first. */
export function kitchenTickets(
  orders: readonly Order[],
  branch: Pick<Branch, 'modes'>,
): KitchenTicket[] {
  const tickets = orders.flatMap((order) => {
    const rounds = roundsOf(order);
    const roundCount = rounds.filter((r) => r.status !== 'cancelled').length;
    // A waiter's order has no guest session; the drawn history has none either, but marks the
    // guest's own visits ("you").
    const staff = !order.sessionId && order.placedBy !== 'you';
    return rounds.map((round): KitchenTicket => {
      // A cancelled order cancels every round still open.
      const status = order.status === 'cancelled' ? 'cancelled' : round.status;
      const { timeline, kitchen } = round;
      return {
        key: `${order.id}:${round.number}`,
        orderId: order.id,
        round: round.number,
        roundCount,
        mode: order.mode,
        ...(order.table !== undefined ? { table: order.table } : {}),
        customerName: order.customerName,
        source: staff ? 'staff' : 'guest',
        ...(staff && timeline[0]?.note ? { takenBy: timeline[0].note } : {}),
        placedAt: round.placedAt,
        status,
        stage: kitchenStage(status),
        items: round.items,
        itemCount: quantity(round.items),
        ...(round.kitchenNote ? { kitchenNote: round.kitchenNote } : {}),
        ...(order.pickup ? { pickupAt: order.pickup.at, asap: order.pickup.asap } : {}),
        ...(order.delivery ? { deliveryArea: order.delivery.address.area } : {}),
        dueAt: ticketDueAt(order, round.placedAt, branch),
        readyAt: kitchen?.ready?.at ?? eventAt(timeline, ['ready', 'outForDelivery']),
        doneAt: round.servedAt ?? eventAt(timeline, ['served', 'pickedUp', 'delivered']),
        cancelledAt: eventAt(timeline, ['cancelled']),
        ...(kitchen ? { kitchen } : {}),
        timeline,
      };
    });
  });
  return tickets.sort((a, b) => a.placedAt.localeCompare(b.placedAt));
}

/** How a ticket is doing against its time. */
export type TicketUrgency = 'onTime' | 'soon' | 'late';

/**
 * New and cooking tickets: late past their due time, due soon in its last stretch. Ready ones:
 * late once the food has waited at the pass longer than READY_WAIT_MINUTES.
 */
export function ticketUrgency(ticket: KitchenTicket, now: Date): TicketUrgency {
  const t = now.getTime();
  if (ticket.stage === 'ready') {
    const since = ticket.readyAt ? Date.parse(ticket.readyAt) : t;
    return t - since > READY_WAIT_MINUTES * MINUTE_MS ? 'late' : 'onTime';
  }
  const due = Date.parse(ticket.dueAt);
  if (t > due) return 'late';
  const span = due - Date.parse(ticket.placedAt);
  const soon = Math.max(SOON_MIN_MINUTES * MINUTE_MS, span * SOON_SHARE);
  return due - t <= soon ? 'soon' : 'onTime';
}

/** Minutes left until the ticket is due (negative once it's late). */
export const minutesLeft = (ticket: KitchenTicket, now: Date) =>
  Math.ceil((Date.parse(ticket.dueAt) - now.getTime()) / MINUTE_MS);

/** ISO: when the kitchen should start a takeaway to have it ready for its slot. */
export const ticketStartBy = (ticket: KitchenTicket, branch: Pick<Branch, 'modes'>) =>
  plusMinutes(ticket.dueAt, -branch.modes.takeaway.prepMinutes);

/** A takeaway for a later slot that the kitchen needn't start yet. */
export function isScheduled(
  ticket: KitchenTicket,
  now: Date,
  branch: Pick<Branch, 'modes'>,
): boolean {
  if (ticket.stage !== 'new' || ticket.mode !== 'takeaway' || ticket.asap) return false;
  return now.getTime() < Date.parse(ticketStartBy(ticket, branch));
}

/* ---------- Filters ---------- */

/** "All stations" or a menu category (each category is a station: starters, mains, pizza…). */
export type StationFilter = 'all' | CategoryId;

export interface TicketFilters {
  mode: ModeFilter;
  station: StationFilter;
  query: string;
}

/** The menu category of a dish, when it's still on the menu. */
export type CategoryOf = (dishSlug: string) => CategoryId | undefined;

/** The ticket's items cooked at the station (every item for All stations). */
export const stationItems = (
  ticket: Pick<KitchenTicket, 'items'>,
  station: StationFilter,
  categoryOf: CategoryOf,
) =>
  station === 'all'
    ? ticket.items
    : ticket.items.filter((item) => categoryOf(item.dishSlug) === station);

/** The order number ("A105" or "105"), the guest's name, the table number or a dish. */
function matchesQuery(ticket: KitchenTicket, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    ticket.orderId.toLowerCase().includes(q) ||
    ticket.customerName.toLowerCase().includes(q) ||
    (ticket.table !== undefined && String(ticket.table) === q) ||
    ticket.items.some((item) => item.name.toLowerCase().includes(q))
  );
}

const inMode = (ticket: KitchenTicket, mode: ModeFilter) => mode === 'all' || ticket.mode === mode;

/** The tickets on the board (new, cooking, ready) within the filters, oldest first. */
export function boardTickets(
  tickets: readonly KitchenTicket[],
  { mode, station, query }: TicketFilters,
  categoryOf: CategoryOf,
): KitchenTicket[] {
  return tickets.filter(
    (ticket) =>
      isOnBoard(ticket.stage) &&
      inMode(ticket, mode) &&
      matchesQuery(ticket, query) &&
      stationItems(ticket, station, categoryOf).length > 0,
  );
}

/** Tickets in each lane. */
export function laneTickets(
  tickets: readonly KitchenTicket[],
): Record<KitchenLane, KitchenTicket[]> {
  return {
    new: tickets.filter((t) => t.stage === 'new'),
    cooking: tickets.filter((t) => t.stage === 'cooking'),
    ready: tickets.filter((t) => t.stage === 'ready'),
  };
}

/** Board tickets of each order type, within the station and search. */
export function modeCounts(
  tickets: readonly KitchenTicket[],
  filters: Omit<TicketFilters, 'mode'>,
  categoryOf: CategoryOf,
  modes: readonly ModeFilter[],
): Record<ModeFilter, number> {
  const counts = { all: 0, dineIn: 0, takeaway: 0, delivery: 0 };
  for (const mode of modes) {
    counts[mode] = boardTickets(tickets, { ...filters, mode }, categoryOf).length;
  }
  return counts;
}

/* ---------- All day: what's still to cook ---------- */

/** One dish (and size) still to cook across the new and cooking tickets. */
export interface AllDayLine {
  key: string;
  dishSlug: string;
  name: string;
  variant?: string;
  veg: boolean;
  quantity: number;
  /** Tickets it's on. */
  tickets: number;
}

export interface AllDayGroup {
  /** The menu category (station); undefined for dishes no longer on the menu. */
  categoryId: CategoryId | undefined;
  lines: AllDayLine[];
  quantity: number;
}

/**
 * The "all day" counts: every dish still to cook (new and cooking tickets), added up by dish and
 * size, grouped by station in the menu's category order, most first.
 */
export function allDay(
  tickets: readonly KitchenTicket[],
  categoryOf: CategoryOf,
  categoryOrder: readonly CategoryId[],
): AllDayGroup[] {
  const lines = new Map<string, AllDayLine & { categoryId: CategoryId | undefined }>();
  for (const ticket of tickets) {
    if (ticket.stage !== 'new' && ticket.stage !== 'cooking') continue;
    for (const item of ticket.items) {
      const key = `${item.dishSlug}|${item.variant ?? ''}`;
      const line = lines.get(key);
      if (line) {
        line.quantity += item.quantity;
        line.tickets += 1;
      } else {
        lines.set(key, {
          key,
          dishSlug: item.dishSlug,
          name: item.name,
          ...(item.variant ? { variant: item.variant } : {}),
          veg: item.veg,
          quantity: item.quantity,
          tickets: 1,
          categoryId: categoryOf(item.dishSlug),
        });
      }
    }
  }
  const rank = (id: CategoryId | undefined) => {
    const i = id === undefined ? -1 : categoryOrder.indexOf(id);
    return i === -1 ? categoryOrder.length : i;
  };
  const groups = new Map<CategoryId | undefined, AllDayGroup>();
  for (const { categoryId, ...line } of lines.values()) {
    const group = groups.get(categoryId) ?? { categoryId, lines: [], quantity: 0 };
    group.lines.push(line);
    group.quantity += line.quantity;
    groups.set(categoryId, group);
  }
  return [...groups.values()]
    .map((g) => ({
      ...g,
      lines: g.lines.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => rank(a.categoryId) - rank(b.categoryId));
}

/* ---------- The board's numbers ---------- */

export interface BoardStats {
  new: number;
  cooking: number;
  ready: number;
  /** New and cooking tickets past their due time. */
  late: number;
  /** Items still to cook. */
  itemsToCook: number;
  /** Minutes from order to ready, on average, over today's tickets the kitchen finished. */
  averageMinutes: number | null;
}

/** Minutes from placing to ready, for tickets that have been ready. */
export const ticketMinutes = (ticket: KitchenTicket): number | null =>
  ticket.readyAt
    ? Math.max(
        0,
        Math.round((Date.parse(ticket.readyAt) - Date.parse(ticket.placedAt)) / MINUTE_MS),
      )
    : null;

/** The average of the numbers, rounded; null without any. */
export const average = (values: readonly number[]): number | null =>
  values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

export function boardStats(tickets: readonly KitchenTicket[], now: Date): BoardStats {
  const open = tickets.filter((t) => t.stage === 'new' || t.stage === 'cooking');
  const finished = tickets
    .filter((t) => t.stage === 'ready' || t.stage === 'done')
    .map(ticketMinutes)
    .filter((m): m is number => m !== null);
  return {
    new: tickets.filter((t) => t.stage === 'new').length,
    cooking: tickets.filter((t) => t.stage === 'cooking').length,
    ready: tickets.filter((t) => t.stage === 'ready').length,
    late: open.filter((t) => ticketUrgency(t, now) === 'late').length,
    itemsToCook: open.reduce((n, t) => n + t.itemCount, 0),
    averageMinutes: average(finished),
  };
}

/* ---------- Optimistic update ---------- */

/**
 * The orders with one round moved on by the kitchen, as the board shows it before the server
 * answers (the poll that follows brings the server's version).
 */
export function withKitchenStep(
  orders: readonly Order[],
  orderId: string,
  round: number,
  step: KitchenStep,
): Order[] {
  return orders.map((order) => {
    if (order.id !== orderId) return order;
    const status = statusAfter(step, order.mode);
    if (!order.rounds) return round === 1 ? { ...order, status } : order;
    const rounds = order.rounds.map((r) => (r.number === round ? { ...r, status } : r));
    const latest = rounds.filter((r) => r.status !== 'cancelled').at(-1);
    return { ...order, rounds, status: latest?.number === round ? status : order.status };
  });
}

/** A running timer as "4:05" (minutes and seconds), or "1:04:05" from an hour. */
export function elapsedClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const [h, m, s] = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}
