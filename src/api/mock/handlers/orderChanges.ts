import { createClock } from '@/lib/clock';
import {
  findZone,
  minimumOrder,
  modePayments,
  quoteDelivery,
  type DeliveryQuote,
} from '@/lib/fulfilment';
import { changeWindow, paidAmount, type ChangeWindow } from '@/lib/lifecycle';
import { isOnlineMethod, isPaymentMethodId } from '@/lib/payments';
import { itemTotal } from '@/lib/pricing';
import { findPromo } from '@/lib/promotions';
import type { Branch } from '@/types/branch';
import type { Price } from '@/types/menu';
import type { Order, OrderRound } from '@/types/order';
import type { BranchPromotions } from '@/types/promotion';
import type { GuestSession } from '@/types/session';
import type { OrderChangeResponse, Payment } from '../../contracts';
import {
  fail,
  liveSession,
  objectBody,
  ok,
  stringField,
  type Handler,
  type MockContext,
} from '../context';
import { liveOrder } from '../kitchen';
import { changeableUntil, toOrderItems, type OrderLabels } from '../orderBuilder';
import { cancelledPayment, roundsOf, settlePayment, withRounds } from '../tab';
import { offerLines } from './orderPricing';

/*
 * After an order is placed (see api/contracts): another round on a running dine-in order,
 * changing the latest round and cancelling it, each inside the window the branch allows.
 */

/** The guest's own order, as stored and as read now, with everything needed to change it. */
interface Target {
  /** As stored (with its branch and mode). */
  order: Order;
  /** With its live status: what the window and the kitchen are judged on. */
  live: Order;
  session: GuestSession;
  branch: Branch;
  menu: Awaited<ReturnType<MockContext['seed']['menu']>>;
  promotions: BranchPromotions;
  labels: OrderLabels;
  now: Date;
  /** When new items are priced (the offers on): now, or when the payment for them opened. */
  pricedAt: Date;
}

/**
 * The order placed in this guest session, or 404 not_found: guests only change their own
 * orders (another session's or the drawn history can't be). Reads the tables synchronously
 * once the seed is in, so the caller's write can't interleave with another request's. With the
 * id of the payment that pays for the change, new items are priced as when it opened.
 */
async function targetOrder(
  ctx: MockContext,
  id: string,
  sessionId: string,
  paymentId?: unknown,
): Promise<Target> {
  const { session, branch } = await liveSession(ctx, sessionId);
  const [menu, promotions, labels] = await Promise.all([
    ctx.seed.menu(branch.id),
    ctx.seed.promotions(branch.id),
    ctx.seed.orderLabels(branch),
  ]);
  const stored = ctx.db.orders.read().find((o) => o.id === id && o.sessionId === session.id);
  if (!stored || (stored.branchId ?? branch.id) !== branch.id) fail(404, 'not_found');
  const order: Order = { ...stored, branchId: branch.id, mode: stored.mode ?? 'dineIn' };
  const now = new Date(ctx.now());
  const payment = ctx.db.payments.read().find((p) => p.id === paymentId);
  return {
    order,
    live: liveOrder(order, now.getTime(), branch),
    session,
    branch,
    menu,
    promotions,
    labels,
    now,
    pricedAt: payment ? new Date(payment.createdAt) : now,
  };
}

/** The branch's rules for the order's promo code (none when it has none, or it's gone). */
const promoOf = ({ order, promotions }: Target) => findPromo(promotions.codes, order.promoCode);

/** The open window for the round named in the body, or 409 window_closed. */
function openWindow(target: Target, body: Record<string, unknown>) {
  const window: ChangeWindow | null = changeWindow(target.live, target.now.getTime());
  if (!window?.open || window.round.number !== body.round) fail(409, 'window_closed');
  return window;
}

/** The body's kitchen note (none when a payment is being priced), or 400. */
function kitchenNoteOf(body: Record<string, unknown>): string {
  const { kitchenNote = '' } = body;
  if (typeof kitchenNote !== 'string') fail(400, 'invalid_request');
  return kitchenNote.trim();
}

/** Items for priced lines (with the offers on when they're priced), or 422 empty_order. */
function itemsOf(target: Target, body: Record<string, unknown>) {
  const lines = offerLines(body, target.branch, target);
  return toOrderItems(lines, target.menu, target.labels.lineLabels);
}

/** A succeeded, unused payment of this purpose for this order and amount, or 402 / 409. */
function takePayment(
  ctx: MockContext,
  target: Target,
  purpose: 'round' | 'change',
  paymentId: unknown,
  amount: Price,
): Payment {
  const payment = ctx.db.payments.read().find((p) => p.id === paymentId);
  if (!payment) fail(402, 'payment_required', { amountDue: amount });
  if (
    payment.purpose !== purpose ||
    payment.orderId !== target.order.id ||
    payment.sessionId !== target.session.id ||
    payment.status !== 'succeeded' ||
    payment.orderIds.length > 0 ||
    payment.amount !== amount
  ) {
    fail(409, 'payment_conflict');
  }
  return payment;
}

/** Saves the order, marks the payment used, and answers with the order as read now. */
function save(ctx: MockContext, target: Target, order: Order, payment?: Payment): Order {
  ctx.db.orders.write(ctx.db.orders.read().map((o) => (o.id === order.id ? order : o)));
  if (payment) {
    ctx.db.payments.write(
      ctx.db.payments.read().map((p) => (p.id === payment.id ? { ...p, orderIds: [order.id] } : p)),
    );
  }
  return liveOrder(order, target.now.getTime(), target.branch);
}

/* ---------- Plans: what a round or a change would do (shared with POST /payments) ---------- */

/**
 * A new round on the guest's running dine-in order (its timeline noting how it's paid), and the
 * order re-priced with it.
 */
export function planRound(target: Target, body: Record<string, unknown>, note?: string) {
  const { order, session, branch, now } = target;
  if (order.mode !== 'dineIn' || session.mode !== 'dineIn' || order.table !== session.table) {
    fail(409, 'mode_unavailable');
  }
  if (target.live.status === 'cancelled') fail(409, 'order_closed');
  const rounds = roundsOf(order);
  const items = itemsOf(target, body);
  const round: OrderRound = {
    number: Math.max(...rounds.map((r) => r.number)) + 1,
    placedAt: now.toISOString(),
    status: 'received',
    items,
    timeline: [{ status: 'received', time: createClock(branch).time(now), note }],
    kitchenNote: kitchenNoteOf(body) || undefined,
    changeableUntil: changeableUntil(now, branch),
  };
  const next = withRounds(order, [...rounds, round], branch, promoOf(target));
  // A round paid as it's ordered (perRound) pays its share of the tab.
  return { round, next, share: next.total - order.total };
}

/** The order with its latest round's items replaced, re-priced, and what's due online for it. */
export function planChange(target: Target, body: Record<string, unknown>) {
  const { order, branch } = target;
  const window = openWindow(target, body);
  const items = itemsOf(target, body);
  const kitchenNote = kitchenNoteOf(body) || undefined;
  const rounds = roundsOf(order).map((r) =>
    r.number === window.round.number ? { ...r, items, kitchenNote } : r,
  );
  const total = itemTotal(rounds.filter((r) => r.status !== 'cancelled').flatMap((r) => r.items));
  // A delivery's fee follows the new total (free above the zone's threshold), and its minimum.
  let { delivery } = order;
  let quote: DeliveryQuote | undefined;
  if (order.mode === 'delivery' && delivery) {
    const zone = findZone(branch.modes.delivery.zones, delivery.address.area);
    if (!zone) fail(422, 'area_not_served');
    quote = quoteDelivery(zone, delivery.address.area, total);
    delivery = { ...delivery, fee: quote.fee };
  }
  const short = minimumOrder(branch, order.mode, total, quote);
  if (short && short.shortBy > 0) fail(422, 'below_minimum', { shortBy: short.shortBy });
  const next = withRounds({ ...order, delivery }, rounds, branch, promoOf(target));
  const paid = paidAmount(order);
  // Paid online in full: a higher total is collected online now.
  const due = order.payment.method === 'online' ? Math.max(0, next.total - paid) : 0;
  return { next, paid, due };
}

/* ---------- Handlers ---------- */

/** POST /orders/:id/rounds */
export const addRound: Handler = async (ctx, { params, body: raw }) => {
  const body = objectBody(raw);
  const target = await targetOrder(ctx, params.id, stringField(body, 'sessionId'), body.paymentId);
  const { order, session, branch, labels } = target;
  if (!ctx.db.otp.read()[session.id]?.verified) fail(403, 'phone_not_verified');
  const perRound = branch.ordering.dineInPayment === 'perRound';
  const { method, paymentId } = body;
  if (
    perRound &&
    (!isPaymentMethodId(method) || !modePayments(branch, 'dineIn').some((o) => o.id === method))
  ) {
    fail(400, 'invalid_request');
  }
  const online = perRound && isPaymentMethodId(method) && isOnlineMethod(method);
  let note = labels.onBill;
  if (perRound) note = online ? labels.paidOnline : labels.payInPerson.counter;
  const { next, share } = planRound(target, body, note);
  const payment = online ? takePayment(ctx, target, 'round', paymentId, share) : undefined;
  const settled = settlePayment(order, paidAmount(order) + (payment?.amount ?? 0), next.total);
  return ok(save(ctx, target, { ...next, payment: settled.payment }, payment), 201);
};

/** PATCH /orders/:id */
export const changeOrder: Handler = async (ctx, { params, body: raw }) => {
  const body = objectBody(raw);
  const target = await targetOrder(ctx, params.id, stringField(body, 'sessionId'), body.paymentId);
  const { next, paid, due } = planChange(target, body);
  const payment = due > 0 ? takePayment(ctx, target, 'change', body.paymentId, due) : undefined;
  const settled = settlePayment(target.order, paid + due, next.total);
  const response: OrderChangeResponse = {
    order: save(ctx, target, { ...next, payment: settled.payment }, payment),
    refunded: settled.refunded,
  };
  return ok(response);
};

/** POST /orders/:id/cancel */
export const cancelOrder: Handler = async (ctx, { params, body: raw }) => {
  const body = objectBody(raw);
  const target = await targetOrder(ctx, params.id, stringField(body, 'sessionId'));
  const { order, branch, now } = target;
  const { round } = openWindow(target, body);
  const time = createClock(branch).time(now);
  const rounds = roundsOf(order).map((r) =>
    r.number === round.number
      ? {
          ...r,
          status: 'cancelled' as const,
          timeline: [...r.timeline, { status: 'cancelled' as const, time }],
        }
      : r,
  );

  let next: Order;
  let refunded: Price;
  if (rounds.some((r) => r.status !== 'cancelled')) {
    // A later round taken back: the tab goes on without it.
    const repriced = withRounds(order, rounds, branch, promoOf(target));
    const settled = settlePayment(order, paidAmount(order), repriced.total);
    next = { ...repriced, payment: settled.payment };
    refunded = settled.refunded;
  } else {
    const settled = cancelledPayment(order);
    next = {
      ...order,
      rounds,
      status: 'cancelled',
      cancelledBy: 'guest',
      timeline: [...order.timeline, { status: 'cancelled', time }],
      payment: settled.payment,
    };
    refunded = settled.refunded;
  }
  const response: OrderChangeResponse = { order: save(ctx, target, next), refunded };
  return ok(response);
};

/**
 * POST /payments with purpose `round` or `change`: what the payment must cover, worked out as
 * the round or change itself will be. Errors as those endpoints, and 409 nothing_to_pay.
 */
export async function orderChangeAmount(
  ctx: MockContext,
  body: Record<string, unknown>,
  purpose: 'round' | 'change',
): Promise<{ amount: Price; orderId: string; order: Order }> {
  const target = await targetOrder(
    ctx,
    stringField(body, 'orderId'),
    stringField(body, 'sessionId'),
  );
  const amount = purpose === 'round' ? planRound(target, body).share : planChange(target, body).due;
  if (amount <= 0) fail(409, 'nothing_to_pay');
  return { amount, orderId: target.order.id, order: target.order };
}
