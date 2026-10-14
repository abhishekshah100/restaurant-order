import { createClock } from '@/lib/clock';
import { paidAmount } from '@/lib/lifecycle';
import { calculateBill } from '@/lib/pricing';
import { discountsFor, findPromo } from '@/lib/promotions';
import type { Branch } from '@/types/branch';
import type { Order, OrderRound } from '@/types/order';
import { fail, objectBody, ok, type Handler, type MockContext } from '../context';
import { demoOrders, isDemoFloorOn, isDemoId } from '../demoFloor';
import { liveOrder } from '../kitchen';
import { buildOrder, changeableUntil, nextOrderId, toOrderItems } from '../orderBuilder';
import { roundsOf, settlePayment, withRounds } from '../tab';
import { adminBranch, signedInAccount } from './adminSessions';
import { kitchenNoteOf } from './orderChanges';
import { offerLines } from './orderPricing';
import { placedOrders } from './orders';

/*
 * Orders a waiter takes at the table, for guests who don't order on their phone: a new order
 * at a table (POST /admin/branches/:branchId/tables/:table/orders) and more items on an open
 * dine-in order (POST /admin/branches/:branchId/orders/:id/rounds). Both are priced like a
 * guest's (the menu, the offers on now, the branch's taxes), paid at the counter, and noted
 * "Taken by <name>" on their timeline.
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
 * The open order at the branch, as stored. A demo order (dev only) is saved the first time a
 * waiter adds to it, and from then on it's a real one.
 */
async function storedOrder(ctx: MockContext, branch: Branch, id: string): Promise<Order> {
  const placed = (await placedOrders(ctx)).find((o) => o.id === id && o.branchId === branch.id);
  if (placed) return placed;
  if (isDemoFloorOn() && isDemoId(id)) {
    const demo = demoOrders(branch, await ctx.seed.menu(branch.id), ctx.now()).find(
      (o) => o.id === id,
    );
    if (demo) {
      ctx.db.orders.write([demo, ...ctx.db.orders.read()]);
      return demo;
    }
  }
  return fail(404, 'not_found');
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
