import { createClock } from '@/lib/clock';
import { CANCEL_REASONS } from '@/lib/adminOrders';
import { MAX_REFUND_NOTE, REFUND_REASONS, refundable } from '@/lib/adminPayments';
import { isFinished, isToday } from '@/lib/orders';
import { amountDue, paidAmount } from '@/lib/lifecycle';
import { calculateBill } from '@/lib/pricing';
import { discountsFor, findPromo } from '@/lib/promotions';
import type { AdminOrders } from '@/types/admin';
import type { Branch } from '@/types/branch';
import type { Price } from '@/types/menu';
import type { Order, OrderRound } from '@/types/order';
import type { OrderChangeResponse, TablePaymentResponse } from '../../contracts';
import { fail, isObject, objectBody, ok, type Handler, type MockContext } from '../context';
import { demoOrders, isDemoFloorOn, isDemoId } from '../demoFloor';
import { liveOrder } from '../kitchen';
import { buildOrder, changeableUntil, nextOrderId, toOrderItems } from '../orderBuilder';
import {
  cancelledPayment,
  roundsOf,
  settlePayment,
  withRefund,
  withRounds,
  withTransaction,
} from '../tab';
import { floorActivity } from './adminService';
import { adminBranch, signedInAccount } from './adminSessions';
import { kitchenNoteOf } from './orderChanges';
import { offerLines } from './orderPricing';
import { branchOrders, placedOrders } from './orders';

/*
 * The staff's order endpoints: today's orders at a branch (GET /admin/branches/:branchId/orders);
 * orders a waiter takes at the table for guests who don't order on their phone — a new order at
 * a table (POST …/tables/:table/orders) and more items on an open dine-in order (POST
 * …/orders/:id/rounds), priced like a guest's, paid at the counter and noted "Taken by <name>";
 * collecting an order's payment in person, all of it or a share, with any tip (POST …/orders/:id/
 * payment); refunding part or all of what was paid (POST …/orders/:id/refund); and cancelling it
 * for the guest (POST …/orders/:id/cancel). Every payment and refund goes in the order's ledger
 * (`payment.transactions`) with who took or gave it.
 */

/** What both need: the waiter, the branch, its menu and promotions, the words, and now. */
async function staffContext(ctx: MockContext, headers: Record<string, string>, branchId: string) {
  const account = signedInAccount(ctx, headers);
  const branch = await adminBranch(ctx, headers, branchId);
  const [menu, promotions, labels] = await Promise.all([
    ctx.seed.menu(branch.id),
    ctx.seed.promotions(branch.id),
    ctx.seed.orderLabels(branch),
  ]);
  return { account, branch, menu, promotions, labels, now: new Date(ctx.now()) };
}

/** POST /admin/branches/:branchId/tables/:table/orders */
export const takeTableOrder: Handler = async (ctx, { params, body: raw, headers }) => {
  const staff = await staffContext(ctx, headers, params.branchId);
  const { account, branch, menu, labels, now } = staff;
  const body = objectBody(raw);
  const { customerName } = body;
  if (typeof customerName !== 'string' || !customerName.trim()) fail(400, 'invalid_request');
  const table = Number(params.table);
  const [layout, seedOrders] = await Promise.all([ctx.seed.floors(branch.id), ctx.seed.orders()]);
  if (!layout.floors.some((f) => f.tables.some((t) => t.number === table))) fail(404, 'not_found');
  if (!branch.modes.dineIn.enabled) fail(409, 'mode_unavailable');

  // Everything below is synchronous, so concurrent requests can't interleave their writes.
  const lines = offerLines(body, branch, { ...staff, pricedAt: now });
  const discounts = discountsFor(lines, undefined, branch.currency.minorUnit);
  const stored = ctx.db.orders.read();
  const order = buildOrder(
    {
      id: nextOrderId([...stored, ...seedOrders.history]),
      lines,
      fulfilment: { mode: 'dineIn', table },
      bill: calculateBill(lines, branch, undefined, discounts),
      customerName: customerName.trim(),
      method: 'counter',
      kitchenNote: kitchenNoteOf(body),
      takenBy: account.name,
      now,
    },
    menu,
    labels,
    branch,
  );
  if (!order) fail(422, 'empty_order');
  ctx.db.orders.write([order, ...stored]);
  return ok(liveOrder(order, now.getTime(), branch), 201);
};

/**
 * The order at the branch, as stored. An order from the drawn history (or, in dev, the demo
 * floor) is saved the first time staff act on it, and from then on it's a real one.
 */
async function storedOrder(ctx: MockContext, branch: Branch, id: string): Promise<Order> {
  const placed = (await placedOrders(ctx)).find((o) => o.id === id && o.branchId === branch.id);
  if (placed) return placed;
  const { history } = await branchOrders(ctx, branch);
  const demo =
    isDemoFloorOn() && isDemoId(id)
      ? demoOrders(branch, await ctx.seed.menu(branch.id), ctx.now())
      : [];
  const known = [...history, ...demo].find((o) => o.id === id);
  if (!known) fail(404, 'not_found');
  ctx.db.orders.write([known, ...ctx.db.orders.read()]);
  return known;
}

/** POST /admin/branches/:branchId/orders/:id/rounds */
export const addStaffRound: Handler = async (ctx, { params, body: raw, headers }) => {
  const staff = await staffContext(ctx, headers, params.branchId);
  const { account, branch, menu, promotions, labels, now } = staff;
  const body = objectBody(raw);
  const order = await storedOrder(ctx, branch, params.id);
  if (order.mode !== 'dineIn') fail(409, 'mode_unavailable');
  if (liveOrder(order, now.getTime(), branch).status === 'cancelled') fail(409, 'order_closed');

  const items = toOrderItems(
    offerLines(body, branch, { ...staff, pricedAt: now }),
    menu,
    labels.lineLabels,
  );
  const rounds = roundsOf(order);
  const round: OrderRound = {
    number: Math.max(...rounds.map((r) => r.number)) + 1,
    placedAt: now.toISOString(),
    status: 'received',
    items,
    timeline: [
      {
        status: 'received',
        time: createClock(branch).time(now),
        note: labels.takenBy(account.name),
      },
    ],
    kitchenNote: kitchenNoteOf(body) || undefined,
    changeableUntil: changeableUntil(now, branch),
  };
  const next = withRounds(
    order,
    [...rounds, round],
    branch,
    findPromo(promotions.codes, order.promoCode),
  );
  // It goes on the bill: what's been paid stays paid, the rest is due at the counter.
  const { payment } = settlePayment(order, paidAmount(order), next.total);
  const updated: Order = { ...next, payment };
  ctx.db.orders.write(ctx.db.orders.read().map((o) => (o.id === order.id ? updated : o)));
  return ok(liveOrder(updated, now.getTime(), branch), 201);
};

/** GET /admin/branches/:branchId/orders */
export const branchOrdersToday: Handler = async (ctx, { params, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const { orders, now } = await floorActivity(ctx, branch);
  const clock = createClock(branch);
  const response: AdminOrders = {
    orders: orders
      .filter((o) => isToday(o.placedAt, new Date(now), clock))
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt)),
    generatedAt: new Date(now).toISOString(),
  };
  return ok(response);
};

/** Saves the order and answers with it as read now. */
function saveOrder(ctx: MockContext, branch: Branch, order: Order, now: Date) {
  ctx.db.orders.write(ctx.db.orders.read().map((o) => (o.id === order.id ? order : o)));
  return ok(liveOrder(order, now.getTime(), branch));
}

/** One of the branch's ways to pay staff in person (GET /branches › payments.atTable), or 400. */
function atTableMethod(branch: Branch, body: unknown) {
  const method = branch.payments.atTable.find((m) => isObject(body) && m === body.method);
  if (!method) fail(400, 'invalid_request');
  return method;
}

/** The order paid in full in person, `payment.detail` naming how ("Cash"). */
function paidInFull(order: Order, detail: string): Order {
  const { payment } = settlePayment(order, order.total, order.total);
  return { ...order, payment: { ...payment, status: 'paid', detail } };
}

/** An amount in the body (major units) rounded to the currency's smallest unit; 400 if not a number. */
function amountField(branch: Branch, body: unknown, key: string): Price | undefined {
  const value = isObject(body) ? body[key] : undefined;
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    fail(400, 'invalid_request');
  const { minorUnit } = branch.currency;
  return Math.round(value * minorUnit) / minorUnit;
}

/**
 * The order with `amount` taken in person (all of what's due, or part of it for a split bill)
 * and recorded with the method, who took it and any tip.
 */
function takenInPerson(
  order: Order,
  taken: { amount: Price; method: string; detail: string; at: string; by: string; tip?: Price },
): Order {
  const due = amountDue(order);
  const paid =
    taken.amount >= due
      ? paidInFull(order, taken.detail)
      : {
          ...order,
          payment: settlePayment(order, paidAmount(order) + taken.amount, order.total).payment,
        };
  return withTransaction(
    paid,
    {
      kind: 'payment',
      amount: Math.min(taken.amount, due),
      channel: 'inPerson',
      method: taken.method,
      at: taken.at,
      by: taken.by,
      ...(taken.tip ? { tip: taken.tip } : {}),
    },
    order,
  );
}

/** POST /admin/branches/:branchId/orders/:id/payment */
export const collectPayment: Handler = async (ctx, { params, body, headers }) => {
  const account = signedInAccount(ctx, headers);
  const branch = await adminBranch(ctx, headers, params.branchId);
  const method = atTableMethod(branch, body);
  const amount = amountField(branch, body, 'amount');
  const tip = amountField(branch, body, 'tip');
  const labels = await ctx.seed.orderLabels(branch);
  const order = await storedOrder(ctx, branch, params.id);
  const now = new Date(ctx.now());
  if (liveOrder(order, now.getTime(), branch).status === 'cancelled') fail(409, 'order_closed');
  const due = amountDue(order);
  if (due <= 0) fail(409, 'nothing_to_pay');
  // A share of a split bill: more than nothing, and no more than what's due.
  if (amount !== undefined && (amount <= 0 || amount > due)) fail(400, 'invalid_request');
  const taken = takenInPerson(order, {
    amount: amount ?? due,
    method,
    detail: labels.atTableName(method),
    at: now.toISOString(),
    by: account.name,
    tip,
  });
  return saveOrder(ctx, branch, taken, now);
};

/** POST /admin/branches/:branchId/orders/:id/refund */
export const refundOrder: Handler = async (ctx, { params, body, headers }) => {
  const account = signedInAccount(ctx, headers);
  const branch = await adminBranch(ctx, headers, params.branchId);
  const reason = REFUND_REASONS.find((r) => isObject(body) && r === body.reason);
  const amount = amountField(branch, body, 'amount');
  if (!reason || amount === undefined || amount <= 0) fail(400, 'invalid_request');
  const rawNote = isObject(body) && typeof body.note === 'string' ? body.note.trim() : '';
  const order = await storedOrder(ctx, branch, params.id);
  const now = new Date(ctx.now());
  const available = refundable(liveOrder(order, now.getTime(), branch));
  if (available <= 0) fail(409, 'nothing_to_refund');
  if (amount > available) fail(400, 'invalid_request');
  // The bill stays settled: the refund is recorded beside it.
  const refunded: Order = {
    ...order,
    payment: { ...order.payment, refundAmount: (order.payment.refundAmount ?? 0) + amount },
  };
  return saveOrder(
    ctx,
    branch,
    withRefund(refunded, order, {
      amount,
      reason,
      at: now.toISOString(),
      by: account.name,
      ...(rawNote ? { note: rawNote.slice(0, MAX_REFUND_NOTE) } : {}),
    }),
    now,
  );
};

/** POST /admin/branches/:branchId/tables/:table/payment */
export const collectTablePayment: Handler = async (ctx, { params, body, headers }) => {
  const account = signedInAccount(ctx, headers);
  const branch = await adminBranch(ctx, headers, params.branchId);
  const method = atTableMethod(branch, body);
  const tip = amountField(branch, body, 'tip');
  const labels = await ctx.seed.orderLabels(branch);
  const table = Number(params.table);
  const { orders, now } = await floorActivity(ctx, branch);
  const clock = createClock(branch);
  const due = orders.filter(
    (o) =>
      o.mode === 'dineIn' &&
      o.table === table &&
      isToday(o.placedAt, new Date(now), clock) &&
      amountDue(o) > 0,
  );
  if (due.length === 0) fail(409, 'nothing_to_pay');
  const paid: Order[] = [];
  const at = new Date(now).toISOString();
  for (const [index, { id }] of due.entries()) {
    const stored = await storedOrder(ctx, branch, id);
    // One tip for the table, recorded with the first order's payment.
    const order = takenInPerson(stored, {
      amount: amountDue(stored),
      method,
      detail: labels.atTableName(method),
      at,
      by: account.name,
      tip: index === 0 ? tip : undefined,
    });
    ctx.db.orders.write(ctx.db.orders.read().map((o) => (o.id === id ? order : o)));
    paid.push(liveOrder(order, now, branch));
  }
  const response: TablePaymentResponse = { orders: paid };
  return ok(response);
};

/** The status of one round as the kitchen has it now (an order without rounds is one round). */
const liveRoundStatus = (live: Order, number: number) =>
  live.rounds
    ? live.rounds.find((r) => r.number === number)?.status
    : number === 1
      ? live.status
      : undefined;

/** PATCH /admin/branches/:branchId/orders/:id/rounds/:round */
export const editStaffRound: Handler = async (ctx, { params, body: raw, headers }) => {
  const staff = await staffContext(ctx, headers, params.branchId);
  const { branch, menu, promotions, labels, now } = staff;
  const body = objectBody(raw);
  const order = await storedOrder(ctx, branch, params.id);
  const number = Number(params.round);
  const live = liveOrder(order, now.getTime(), branch);
  if (live.status === 'cancelled') fail(409, 'order_closed');
  const status = liveRoundStatus(live, number);
  if (!status || status === 'cancelled') fail(404, 'not_found');
  // Once the food is ready (or served), it can't be changed: add a round or cancel instead.
  if (status !== 'received' && status !== 'preparing') fail(409, 'window_closed');

  const items = toOrderItems(
    offerLines(body, branch, { ...staff, pricedAt: now }),
    menu,
    labels.lineLabels,
  );
  const kitchenNote = kitchenNoteOf(body) || undefined;
  const rounds = roundsOf(order).map((r) =>
    r.number === number ? { ...r, items, kitchenNote } : r,
  );
  const next = withRounds(order, rounds, branch, findPromo(promotions.codes, order.promoCode));
  // Already paid more than the new total: the difference goes back to the guest.
  const settled = settlePayment(order, paidAmount(order), next.total);
  const updated = withRefund({ ...next, payment: settled.payment }, order, {
    amount: settled.refunded,
    reason: 'changed',
    at: now.toISOString(),
    by: staff.account.name,
  });
  ctx.db.orders.write(ctx.db.orders.read().map((o) => (o.id === order.id ? updated : o)));
  const response: OrderChangeResponse = {
    order: liveOrder(updated, now.getTime(), branch),
    refunded: settled.refunded,
  };
  return ok(response);
};

/** POST /admin/branches/:branchId/orders/:id/cancel */
export const cancelByStaff: Handler = async (ctx, { params, body, headers }) => {
  const account = signedInAccount(ctx, headers);
  const branch = await adminBranch(ctx, headers, params.branchId);
  const reason = CANCEL_REASONS.find((r) => isObject(body) && r === body.reason);
  if (!reason) fail(400, 'invalid_request');
  const labels = await ctx.seed.orderLabels(branch);
  const order = await storedOrder(ctx, branch, params.id);
  const now = new Date(ctx.now());
  // Served, picked up, delivered or already cancelled: too late.
  if (isFinished(liveOrder(order, now.getTime(), branch))) fail(409, 'order_closed');
  const time = createClock(branch).time(now);
  const cancelled = { status: 'cancelled' as const, time };
  const { payment, refunded } = cancelledPayment(order);
  const next: Order = {
    ...order,
    ...(order.rounds
      ? {
          rounds: order.rounds.map((r) =>
            r.status === 'cancelled'
              ? r
              : { ...r, status: 'cancelled', timeline: [...r.timeline, cancelled] },
          ),
        }
      : {}),
    status: 'cancelled',
    cancelledBy: 'restaurant',
    cancelReason: labels.cancelReason(reason),
    timeline: [...order.timeline, cancelled],
    payment,
  };
  return saveOrder(
    ctx,
    branch,
    withRefund(next, order, {
      amount: refunded,
      reason: 'cancelled',
      at: now.toISOString(),
      by: account.name,
    }),
    now,
  );
};
