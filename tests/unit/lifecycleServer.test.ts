import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiResponse } from '@/api/client';
import type {
  ApiErrorBody,
  OrderChangeResponse,
  OrderListResponse,
  Payment,
} from '@/api/contracts';
import { MOCK_KEYS } from '@/api/mock/db';
import { defaultConfig, orderLine, unitPrice } from '@/lib/cartLine';
import { amountDue, paidAmount } from '@/lib/lifecycle';
import type { Dish } from '@/types/menu';
import type { Order } from '@/types/order';
import type { GuestSession } from '@/types/session';
import { createTestServer, testMenu } from '../apiState';

/*
 * After an order is placed, on the mock server: rounds on a running dine-in order (one bill,
 * taxed and rounded as a whole), changing and cancelling within the branch's window
 * (GET /branches › ordering.cancelWindowSeconds: 120 s), and paying for it all.
 */

const START = Date.parse('2026-10-03T19:00:00+05:30');
const SECOND = 1000;
let now = START;
const server = createTestServer(() => now);
// The same data with rounds paid as they're ordered.
const perRound = createTestServer(
  () => now,
  (branches) =>
    branches.map((b) => ({ ...b, ordering: { ...b.ordering, dineInPayment: 'perRound' } })),
);
type Server = typeof server;

const call = (
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
  via: Server = server,
) => via({ method, path, body }) as Promise<ApiResponse>;
const error = (res: ApiResponse) => (res.body as ApiErrorBody).error;

beforeEach(() => {
  now = START;
});

const PHONES = { 'blr-indiranagar': '9876543210', 'ktm-thamel': '9841234567' } as const;
type BranchId = keyof typeof PHONES;

async function guest(branchId: BranchId = 'blr-indiranagar', table = 12): Promise<GuestSession> {
  const res = await call('POST', 'sessions', { branchId, mode: 'dineIn', table });
  const session = res.body as GuestSession;
  const phone = PHONES[branchId];
  await call('POST', 'otp', { sessionId: session.id, phone });
  await call('POST', 'otp/verify', { sessionId: session.id, phone, code: '123456' });
  return session;
}

function linesOf(branchId: string, slug: string, quantity = 1) {
  const dish = testMenu(branchId).getDish(slug) as Dish;
  const config = defaultConfig(dish);
  return [orderLine({ ...config, key: slug, quantity, unitPrice: unitPrice(dish, config) })];
}

async function place(
  session: GuestSession,
  slug: string,
  pay: 'counter' | 'online' = 'counter',
  quantity = 1,
): Promise<Order> {
  const lines = linesOf(session.branchId, slug, quantity);
  const method = pay === 'counter' ? 'counter' : 'online';
  let paymentId: string | undefined;
  if (pay === 'online') {
    const opened = await call('POST', 'payments', {
      purpose: 'order',
      sessionId: session.id,
      method,
      lines,
      fulfilment: { mode: 'dineIn' },
    });
    paymentId = (opened.body as Payment).id;
    await call('POST', `payments/${paymentId}/simulate`, { outcome: 'succeeded' });
  }
  const res = await call('POST', 'orders', {
    sessionId: session.id,
    customerName: 'Ananya',
    method,
    kitchenNote: '',
    lines,
    fulfilment: { mode: 'dineIn' },
    paymentId,
  });
  expect(res.status).toBe(201);
  return res.body as Order;
}

const addRound = (session: GuestSession, order: Order, slug: string, extra = {}, via = server) =>
  call(
    'POST',
    `orders/${order.id}/rounds`,
    { sessionId: session.id, lines: linesOf(session.branchId, slug), kitchenNote: '', ...extra },
    via,
  );

const change = (session: GuestSession, order: Order, lines: unknown[], extra = {}) =>
  call('PATCH', `orders/${order.id}`, {
    sessionId: session.id,
    round: 1,
    lines,
    kitchenNote: '',
    ...extra,
  });

const cancel = (session: GuestSession, order: Order, round = 1) =>
  call('POST', `orders/${order.id}/cancel`, { sessionId: session.id, round });

async function paid(session: GuestSession, body: Record<string, unknown>, via = server) {
  const opened = await call('POST', 'payments', { sessionId: session.id, ...body }, via);
  expect(opened.status).toBe(201);
  const payment = opened.body as Payment;
  await call('POST', `payments/${payment.id}/simulate`, { outcome: 'succeeded' }, via);
  return payment;
}

describe('POST /orders/:id/rounds', () => {
  it('adds a round without checkout and prices the tab as one bill (India: GST on the whole tab)', async () => {
    const session = await guest();
    // Garlic Naan ₹89 + 5% GST = ₹93.45 → ₹93 on its own.
    const first = await place(session, 'garlic-naan');
    expect(first.total).toBe(93);
    expect(first.rounds).toHaveLength(1);

    now += 30 * SECOND;
    const res = await addRound(session, first, 'garlic-naan');
    expect(res.status).toBe(201);
    const tab = res.body as Order;
    // ₹178 + 5% = ₹186.90 → ₹187 (two separate bills would have come to ₹186).
    expect(tab).toMatchObject({ id: first.id, itemTotal: 178, total: 187, status: 'received' });
    expect(tab.items).toHaveLength(2);
    expect(tab.rounds?.map((r) => [r.number, r.status])).toEqual([
      [1, 'received'],
      [2, 'received'],
    ]);
    expect(tab.rounds?.[1].timeline[0]).toMatchObject({ status: 'received', note: 'On your bill' });
    expect(tab.rounds?.[1].changeableUntil).toBe(new Date(now + 120 * SECOND).toISOString());
    // Paid at the end of the meal: the whole tab is still to pay.
    expect(tab.payment).toEqual({ method: 'counter', status: 'unpaid' });
    expect(amountDue(tab)).toBe(187);
  });

  it('Nepal: the service charge and VAT are on the whole tab', async () => {
    const session = await guest('ktm-thamel', 5);
    // Butter Naan रू 125 + 10% + 13% VAT = रू 155.375 → रू 155 on its own.
    const first = await place(session, 'butter-naan');
    expect(first.total).toBe(155);
    const tab = (await addRound(session, first, 'butter-naan')).body as Order;
    // रू 250 + रू 25 + रू 35.75 = रू 310.75 → रू 311.
    expect(tab).toMatchObject({ itemTotal: 250, total: 311 });
  });

  it('moves each round through the kitchen on its own; the order shows the latest', async () => {
    const session = await guest();
    const first = await place(session, 'dahi-kebab');
    now += 5 * 60 * SECOND;
    await addRound(session, first, 'hara-bhara-kebab');
    const order = (await call('GET', `orders/${first.id}`)).body as Order;
    expect(order.rounds?.map((r) => r.status)).toEqual(['preparing', 'received']);
    expect(order).toMatchObject({ status: 'received', live: true });
    expect(order.placedAt).toBe(first.placedAt);
  });

  it('keeps an online payment: the new round is due at the counter or with Pay my bill', async () => {
    const session = await guest();
    const first = await place(session, 'dahi-kebab', 'online');
    expect(first.payment).toMatchObject({ method: 'online', status: 'paid' });
    const tab = (await addRound(session, first, 'hara-bhara-kebab')).body as Order;
    // ₹289 + ₹259 = ₹548 → ₹575.40 → ₹575, of which ₹303 is paid.
    expect(tab.total).toBe(575);
    expect(tab.payment).toMatchObject({ method: 'counter', status: 'unpaid', paid: 303 });
    expect(amountDue(tab)).toBe(272);

    // Pay my bill charges what's still due, and the whole tab is then paid.
    const payment = await paid(session, { purpose: 'bill', method: 'upi', orderIds: [tab.id] });
    expect(payment.amount).toBe(272);
    const settled = (await call('GET', `orders/${tab.id}`)).body as Order;
    expect(settled.payment).toMatchObject({ method: 'online', status: 'paid' });
    expect(paidAmount(settled)).toBe(575);
  });

  it("refuses another guest's order, an empty round and a cancelled order", async () => {
    const session = await guest();
    const order = await place(session, 'dahi-kebab');
    const other = await guest();
    expect((await addRound(other, order, 'dahi-kebab')).status).toBe(404);
    const empty = await call('POST', `orders/${order.id}/rounds`, {
      sessionId: session.id,
      lines: [],
      kitchenNote: '',
    });
    expect(error(empty)).toBe('empty_order');
    await cancel(session, order);
    expect(error(await addRound(session, order, 'dahi-kebab'))).toBe('order_closed');
  });

  it('perRound: a round is paid as it is ordered, online for its share of the tab or at the counter', async () => {
    const session = await guest();
    const first = await place(session, 'dahi-kebab');
    expect(error(await addRound(session, first, 'hara-bhara-kebab', {}, perRound))).toBe(
      'invalid_request',
    );
    const unpaid = await addRound(
      session,
      first,
      'hara-bhara-kebab',
      { method: 'online' },
      perRound,
    );
    // The round's share: ₹575 for the tab − ₹303 already on it.
    expect(unpaid).toEqual({ status: 402, body: { error: 'payment_required', amountDue: 272 } });

    const payment = await paid(
      session,
      {
        purpose: 'round',
        method: 'online',
        orderId: first.id,
        lines: linesOf('blr-indiranagar', 'hara-bhara-kebab'),
      },
      perRound,
    );
    expect(payment).toMatchObject({ amount: 272, orderId: first.id });
    const res = await addRound(
      session,
      first,
      'hara-bhara-kebab',
      { method: 'online', paymentId: payment.id },
      perRound,
    );
    expect(res.status).toBe(201);
    const tab = res.body as Order;
    // Round 2 is paid; round 1 is still to pay at the counter.
    expect(tab.payment).toMatchObject({ method: 'counter', status: 'unpaid', paid: 272 });
    expect(tab.rounds?.[1].timeline[0].note).toBe('Paid online');
    // A payment is used once.
    const again = await addRound(
      session,
      first,
      'hara-bhara-kebab',
      { method: 'online', paymentId: payment.id },
      perRound,
    );
    expect(error(again)).toBe('payment_conflict');

    const counter = await addRound(session, first, 'masala-chai', { method: 'counter' }, perRound);
    expect((counter.body as Order).rounds).toHaveLength(3);
    // A round can't be paid for at a branch that bills at the end of the meal.
    const refused = await call('POST', 'payments', {
      purpose: 'round',
      sessionId: session.id,
      method: 'online',
      orderId: first.id,
      lines: linesOf('blr-indiranagar', 'masala-chai'),
    });
    expect(refused.status).toBe(400);
  });
});

describe('PATCH /orders/:id', () => {
  it('changes the latest round within the window and re-prices the order', async () => {
    const session = await guest();
    const order = await place(session, 'dahi-kebab');
    now += 60 * SECOND;
    const res = await change(session, order, linesOf('blr-indiranagar', 'dahi-kebab', 2), {
      kitchenNote: 'Mild please',
    });
    expect(res.status).toBe(200);
    const { order: changed, refunded } = res.body as OrderChangeResponse;
    expect(refunded).toBe(0);
    expect(changed).toMatchObject({ itemTotal: 578, total: 607, kitchenNote: 'Mild please' });
    expect(changed.items[0]).toMatchObject({ quantity: 2, config: { dishSlug: 'dahi-kebab' } });
    expect(changed.payment).toEqual({ method: 'counter', status: 'unpaid' });
  });

  it('paid online: a lower total is refunded, a higher one needs the difference paid first', async () => {
    const session = await guest();
    const order = await place(session, 'dahi-kebab', 'online', 2);
    expect(order.total).toBe(607);

    const lower = (await change(session, order, linesOf('blr-indiranagar', 'dahi-kebab')))
      .body as OrderChangeResponse;
    expect(lower.refunded).toBe(304);
    expect(lower.order).toMatchObject({ total: 303 });
    expect(lower.order.payment).toMatchObject({ status: 'paid', refundAmount: 304 });

    const two = linesOf('blr-indiranagar', 'dahi-kebab', 2);
    expect(await change(session, order, two)).toEqual({
      status: 402,
      body: { error: 'payment_required', amountDue: 304 },
    });
    const payment = await paid(session, {
      purpose: 'change',
      method: 'online',
      orderId: order.id,
      round: 1,
      lines: two,
    });
    expect(payment.amount).toBe(304);
    const higher = (await change(session, order, two, { paymentId: payment.id }))
      .body as OrderChangeResponse;
    expect(higher.order).toMatchObject({ total: 607 });
    expect(higher.order.payment.status).toBe('paid');
    expect(paidAmount(higher.order)).toBe(607);
  });

  it('refuses once the window has passed, the kitchen has started, or for an earlier round', async () => {
    const session = await guest();
    const order = await place(session, 'dahi-kebab');
    const lines = linesOf('blr-indiranagar', 'dahi-kebab', 2);
    expect(error(await change(session, order, lines, { round: 2 }))).toBe('window_closed');
    now += 120 * SECOND;
    expect(error(await change(session, order, lines))).toBe('window_closed');
    expect(error(await cancel(session, order))).toBe('window_closed');

    // Only from the session that placed it.
    const fresh = await place(await guest(), 'dahi-kebab');
    expect(
      error(await call('PATCH', `orders/${fresh.id}`, { sessionId: 'nobody', round: 1, lines })),
    ).toBe('session_not_found');
    expect((await change(await guest(), fresh, lines)).status).toBe(404);
  });

  it("can't change an order stored before rounds existed", async () => {
    const session = await guest();
    const order = await place(session, 'dahi-kebab');
    const { rounds: _rounds, ...legacy } = order;
    localStorage.setItem(MOCK_KEYS.orders, JSON.stringify([legacy]));
    expect(error(await change(session, order, linesOf('blr-indiranagar', 'dahi-kebab', 2)))).toBe(
      'window_closed',
    );
  });
});

describe('POST /orders/:id/cancel', () => {
  it('cancels the whole order within the window and refunds an online payment', async () => {
    const session = await guest();
    const order = await place(session, 'dahi-kebab', 'online');
    const res = await cancel(session, order);
    expect(res.status).toBe(200);
    const { order: cancelled, refunded } = res.body as OrderChangeResponse;
    expect(refunded).toBe(303);
    expect(cancelled).toMatchObject({
      status: 'cancelled',
      cancelledBy: 'guest',
      live: false,
      payment: { method: 'online', status: 'refund-started', refundAmount: 303 },
    });
    expect(cancelled.timeline.map((e) => e.status)).toEqual(['received', 'cancelled']);
    // Off this visit's bill.
    const table = (await call('GET', 'tables/blr-indiranagar/12/orders')).body as OrderListResponse;
    expect(table.orders.some((o) => o.id === order.id)).toBe(false);
  });

  it('cancels only the latest round of a tab, then the order with its last round', async () => {
    const session = await guest();
    const first = await place(session, 'dahi-kebab');
    await addRound(session, first, 'hara-bhara-kebab');
    expect(error(await cancel(session, first, 1))).toBe('window_closed');

    const { order: tab } = (await cancel(session, first, 2)).body as OrderChangeResponse;
    expect(tab).toMatchObject({ status: 'received', total: 303 });
    expect(tab.rounds?.map((r) => r.status)).toEqual(['received', 'cancelled']);
    expect(tab.items.map((i) => i.dishSlug)).toEqual(['dahi-kebab']);

    const { order } = (await cancel(session, first, 1)).body as OrderChangeResponse;
    expect(order).toMatchObject({ status: 'cancelled', cancelledBy: 'guest' });
  });
});
