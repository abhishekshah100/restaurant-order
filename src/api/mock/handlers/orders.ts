import { createClock, type Clock } from '@/lib/clock';
import { modePayments } from '@/lib/fulfilment';
import { isToday } from '@/lib/orders';
import { isOnlineMethod, isPaymentMethodId } from '@/lib/payments';
import type { Branch } from '@/types/branch';
import type { Order } from '@/types/order';
import { toOrderHistory } from '../../adapters';
import type { OrderListResponse } from '../../contracts';
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
import { assignRider, buildOrder, nextOrderId } from '../orderBuilder';
import { priceOrder } from './orderPricing';

/* ---------- The order book ---------- */

/** Orders placed through the mock server (on this device), each with its branch and mode, newest first. */
export async function placedOrders(ctx: MockContext): Promise<Order[]> {
  const defaultBranchId = await ctx.seed.defaultBranchId();
  return ctx.db.orders
    .read()
    .map((o) => ({ ...o, branchId: o.branchId ?? defaultBranchId, mode: o.mode ?? 'dineIn' }))
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

/** One branch's orders as read now: placed ones with their live status, plus the drawn history. */
export async function branchOrders(
  ctx: MockContext,
  branch: Branch,
): Promise<{ placed: Order[]; history: Order[] }> {
  const [all, raw] = await Promise.all([placedOrders(ctx), ctx.seed.orders()]);
  const now = ctx.now();
  return {
    placed: all.filter((o) => o.branchId === branch.id).map((o) => liveOrder(o, now, branch)),
    history: toOrderHistory(raw, branch, new Date(now)).history,
  };
}

/** Every known order, placed ones first, without duplicates. */
export function allOrders(placed: readonly Order[], history: readonly Order[]): Order[] {
  const ids = new Set(placed.map((o) => o.id));
  return [...placed, ...history.filter((o) => !ids.has(o.id))];
}

/**
 * The guest's orders: placed in any of their sessions on this device plus the history drawn
 * as theirs (`placedBy: 'you'`), newest first. Other guests' orders aren't listed.
 */
export function guestOrders(placed: readonly Order[], history: readonly Order[]): Order[] {
  const ids = new Set(placed.map((o) => o.id));
  const own = history.filter((o) => o.placedBy === 'you' && !ids.has(o.id));
  return [...placed, ...own].sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt));
}

/** This visit's billable orders at the table: today (branch time), not cancelled, newest first. */
export function tableOrders(
  orders: readonly Order[],
  table: number,
  now: number,
  clock: Clock,
): Order[] {
  return orders
    .filter(
      (o) =>
        o.table === table && o.status !== 'cancelled' && isToday(o.placedAt, new Date(now), clock),
    )
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

/* ---------- Validation ---------- */

function placeOrderBody(raw: unknown) {
  const body = objectBody(raw);
  const { method, kitchenNote, paymentId, customerName } = body;
  if (
    typeof customerName !== 'string' ||
    typeof kitchenNote !== 'string' ||
    !isPaymentMethodId(method) ||
    (paymentId !== undefined && typeof paymentId !== 'string')
  ) {
    fail(400, 'invalid_request');
  }
  return {
    body,
    sessionId: stringField(body, 'sessionId'),
    customerName: customerName.trim(),
    method,
    kitchenNote,
    paymentId,
  };
}

/* ---------- Handlers ---------- */

/** POST /orders */
export const placeOrder: Handler = async (ctx, { body: raw }) => {
  const body = placeOrderBody(raw);
  const { session, branch } = await liveSession(ctx, body.sessionId);
  const [menu, labels, seedOrders] = await Promise.all([
    ctx.seed.menu(branch.id),
    ctx.seed.orderLabels(branch),
    ctx.seed.orders(),
  ]);
  // Everything below is synchronous, so concurrent requests can't interleave their writes.
  if (!modePayments(branch, session.mode).some((o) => o.id === body.method)) {
    fail(400, 'invalid_request');
  }
  if (!ctx.db.otp.read()[session.id]?.verified) fail(403, 'phone_not_verified');

  const now = new Date(ctx.now());
  const { lines, fulfilment, bill } = priceOrder(body.body, session, branch, menu, now);
  const online = isOnlineMethod(body.method);
  const payments = ctx.db.payments.read();
  const payment = online ? payments.find((p) => p.id === body.paymentId) : undefined;
  if (online && !payment) fail(402, 'payment_required');
  if (
    payment &&
    (payment.purpose !== 'order' ||
      payment.sessionId !== session.id ||
      payment.status !== 'succeeded' ||
      payment.orderIds.length > 0 ||
      payment.method !== body.method ||
      payment.amount !== bill.total)
  ) {
    fail(409, 'payment_conflict');
  }

  const stored = ctx.db.orders.read();
  const id = nextOrderId(stored, seedOrders.newOrderIds);
  if (!id) fail(503, 'order_ids_exhausted');
  const order = buildOrder(
    {
      id,
      lines,
      fulfilment,
      bill,
      rider:
        fulfilment.mode === 'delivery'
          ? assignRider(seedOrders.riders[branch.id] ?? [], id)
          : undefined,
      sessionId: session.id,
      customerName: body.customerName,
      method: body.method,
      kitchenNote: body.kitchenNote,
      transactionRef: payment?.transactionRef,
      now,
    },
    menu,
    labels,
    branch,
  );
  if (!order) fail(422, 'empty_order');
  ctx.db.orders.write([order, ...stored]);
  if (payment) {
    ctx.db.payments.write(payments.map((p) => (p === payment ? { ...p, orderIds: [id] } : p)));
  }
  return ok(liveOrder(order, ctx.now(), branch), 201);
};

/** GET /orders/:id */
export const getOrder: Handler = async (ctx, { params }) => {
  const [placed, branches, raw] = await Promise.all([
    placedOrders(ctx),
    ctx.seed.branches(),
    ctx.seed.orders(),
  ]);
  const now = ctx.now();
  const own = placed.find((o) => o.id === params.id);
  const branch = own && branches.find((b) => b.id === own.branchId);
  if (own && branch) return ok(liveOrder(own, now, branch));
  const drawn = branches
    .flatMap((b) => toOrderHistory(raw, b, new Date(now)).history)
    .find((o) => o.id === params.id);
  return drawn ? ok(drawn) : fail(404, 'not_found');
};

/** GET /sessions/:id/orders */
export const listSessionOrders: Handler = async (ctx, { params }) => {
  const { branch } = await liveSession(ctx, params.id);
  const { placed, history } = await branchOrders(ctx, branch);
  const response: OrderListResponse = { orders: guestOrders(placed, history) };
  return ok(response);
};

/** GET /tables/:branchId/:table/orders */
export const listTableOrders: Handler = async (ctx, { params }) => {
  const branch = (await ctx.seed.branches()).find((b) => b.id === params.branchId);
  const table = Number(params.table);
  if (!branch || !Number.isInteger(table)) fail(404, 'not_found');
  const { placed, history } = await branchOrders(ctx, branch);
  const response: OrderListResponse = {
    orders: tableOrders(allOrders(placed, history), table, ctx.now(), createClock(branch)),
  };
  return ok(response);
};
