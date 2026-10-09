import { modePayments } from '@/lib/fulfilment';
import { amountDue } from '@/lib/lifecycle';
import { isUnpaid } from '@/lib/orders';
import { isOnlineMethod, isPaymentMethodId } from '@/lib/payments';
import { payableOrders } from '@/lib/service';
import type { OrderMode } from '@/types/branch';
import type { Order } from '@/types/order';
import type { Payment, SettledPaymentResponse } from '../../contracts';
import { fail, liveSession, objectBody, ok, stringField, type Handler } from '../context';
import { liveOrder } from '../kitchen';
import { MOCK_TRANSACTION_REF, PAYMENT_WINDOW_SECONDS } from '../rules';
import { orderChangeAmount } from './orderChanges';
import { priceOrder } from './orderPricing';
import { branchOrders } from './orders';
import { guestPromoUses } from './promos';

/** How an online payment is recorded on the orders it pays, e.g. `{ detail: "UPI" }`. */
export type OnlinePayment = Pick<Order['payment'], 'detail' | 'transactionRef'>;

/**
 * Marks the listed orders as paid online. Only unpaid orders change, so paying twice (a double
 * tap, or another tab that already paid) changes nothing. Returns the new list and the orders
 * that were marked, in list order.
 */
export function markOrdersPaid<T extends Pick<Order, 'id' | 'payment'>>(
  orders: readonly T[],
  ids: readonly string[],
  payment: OnlinePayment,
): { orders: T[]; marked: T[] } {
  const wanted = new Set(ids);
  const marked: T[] = [];
  const next = orders.map((order) => {
    if (!wanted.has(order.id) || !isUnpaid(order)) return order;
    const paid: T = { ...order, payment: { method: 'online', status: 'paid', ...payment } };
    marked.push(paid);
    return paid;
  });
  return { orders: next, marked };
}

/** POST /payments */
export const createPayment: Handler = async (ctx, { body: raw }) => {
  const body = objectBody(raw);
  const { purpose, method } = body;
  const { session, branch } = await liveSession(ctx, stringField(body, 'sessionId'));
  if (
    !isPaymentMethodId(method) ||
    !isOnlineMethod(method) ||
    (purpose === 'round' && branch.ordering.dineInPayment !== 'perRound')
  ) {
    fail(400, 'invalid_request');
  }
  const offeredFor = (mode: OrderMode) => modePayments(branch, mode).some((o) => o.id === method);

  let amount: number;
  let orderIds: string[] = [];
  let orderId: string | undefined;
  if (purpose === 'order') {
    if (!offeredFor(session.mode)) fail(400, 'invalid_request');
    const [menu, promotions] = await Promise.all([
      ctx.seed.menu(branch.id),
      ctx.seed.promotions(branch.id),
    ]);
    const now = new Date(ctx.now());
    amount = priceOrder(body, session, branch, {
      menu,
      promotions,
      now,
      pricedAt: now,
      promoUses: guestPromoUses(ctx, session.id),
    }).bill.total;
  } else if (purpose === 'bill') {
    const { orderIds: wanted } = body;
    if (
      !branch.payments.bill.some((o) => o.id === method) ||
      !Array.isArray(wanted) ||
      !wanted.every((id) => typeof id === 'string')
    ) {
      fail(400, 'invalid_request');
    }
    const { placed } = await branchOrders(ctx, branch);
    const payable = payableOrders(placed, session.id).filter((o) => wanted.includes(o.id));
    if (payable.length === 0) fail(409, 'nothing_to_pay');
    amount = payable.reduce((sum, o) => sum + amountDue(o), 0);
    orderIds = payable.map((o) => o.id);
  } else if (purpose === 'round' || purpose === 'change') {
    const change = await orderChangeAmount(ctx, body, purpose);
    if (!offeredFor(change.order.mode)) fail(400, 'invalid_request');
    ({ amount, orderId } = change);
  } else {
    fail(400, 'invalid_request');
  }

  const now = ctx.now();
  const payment: Payment = {
    id: ctx.newId(),
    purpose,
    sessionId: session.id,
    method,
    amount,
    status: 'pending',
    createdAt: now,
    expiresAt: now + PAYMENT_WINDOW_SECONDS * 1000,
    orderIds,
    ...(orderId ? { orderId } : {}),
  };
  ctx.db.payments.write([...ctx.db.payments.read(), payment]);
  return ok(payment, 201);
};

/** POST /payments/:id/simulate (mock only: the payment partner's result) */
export const simulatePayment: Handler = async (ctx, { params, body: raw }) => {
  const { outcome } = objectBody(raw);
  if (outcome !== 'succeeded' && outcome !== 'failed') fail(400, 'invalid_request');
  const found = ctx.db.payments.read().find((p) => p.id === params.id);
  if (!found) fail(404, 'not_found');
  const { branch } = await liveSession(ctx, found.sessionId);
  const labels = await ctx.seed.orderLabels(branch);

  // Synchronous from here: re-read, so a concurrent request's write isn't lost.
  const now = ctx.now();
  const payments = ctx.db.payments.read();
  const current = payments.find((p) => p.id === params.id);
  if (current?.status !== 'pending') fail(409, 'payment_conflict');
  const expired = now >= current.expiresAt;
  const payment: Payment = expired
    ? { ...current, status: 'expired' }
    : outcome === 'failed'
      ? { ...current, status: 'failed' }
      : { ...current, status: 'succeeded', transactionRef: MOCK_TRANSACTION_REF };
  ctx.db.payments.write(payments.map((p) => (p.id === payment.id ? payment : p)));
  if (expired) fail(409, 'payment_conflict');

  let paid: Order[] = [];
  if (payment.status === 'succeeded' && payment.purpose === 'bill') {
    const { orders, marked } = markOrdersPaid(ctx.db.orders.read(), payment.orderIds, {
      detail: labels.methodName(payment.method),
      transactionRef: payment.transactionRef,
    });
    ctx.db.orders.write(orders);
    paid = marked.map((o) =>
      liveOrder({ ...o, branchId: o.branchId ?? branch.id, mode: o.mode ?? 'dineIn' }, now, branch),
    );
    // The guest's own bill is settled: a pending "Just my orders" request is done with.
    const requests = ctx.db.serviceRequests.read();
    ctx.db.serviceRequests.write(
      requests.filter(
        (r) => !(r.kind === 'bill' && r.scope === 'mine' && r.sessionId === payment.sessionId),
      ),
    );
  }
  const response: SettledPaymentResponse = { payment, orders: paid };
  return ok(response);
};
