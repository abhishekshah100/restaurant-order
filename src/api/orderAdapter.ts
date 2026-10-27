import { cartLineLabels } from '@/hooks/useCartLineLabels';
import { joinBranch } from '@/lib/branchParts';
import { describeInstructions, describeOptions } from '@/lib/cartLine';
import { createClock, type Clock } from '@/lib/clock';
import { createMenuCatalog, type MenuCatalog } from '@/lib/menu';
import { createMoney } from '@/lib/money';
import { finalStep } from '@/lib/orders';
import type { CartLineLabels } from '@/lib/cartLine';
import type { Branch, OrderMode } from '@/types/branch';
import type { LineConfig } from '@/types/cart';
import type {
  ItemStatus,
  KitchenMarks,
  Order,
  OrderEvent,
  OrderItem,
  OrderRound,
  OrderStatus,
  PaymentMethod,
  PaymentTransaction,
} from '@/types/order';
import { branchConfigQuery, branchMenuQuery, branchesQuery, contentQuery } from './queries';
import { getQueryClient } from './queryClient';
import { createTranslator, type Translator } from './translator';
import type { ContentMap } from './queries';

/*
 * The backend's orders in the screens' shape (types/order › Order). The backend answers data
 * only — what was chosen, ISO times, codes (restaurant-backend › docs/decisions.md › ADR-018);
 * the words come from here, the same ones the mock server writes into its orders: the option
 * lines from the branch's menu, times on the branch's clock, notes and payment names from
 * content. Nothing else in the app knows the backend's shape.
 */

/* ---------- The backend's order (restaurant-backend › src/modules/orders/orders.types.ts) ---------- */

type EventNote = 'paidOnline' | 'payInPerson' | 'onBill' | 'takenBy';

interface BackendEvent {
  status: OrderStatus;
  at: string;
  note?: EventNote;
  by?: string;
}

interface BackendItem {
  dishSlug: string;
  name: string;
  veg: boolean;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  config: LineConfig;
  offer?: OrderItem['offer'];
  plated?: true;
}

interface BackendRound {
  number: number;
  placedAt: string;
  status: OrderStatus;
  items: BackendItem[];
  timeline: BackendEvent[];
  kitchenNote?: string;
  changeableUntil: string;
  changedAt?: string;
}

export interface BackendOrder {
  id: string;
  token?: number;
  taxCharged?: false;
  rush?: true;
  branchId: string;
  mode: OrderMode;
  table?: number;
  pickup?: Order['pickup'];
  delivery?: Omit<NonNullable<Order['delivery']>, 'rider'>;
  customerName: string;
  placedBy: 'you' | 'other';
  fromThisSession: boolean;
  source: 'guest' | 'staff';
  placedAt: string;
  status: OrderStatus;
  itemTotal: number;
  total: number;
  promoCode?: string;
  discounts?: Order['discounts'];
  payment: {
    method: PaymentMethod;
    status: Order['payment']['status'];
    methodId: string;
    transactionRef?: string;
    refundAmount?: number;
    paid?: number;
    transactions: PaymentTransaction[];
  };
  rounds: BackendRound[];
  cancelledBy?: Order['cancelledBy'];
  cancelReason?: string;
  /** Dine-in: the kitchen's usual time, in minutes. */
  estimateMinutes?: { min: number; max: number };
  kitchenNote?: string;
  live: boolean;
}

/* ---------- What the words come from ---------- */

interface Words {
  branch: Branch;
  clock: Clock;
  menu: MenuCatalog;
  orders: Translator<ContentMap['orders']>;
  common: Translator<ContentMap['common']>;
  lineLabels: CartLineLabels;
}

/** A branch's words, menu and clock, from the app's cache (read once per branch per answer). */
async function wordsFor(branchId: string): Promise<Words> {
  const client = getQueryClient();
  const [branches, menu, orders, common, cart] = await Promise.all([
    client.ensureQueryData(branchesQuery()),
    client.ensureQueryData(branchMenuQuery(branchId)),
    client.ensureQueryData(contentQuery('orders')),
    client.ensureQueryData(contentQuery('common')),
    client.ensureQueryData(contentQuery('cart')),
  ]);
  const summary = branches.find((b) => b.id === branchId) ?? branches[0];
  if (!summary) throw new Error(`Unknown branch ${branchId}`);
  const branch = joinBranch(summary, await client.ensureQueryData(branchConfigQuery(summary.id)));
  return {
    branch,
    clock: createClock(branch),
    menu: createMenuCatalog(menu),
    orders: createTranslator(orders),
    common: createTranslator(common),
    lineLabels: cartLineLabels(createTranslator(cart), createMoney(branch)),
  };
}

/* ---------- The translation ---------- */

const MINUTE_MS = 60_000;

/** An item's status follows its round's: the kitchen marks rounds, not single dishes. */
const ITEM_STATUS: Record<OrderStatus, ItemStatus> = {
  received: 'queued',
  preparing: 'preparing',
  ready: 'ready',
  outForDelivery: 'ready',
  served: 'served',
  pickedUp: 'served',
  delivered: 'served',
  cancelled: 'queued',
};

/** How an order still due is paid in person, by mode (for a note on a round paid that way). */
const IN_PERSON: Record<OrderMode, Exclude<PaymentMethod, 'online'>> = {
  dineIn: 'counter',
  takeaway: 'pickup',
  delivery: 'cod',
};

function itemOf(item: BackendItem, status: OrderStatus, words: Words): OrderItem {
  const dish = words.menu.getDish(item.dishSlug);
  const options = dish ? describeOptions(dish, item.config, words.lineLabels) : '';
  const instructions = describeInstructions(item.config);
  return {
    dishSlug: item.dishSlug,
    name: item.name,
    ...(item.plated ? { plated: true } : {}),
    veg: item.veg,
    quantity: item.quantity,
    ...(item.variantName ? { variant: item.variantName.split(' · ')[0] } : {}),
    details: options ? [options] : [],
    ...(instructions ? { note: instructions.replace(/^“|”$/g, '') } : {}),
    unitPrice: item.unitPrice,
    status: ITEM_STATUS[status],
    config: item.config,
    ...(item.offer ? { offer: item.offer } : {}),
  };
}

function noteOf(event: BackendEvent, order: BackendOrder, words: Words): string | undefined {
  switch (event.note) {
    case 'paidOnline':
      return words.orders('payment.paidOnline');
    case 'onBill':
      return words.orders('payment.onBill');
    case 'takenBy':
      return words.orders('payment.takenBy', { name: event.by ?? '' });
    case 'payInPerson': {
      const settlement =
        order.payment.method === 'online' ? IN_PERSON[order.mode] : order.payment.method;
      const key = {
        counter: 'payAtCounter',
        pickup: 'payAtPickup',
        cod: 'cashOnDelivery',
      } as const;
      return words.orders(`payment.${key[settlement]}`);
    }
    default:
      return undefined;
  }
}

const eventOf = (event: BackendEvent, order: BackendOrder, words: Words): OrderEvent => {
  const note = noteOf(event, order, words);
  return {
    status: event.status,
    time: words.clock.time(new Date(event.at)),
    at: event.at,
    ...(note ? { note } : {}),
  };
};

/** When the guest is waiting for: food ready (dine-in), the pickup time, or the door. */
function awaitedAt(round: BackendRound, order: BackendOrder, words: Words): number {
  if (order.mode === 'takeaway' && order.pickup) return Date.parse(order.pickup.at);
  if (order.mode === 'delivery' && order.delivery) return Date.parse(order.delivery.expectedAt);
  // Dine-in: the branch's usual kitchen time, at most.
  return Date.parse(round.placedAt) + words.branch.prepMinutes.max * MINUTE_MS;
}

function roundOf(round: BackendRound, order: BackendOrder, words: Words, now: number): OrderRound {
  const marks: KitchenMarks = {};
  for (const event of round.timeline) {
    const mark = { at: event.at, by: event.by ?? '' };
    if (event.status === 'preparing') marks.started = mark;
    if (event.status === 'ready' || event.status === 'outForDelivery') marks.ready = mark;
  }
  const handedOver = round.timeline.find((e) => e.status === finalStep(order.mode));
  // Waiting while the kitchen (or the rider) hasn't finished.
  const waitingFor = order.mode === 'delivery' ? 'delivered' : 'ready';
  const done = round.timeline.some(
    (e) =>
      e.status === waitingFor || e.status === finalStep(order.mode) || e.status === 'cancelled',
  );
  const awaited = awaitedAt(round, order, words);
  return {
    number: round.number,
    placedAt: round.placedAt,
    status: round.status,
    items: round.items.map((item) => itemOf(item, round.status, words)),
    timeline: round.timeline.map((e) => eventOf(e, order, words)),
    ...(round.kitchenNote ? { kitchenNote: round.kitchenNote } : {}),
    changeableUntil: round.changeableUntil,
    ...(round.changedAt ? { changedAt: round.changedAt } : {}),
    ...(done ? {} : { etaMinutes: Math.max(1, Math.ceil((awaited - now) / MINUTE_MS)) }),
    readyBy: words.clock.time(new Date(awaited)),
    ...(handedOver ? { servedAt: handedOver.at } : {}),
    ...(marks.started || marks.ready ? { kitchen: marks } : {}),
  };
}

/** How the order was paid, as the guest reads it: "UPI", "Cash"… */
function paymentDetail(order: BackendOrder, words: Words): string | undefined {
  const payments = order.payment.transactions.filter((t) => t.kind === 'payment');
  const last = payments.at(-1);
  if (!last) return undefined;
  return words.common(`paymentMethods.${last.method}` as Parameters<Words['common']>[0]);
}

/**
 * One backend order as the screens read it. `sessionId` marks orders from the asking guest's
 * session (theirs to pay); another guest's or staff's never carry a real token.
 */
export function toAppOrder(
  order: BackendOrder,
  words: Words,
  sessionToken: string | undefined,
  now = Date.now(),
): Order {
  const rounds = order.rounds.map((r) => roundOf(r, order, words, now));
  const active = rounds.filter((r) => r.status !== 'cancelled');
  const latest = active.at(-1) ?? rounds.at(-1);
  const detail = paymentDetail(order, words);
  const sessionId =
    order.fromThisSession && sessionToken
      ? sessionToken
      : order.source === 'guest'
        ? `guest:${order.id}`
        : undefined;
  return {
    id: order.id,
    ...(order.token !== undefined ? { token: order.token } : {}),
    branchId: order.branchId,
    mode: order.mode,
    ...(order.table !== undefined ? { table: order.table } : {}),
    ...(order.pickup ? { pickup: order.pickup } : {}),
    ...(order.delivery ? { delivery: order.delivery } : {}),
    customerName: order.customerName,
    placedBy: order.placedBy,
    ...(sessionId ? { sessionId } : {}),
    placedAt: order.placedAt,
    status: order.status,
    items: active.flatMap((r) => r.items),
    itemTotal: order.itemTotal,
    ...(order.taxCharged === false ? { taxCharged: false as const } : {}),
    ...(order.rush ? { rush: true } : {}),
    total: order.total,
    ...(order.promoCode ? { promoCode: order.promoCode } : {}),
    ...(order.discounts ? { discounts: order.discounts } : {}),
    payment: {
      method: order.payment.method,
      status: order.payment.status,
      ...(detail ? { detail } : {}),
      ...(order.payment.transactionRef ? { transactionRef: order.payment.transactionRef } : {}),
      ...(order.payment.refundAmount ? { refundAmount: order.payment.refundAmount } : {}),
      ...(order.payment.paid !== undefined ? { paid: order.payment.paid } : {}),
      transactions: order.payment.transactions,
    },
    rounds,
    ...(order.cancelledBy ? { cancelledBy: order.cancelledBy } : {}),
    ...(order.cancelReason
      ? {
          cancelReason: words.orders(
            `restaurantCancel.${order.cancelReason}` as Parameters<Words['orders']>[0],
          ),
        }
      : {}),
    timeline: latest?.timeline ?? [],
    ...(order.estimateMinutes ? { estimate: words.common('prepTime', order.estimateMinutes) } : {}),
    ...(latest?.etaMinutes !== undefined ? { etaMinutes: latest.etaMinutes } : {}),
    ...(latest?.readyBy ? { readyBy: latest.readyBy } : {}),
    ...(order.kitchenNote ? { kitchenNote: order.kitchenNote } : {}),
    live: order.live,
  };
}

/** Backend orders in the screens' shape (their branches' words read once each). */
export async function toAppOrders(
  orders: readonly BackendOrder[],
  sessionToken?: string,
): Promise<Order[]> {
  const words = new Map<string, Promise<Words>>();
  return Promise.all(
    orders.map(async (order) => {
      let branchWords = words.get(order.branchId);
      if (!branchWords) {
        branchWords = wordsFor(order.branchId);
        words.set(order.branchId, branchWords);
      }
      return toAppOrder(order, await branchWords, sessionToken);
    }),
  );
}
