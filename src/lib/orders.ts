import type { Branch, OrderMode } from '@/types/branch';
import type {
  ItemStatus,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@/types/order';
import type { Clock } from './clock';
import type { MenuCatalog } from './menu';
import { calculateBill, type Bill, type BillRules } from './pricing';

/* ---------- Order lists ---------- */

/**
 * Whether the current guest session placed the order: the basis of "Just my orders" and
 * separate bills at a shared table. Only orders stamped with this session count — orders
 * from other guests, earlier visits or the drawn history (no session) belong to the table.
 */
export const isOwnOrder = (order: Pick<Order, 'sessionId'>, sessionId: string | undefined) =>
  Boolean(sessionId) && order.sessionId === sessionId;

/** Placed on the same branch day as `now` (in the branch's time zone). */
export const isToday = (iso: string, now: Date, clock: Clock) => clock.isSameDay(iso, now);

/** `today` (the word, e.g. "Today") or "12 Sep 2026" (branch time). */
export const formatOrderDay = (iso: string, now: Date, today: string, clock: Clock) =>
  isToday(iso, now, clock) ? today : clock.date(iso);

/** "7:42 PM" today, "12 Sep 2026, 8:18 PM" on an earlier visit (branch time). */
export function formatPlaced(iso: string, now: Date, clock: Clock): string {
  const time = clock.time(iso);
  return isToday(iso, now, clock) ? time : `${clock.date(iso)}, ${time}`;
}

/** Splits orders into this visit (today) and earlier visits, keeping their order. */
export function groupByVisit(orders: readonly Order[], now: Date, clock: Clock) {
  return {
    today: orders.filter((o) => isToday(o.placedAt, now, clock)),
    earlier: orders.filter((o) => !isToday(o.placedAt, now, clock)),
  };
}

/** What the guest has spent: every order except cancelled ones. */
export const spentTotal = (orders: readonly Order[]) =>
  orders.reduce((sum, o) => (o.status === 'cancelled' ? sum : sum + o.total), 0);

/* ---------- Display helpers ---------- */

/** Content key (orders › payment) of an order's payment status. */
export type PaymentLabel =
  | 'paidOnline'
  | 'paidAtCounter'
  | 'paidAtPickup'
  | 'paidOnDelivery'
  | 'paymentPending'
  | 'payAtCounter'
  | 'payAtPickup'
  | 'cashOnDelivery'
  | 'refunded'
  | 'refundStarted';

const PAYMENT_LABEL: Record<PaymentStatus, Record<PaymentMethod, PaymentLabel>> = {
  paid: {
    online: 'paidOnline',
    counter: 'paidAtCounter',
    pickup: 'paidAtPickup',
    cod: 'paidOnDelivery',
  },
  unpaid: {
    online: 'paymentPending',
    counter: 'payAtCounter',
    pickup: 'payAtPickup',
    cod: 'cashOnDelivery',
  },
  refunded: { online: 'refunded', counter: 'refunded', pickup: 'refunded', cod: 'refunded' },
  'refund-started': {
    online: 'refundStarted',
    counter: 'refundStarted',
    pickup: 'refundStarted',
    cod: 'refundStarted',
  },
};

/** Key of "Paid online", "Pay at counter", "Cash on delivery", "Refunded"… */
export const paymentLabel = ({ payment }: Pick<Order, 'payment'>): PaymentLabel =>
  PAYMENT_LABEL[payment.status][payment.method];

/** Key of how an order is still to be paid, by method: "Pay at counter", "Pay at pickup", "Cash on delivery". */
export const unpaidLabel = (method: PaymentMethod): PaymentLabel => PAYMENT_LABEL.unpaid[method];

/** True while the guest still owes money for the order (paid in person later). */
export const isUnpaid = ({ payment }: Pick<Order, 'payment'>) => payment.status === 'unpaid';

/** Payment as a status on the tracking timeline: key of "Paid online", "Paying at the counter"… */
export const paymentProgress = (order: Pick<Order, 'payment'>): PaymentLabel | 'payingAtCounter' =>
  isUnpaid(order) && order.payment.method === 'counter' ? 'payingAtCounter' : paymentLabel(order);

/** Content key (orders › totals) of the total line: what's still to pay, and where, or what was paid. */
export function totalLabel({
  payment,
}: Pick<Order, 'payment'>): 'totalPaid' | 'toPayAtCounter' | 'toPayAtPickup' | 'toPayOnDelivery' | 'total' {
  if (payment.status === 'paid') return 'totalPaid';
  if (payment.status !== 'unpaid') return 'total';
  if (payment.method === 'counter') return 'toPayAtCounter';
  if (payment.method === 'pickup') return 'toPayAtPickup';
  if (payment.method === 'cod') return 'toPayOnDelivery';
  return 'total';
}

/** The bill for an order, from its line prices, its delivery fee and its branch's tax rules. */
export const orderBill = (
  order: Pick<Order, 'items' | 'delivery'>,
  rules: BillRules & Pick<Branch, 'modes'>,
): Bill =>
  calculateBill(
    order.items,
    rules,
    order.delivery
      ? { fee: order.delivery.fee, taxable: rules.modes.delivery.feeTaxable }
      : undefined,
  );

/** "1 × Paneer Tikka (Full)" — the size is named only when it isn't the default one. */
export function itemLabel(item: OrderItem, menu: MenuCatalog): string {
  const defaultVariant = menu.getDish(item.dishSlug)?.variants?.[0]?.name.split(' · ')[0];
  const variant = item.variant && item.variant !== defaultVariant ? ` (${item.variant})` : '';
  return `${item.quantity} × ${item.name}${variant}`;
}

/** An item's own status, or one implied by the order's when the kitchen hasn't set it. */
export function itemStatus(item: OrderItem, order: Pick<Order, 'status'>): ItemStatus {
  if (item.status) return item.status;
  switch (order.status) {
    case 'received':
    case 'cancelled':
      return 'queued';
    // Collected or on its way: the kitchen's part is done.
    case 'pickedUp':
    case 'outForDelivery':
    case 'delivered':
      return 'ready';
    default:
      return order.status;
  }
}

/** The order-status colour an item status is drawn in ("In queue" uses the neutral pill). */
export const itemPillStatus = (status: ItemStatus): OrderStatus =>
  status === 'queued' ? 'received' : status;

/* ---------- Live tracking ---------- */

/** The progress steps of each mode, left to right; the last one finishes the order. */
export const TRACK_STEPS = {
  dineIn: ['received', 'preparing', 'ready', 'served'],
  takeaway: ['received', 'preparing', 'ready', 'pickedUp'],
  delivery: ['received', 'preparing', 'outForDelivery', 'delivered'],
} as const satisfies Record<OrderMode, readonly OrderStatus[]>;

export type TrackStep = (typeof TRACK_STEPS)[OrderMode][number];

/** How often a live order (and lists with one) is re-read from the server. */
export const TRACK_REFRESH_MS = 30_000;

/** Content key (orders › steps) of a step's name: takeaway's "ready" reads "Ready for pickup". */
export const stepKey = (mode: OrderMode, step: TrackStep): TrackStep | 'readyForPickup' =>
  mode === 'takeaway' && step === 'ready' ? 'readyForPickup' : step;

/** The step that completes an order of this mode: served, picked up or delivered. */
export const finalStep = (mode: OrderMode): TrackStep => TRACK_STEPS[mode][3];

/** Served, picked up, delivered and cancelled orders don't change any more. */
export const isFinished = ({ status, mode }: Pick<Order, 'status' | 'mode'>) =>
  status === 'cancelled' || status === finalStep(mode);

export interface TrackStepView {
  step: TrackStep;
  /** `next`: the step the kitchen starts next, while the order is only received. */
  state: 'done' | 'current' | 'next' | 'upcoming';
  /** Display time it happened, e.g. "7:46 PM". */
  time?: string;
  note?: string;
}

/**
 * The four progress steps of an active or finished order, for its mode. "Received" is a
 * milestone, not work in progress: once received it's done, and Preparing is shown as up next.
 */
export function trackSteps(order: Pick<Order, 'status' | 'timeline' | 'mode'>): TrackStepView[] {
  const steps: readonly TrackStep[] = TRACK_STEPS[order.mode];
  const current = steps.indexOf(order.status as TrackStep);
  const finished = order.status === finalStep(order.mode);
  return steps.map((step, i) => {
    const event = order.timeline.find((e) => e.status === step);
    let state: TrackStepView['state'] = 'upcoming';
    if (i < current || finished || step === 'received') state = 'done';
    else if (i === current) state = 'current';
    else if (order.status === 'received' && step === 'preparing') state = 'next';
    return { step, state, time: event?.time, note: event?.note };
  });
}
