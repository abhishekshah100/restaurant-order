import type { CartLine } from '@/types/cart';
import type {
  ItemStatus,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@/types/order';
import {
  describeInstructions,
  describeOptions,
  shortVariant,
  type CartLineLabels,
} from './cartLine';
import type { MenuCatalog } from './menu';
import { calculateBill, type Bill } from './pricing';
import { formatTime } from './format';
import { MOCK_TRANSACTION_REF } from './constants';

/** First unused id from the pre-rendered pool (GET /orders › newOrderIds), or null when it's used up. */
export function nextOrderId(placed: readonly Order[], pool: readonly string[]): string | null {
  const used = new Set(placed.map((o) => o.id));
  return pool.find((id) => !used.has(id)) ?? null;
}

function toOrderItems(
  lines: readonly CartLine[],
  menu: MenuCatalog,
  lineLabels: CartLineLabels,
): OrderItem[] {
  return lines.flatMap((line) => {
    const dish = menu.getDish(line.dishSlug);
    if (!dish) return [];
    const options = describeOptions(dish, line, lineLabels);
    const instructions = describeInstructions(line);
    return [
      {
        dishSlug: dish.slug,
        name: dish.name,
        veg: dish.veg,
        quantity: line.quantity,
        variant: shortVariant(dish, line),
        details: options ? [options] : [],
        note: instructions?.replace(/^“|”$/g, ''),
        unitPrice: line.unitPrice,
        status: 'queued',
      },
    ];
  });
}

/** Words a new order is written with (from the orders content). */
export interface OrderLabels {
  /** Timeline note when paid online, e.g. "Paid online". */
  paidOnline: string;
  /** Timeline note for a counter order, e.g. "Pay at counter". */
  payAtCounter: string;
  /** Payment method shown for an online payment, e.g. "UPI". */
  upi: string;
  /** Words for the items' option lines (see lib/cartLine). */
  lineLabels: CartLineLabels;
  /** Kitchen estimate stored on the order: GET /restaurant › prepTime. */
  estimate: string;
}

export interface PlaceOrderInput {
  id: string;
  lines: readonly CartLine[];
  table: number;
  /** The guest session placing it. */
  sessionId: string;
  customerName: string;
  method: PaymentMethod;
  kitchenNote: string;
  now?: Date;
}

/** The order for a cart, or null when there's nothing to order. */
export function buildOrder(
  input: PlaceOrderInput,
  menu: MenuCatalog,
  labels: OrderLabels,
): Order | null {
  const items = toOrderItems(input.lines, menu, labels.lineLabels);
  if (items.length === 0) return null;
  const now = input.now ?? new Date();
  const bill = calculateBill(input.lines);
  const time = formatTime(now);
  return {
    id: input.id,
    table: input.table,
    customerName: input.customerName,
    placedBy: 'you',
    sessionId: input.sessionId,
    placedAt: now.toISOString(),
    status: 'received',
    items,
    itemTotal: bill.itemTotal,
    total: bill.total,
    payment:
      input.method === 'online'
        ? {
            method: 'online',
            status: 'paid',
            detail: labels.upi,
            transactionRef: MOCK_TRANSACTION_REF,
          }
        : { method: 'counter', status: 'unpaid' },
    timeline: [
      {
        status: 'received',
        time,
        note: input.method === 'online' ? labels.paidOnline : labels.payAtCounter,
      },
    ],
    estimate: labels.estimate,
    kitchenNote: input.kitchenNote || undefined,
  };
}

/** An order placed on this device, or one from the order history. */
export function findOrder(
  id: string,
  placed: readonly Order[],
  history: readonly Order[],
): Order | undefined {
  return placed.find((o) => o.id === id) ?? history.find((o) => o.id === id);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const isOptionalString = (v: unknown) => v === undefined || typeof v === 'string';

function isOrderItem(v: unknown): v is OrderItem {
  return (
    isObject(v) &&
    typeof v.dishSlug === 'string' &&
    typeof v.name === 'string' &&
    typeof v.veg === 'boolean' &&
    typeof v.quantity === 'number' &&
    typeof v.unitPrice === 'number' &&
    Array.isArray(v.details) &&
    v.details.every((d) => typeof d === 'string') &&
    isOptionalString(v.variant) &&
    isOptionalString(v.note)
  );
}

/** Runtime guard for orders saved on this device. */
export function isOrder(v: unknown): v is Order {
  if (!isObject(v)) return false;
  const { payment } = v;
  return (
    typeof v.id === 'string' &&
    typeof v.table === 'number' &&
    typeof v.customerName === 'string' &&
    isOptionalString(v.sessionId) &&
    typeof v.placedAt === 'string' &&
    typeof v.status === 'string' &&
    typeof v.itemTotal === 'number' &&
    typeof v.total === 'number' &&
    Array.isArray(v.items) &&
    v.items.every(isOrderItem) &&
    Array.isArray(v.timeline) &&
    v.timeline.every(
      (e) => isObject(e) && typeof e.status === 'string' && typeof e.time === 'string',
    ) &&
    isObject(payment) &&
    (payment.method === 'online' || payment.method === 'counter') &&
    typeof payment.status === 'string' &&
    isOptionalString(v.estimate) &&
    isOptionalString(v.kitchenNote)
  );
}

/** Payment details recorded when a guest settles unpaid orders online, e.g. `{ detail: "UPI" }`. */
export type OnlinePayment = Pick<Order['payment'], 'detail' | 'transactionRef'>;

/**
 * Marks the listed orders as paid online. Only unpaid orders change, so paying twice (a double
 * tap, or another tab that already paid) changes nothing. Returns the new list and the orders
 * that were marked, in list order.
 */
export function markOrdersPaid(
  placed: readonly Order[],
  ids: readonly string[],
  payment: OnlinePayment,
): { orders: Order[]; marked: Order[] } {
  const wanted = new Set(ids);
  const marked: Order[] = [];
  const orders = placed.map((order) => {
    if (!wanted.has(order.id) || !isUnpaid(order)) return order;
    const paid: Order = { ...order, payment: { method: 'online', status: 'paid', ...payment } };
    marked.push(paid);
    return paid;
  });
  return { orders, marked };
}

/* ---------- Order lists ---------- */

/**
 * Whether the current guest session placed the order: the basis of "Just my orders" and
 * separate bills at a shared table. Only orders stamped with this session count — orders
 * from other guests, earlier visits or the drawn history (no session) belong to the table.
 */
export const isOwnOrder = (order: Pick<Order, 'sessionId'>, sessionId: string | undefined) =>
  Boolean(sessionId) && order.sessionId === sessionId;

/** Every known order: placed on this device plus the order history, without duplicates. */
export function allOrders(placed: readonly Order[], history: readonly Order[]): Order[] {
  const ids = new Set(placed.map((o) => o.id));
  return [...placed, ...history.filter((o) => !ids.has(o.id))];
}

/**
 * Orders this guest placed: from this device (earlier sessions too: it's the same person)
 * plus their order history, newest first.
 */
export function myOrders(placed: readonly Order[], history: readonly Order[]): Order[] {
  const ids = new Set(placed.map((o) => o.id));
  const own = history.filter((o) => o.placedBy === 'you' && !ids.has(o.id));
  return [...placed, ...own].sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt));
}

const istDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
const dateParts = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

/** "12 Sep 2026" (en-GB would give "Sept"). */
function formatDate(iso: string): string {
  const part = Object.fromEntries(
    dateParts.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return `${part.day} ${part.month} ${part.year}`;
}

/** Placed on the same restaurant day (IST) as `now`. */
export const isToday = (iso: string, now: Date) =>
  istDay.format(new Date(iso)) === istDay.format(now);

/** `today` (the word, e.g. "Today") or "12 Sep 2026" (restaurant time). */
export const formatOrderDay = (iso: string, now: Date, today: string) =>
  isToday(iso, now) ? today : formatDate(iso);

/** "7:42 PM" today, "12 Sep 2026, 8:18 PM" on an earlier visit. */
export function formatPlaced(iso: string, now: Date): string {
  const time = formatTime(iso);
  return isToday(iso, now) ? time : `${formatDate(iso)}, ${time}`;
}

/** Splits orders into this visit (today) and earlier visits, keeping their order. */
export function groupByVisit(orders: readonly Order[], now: Date) {
  return {
    today: orders.filter((o) => isToday(o.placedAt, now)),
    earlier: orders.filter((o) => !isToday(o.placedAt, now)),
  };
}

/** What the guest has spent: every order except cancelled ones. */
export const spentTotal = (orders: readonly Order[]) =>
  orders.reduce((sum, o) => (o.status === 'cancelled' ? sum : sum + o.total), 0);

/* ---------- Display helpers ---------- */

/** Content key (orders › payment) of an order's payment status. */
export type PaymentLabel =
  'paidOnline' | 'paidAtCounter' | 'paymentPending' | 'payAtCounter' | 'refunded' | 'refundStarted';

const PAYMENT_LABEL: Record<PaymentStatus, Record<PaymentMethod, PaymentLabel>> = {
  paid: { online: 'paidOnline', counter: 'paidAtCounter' },
  unpaid: { online: 'paymentPending', counter: 'payAtCounter' },
  refunded: { online: 'refunded', counter: 'refunded' },
  'refund-started': { online: 'refundStarted', counter: 'refundStarted' },
};

/** Key of "Paid online", "Pay at counter", "Refunded"… */
export const paymentLabel = ({ payment }: Pick<Order, 'payment'>): PaymentLabel =>
  PAYMENT_LABEL[payment.status][payment.method];

/** True while the guest still owes money for the order (pay-at-counter orders). */
export const isUnpaid = ({ payment }: Pick<Order, 'payment'>) => payment.status === 'unpaid';

/** Payment as a status on the tracking timeline: key of "Paid online", "Paying at the counter"… */
export const paymentProgress = (order: Pick<Order, 'payment'>): PaymentLabel | 'payingAtCounter' =>
  isUnpaid(order) && order.payment.method === 'counter' ? 'payingAtCounter' : paymentLabel(order);

/** Content key (orders › totals): "Total paid" once paid, "To pay at counter" while a counter order is unpaid, otherwise "Total". */
export function totalLabel({
  payment,
}: Pick<Order, 'payment'>): 'totalPaid' | 'toPayAtCounter' | 'total' {
  if (payment.status === 'paid') return 'totalPaid';
  if (payment.status === 'unpaid' && payment.method === 'counter') return 'toPayAtCounter';
  return 'total';
}

/** The bill for an order, from its line prices. */
export const orderBill = (order: Pick<Order, 'items'>): Bill => calculateBill(order.items);

/** "1 × Paneer Tikka (Full)" — the size is named only when it isn't the default one. */
export function itemLabel(item: OrderItem, menu: MenuCatalog): string {
  const defaultVariant = menu.getDish(item.dishSlug)?.variants?.[0]?.name.split(' · ')[0];
  const variant = item.variant && item.variant !== defaultVariant ? ` (${item.variant})` : '';
  return `${item.quantity} × ${item.name}${variant}`;
}

/** An item's own status, or one implied by the order's when the kitchen hasn't set it. */
export function itemStatus(item: OrderItem, order: Pick<Order, 'status'>): ItemStatus {
  if (item.status) return item.status;
  if (order.status === 'received' || order.status === 'cancelled') return 'queued';
  return order.status;
}

/** The order-status colour an item status is drawn in ("In queue" uses the neutral pill). */
export const itemPillStatus = (status: ItemStatus): OrderStatus =>
  status === 'queued' ? 'received' : status;

/* ---------- Live tracking ---------- */

const TRACK_STEPS = ['received', 'preparing', 'ready', 'served'] as const;
export type TrackStep = (typeof TRACK_STEPS)[number];

/** Simulated kitchen for orders placed on this device: minutes after placing each stage starts. */
const STAGE_MINUTES: Record<TrackStep, number> = {
  received: 0,
  preparing: 2,
  ready: 18,
  served: 22,
};

/** How often the tracking screen refreshes. */
export const TRACK_REFRESH_MS = 30_000;

const MINUTE = 60_000;

const stageAt = (placedAt: number, step: TrackStep) => placedAt + STAGE_MINUTES[step] * MINUTE;

/** Served and cancelled orders don't change any more. */
export const isFinished = ({ status }: Pick<Order, 'status'>) =>
  status === 'served' || status === 'cancelled';

/** Items start one after another during preparation and are ready in turn. */
function simulatedItemStatus(index: number, count: number, placedAt: number, now: number) {
  const start = stageAt(placedAt, 'preparing');
  const span = stageAt(placedAt, 'ready') - start;
  if (now >= stageAt(placedAt, 'served')) return 'served';
  if (now >= start + (span * (index + 1)) / count) return 'ready';
  if (now >= start + (span * index) / (2 * count)) return 'preparing';
  return 'queued';
}

/**
 * Where an order placed on this device has got to at `now`: received → preparing →
 * ready → served over the prep window, with item statuses, ETA and timeline.
 * Deterministic for a given `now`; cancelled orders are returned unchanged.
 */
export function simulateOrder(order: Order, now: Date): Order {
  if (order.status === 'cancelled') return order;
  const placedAt = Date.parse(order.placedAt);
  const t = now.getTime();
  const reached = TRACK_STEPS.filter((step, i) => i === 0 || t >= stageAt(placedAt, step));
  const status = reached[reached.length - 1];
  const readyAt = stageAt(placedAt, 'ready');
  const making = status === 'received' || status === 'preparing';
  return {
    ...order,
    status,
    timeline: reached.map(
      (step) =>
        order.timeline.find((e) => e.status === step) ?? {
          status: step,
          time: formatTime(new Date(stageAt(placedAt, step))),
        },
    ),
    items: order.items.map((item, i) => ({
      ...item,
      status: simulatedItemStatus(i, order.items.length, placedAt, t),
    })),
    etaMinutes: making ? Math.max(1, Math.ceil((readyAt - t) / MINUTE)) : undefined,
    readyBy: formatTime(new Date(readyAt)),
  };
}

export interface TrackStepView {
  step: TrackStep;
  /** `next`: the step the kitchen starts next, while the order is only received. */
  state: 'done' | 'current' | 'next' | 'upcoming';
  /** Display time it happened, e.g. "7:46 PM". */
  time?: string;
  note?: string;
}

/**
 * The four progress steps of an active or served order. "Received" is a milestone, not
 * work in progress: once received it's done, and Preparing is shown as up next.
 */
export function trackSteps(order: Pick<Order, 'status' | 'timeline'>): TrackStepView[] {
  const current = TRACK_STEPS.indexOf(order.status as TrackStep);
  return TRACK_STEPS.map((step, i) => {
    const event = order.timeline.find((e) => e.status === step);
    let state: TrackStepView['state'] = 'upcoming';
    if (i < current || order.status === 'served' || step === 'received') state = 'done';
    else if (i === current) state = 'current';
    else if (order.status === 'received' && step === 'preparing') state = 'next';
    return { step, state, time: event?.time, note: event?.note };
  });
}
