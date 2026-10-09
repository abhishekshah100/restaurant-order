import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResponse } from '@/api/client';
import type {
  ApiErrorBody,
  CreateServiceRequestResponse,
  OrderListResponse,
  OtpChallenge,
  Payment,
  SettledPaymentResponse,
} from '@/api/contracts';
import { MOCK_KEYS } from '@/api/mock/db';
import {
  OTP_ATTEMPTS,
  OTP_RESEND_SECONDS,
  PAYMENT_WINDOW_SECONDS,
  SERVICE_REQUEST_TTL_MS,
  TABLE_SESSION_HOURS,
  HOUR_MS,
} from '@/api/mock/rules';
import { latencyFor, matchPath } from '@/api/mock/server';
import { mockLatencyRange } from '@/api/config';
import { defaultConfig, orderLine, unitPrice } from '@/lib/cartLine';
import type { Dish } from '@/types/menu';
import type { Order } from '@/types/order';
import type { GuestSession } from '@/types/session';
import { createTestServer, testMenu } from '../apiState';

/* A mock server on a clock the test moves, over this (jsdom) device's storage. */
const START = Date.parse('2026-10-03T19:00:00+05:30');
let now = START;
const server = createTestServer(() => now);
const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) =>
  server({ method, path, body }) as Promise<ApiResponse>;
const error = (res: ApiResponse) => (res.body as ApiErrorBody).error;

beforeEach(() => {
  now = START;
});

async function openSession(branchId = 'blr-indiranagar', table = 12): Promise<GuestSession> {
  const res = await call('POST', 'sessions', { branchId, mode: 'dineIn', table });
  expect(res.status).toBe(201);
  return res.body as GuestSession;
}

const DINE_IN = { mode: 'dineIn' } as const;

const PHONES = { 'blr-indiranagar': '9876543210', 'ktm-thamel': '9841234567' } as const;

async function verifiedSession(branchId: keyof typeof PHONES = 'blr-indiranagar', table = 12) {
  const session = await openSession(branchId, table);
  const phone = PHONES[branchId];
  await call('POST', 'otp', { sessionId: session.id, phone });
  await call('POST', 'otp/verify', { sessionId: session.id, phone, code: '123456' });
  return session;
}

function linesOf(branchId: string, slug = 'dahi-kebab', quantity = 2) {
  const dish = testMenu(branchId).getDish(slug) as Dish;
  const config = defaultConfig(dish);
  return [orderLine({ ...config, key: slug, quantity, unitPrice: unitPrice(dish, config) })];
}

async function placeCounterOrder(session: GuestSession, quantity = 2): Promise<Order> {
  const res = await call('POST', 'orders', {
    sessionId: session.id,
    customerName: 'Rohan',
    method: 'counter',
    kitchenNote: '',
    lines: linesOf(session.branchId, 'dahi-kebab', quantity),
    fulfilment: DINE_IN,
  });
  expect(res.status).toBe(201);
  return res.body as Order;
}

describe('router', () => {
  it('matches paths with params and ignores other endpoints', async () => {
    expect(matchPath('orders/:id', 'orders/A105')).toEqual({ id: 'A105' });
    expect(matchPath('tables/:branchId/:table/orders', 'tables/ktm-thamel/5/orders')).toEqual({
      branchId: 'ktm-thamel',
      table: '5',
    });
    expect(matchPath('orders/:id', 'orders')).toBeNull();
    // Reference data isn't the mock's: it falls through to the static JSON.
    expect(await server({ method: 'GET', path: 'branches' })).toBeNull();
  });

  it('answers within the configured latency, the same each time', () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCK_LATENCY_MS', '200-400');
    const request = { method: 'GET' as const, path: 'orders/A105' };
    const delay = latencyFor(request);
    expect(delay).toBeGreaterThanOrEqual(200);
    expect(delay).toBeLessThanOrEqual(400);
    expect(latencyFor(request)).toBe(delay);
    vi.stubEnv('NEXT_PUBLIC_API_MOCK_LATENCY_MS', '0');
    expect(mockLatencyRange()).toEqual([0, 0]);
    expect(latencyFor(request)).toBe(0);
    vi.unstubAllEnvs();
  });
});

describe('POST /sessions', () => {
  it('opens a session at a table of the branch', async () => {
    const res = await call('POST', 'sessions', {
      branchId: 'ktm-thamel',
      mode: 'dineIn',
      table: 5,
      qrToken: 'a.b',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 'id-1',
      branchId: 'ktm-thamel',
      mode: 'dineIn',
      table: 5,
      startedAt: START,
      expiresAt: START + TABLE_SESSION_HOURS * HOUR_MS,
      qrToken: 'a.b',
    });
    expect(JSON.parse(localStorage.getItem(MOCK_KEYS.sessions) ?? '[]')).toHaveLength(1);
  });

  it('refuses an unknown branch or a table outside its range', async () => {
    const dineIn = (branchId: string, table?: number) =>
      call('POST', 'sessions', { branchId, mode: 'dineIn', table });
    expect((await dineIn('nowhere', 5)).status).toBe(400);
    expect((await dineIn('ktm-thamel', 0)).status).toBe(400);
    // Dine-in needs a table; takeaway and delivery have none.
    expect((await dineIn('ktm-thamel')).status).toBe(400);
    const takeaway = { branchId: 'ktm-thamel', mode: 'takeaway', table: 5 };
    expect((await call('POST', 'sessions', takeaway)).status).toBe(400);
  });
});

describe('OTP', () => {
  it('sends, refuses an early resend, counts wrong codes and verifies', async () => {
    const { id: sessionId } = await openSession();
    const phone = '9876543210';
    const sent = await call('POST', 'otp', { sessionId, phone });
    expect(sent.body).toEqual<OtpChallenge>({
      phone,
      sentAt: START,
      resendAt: START + OTP_RESEND_SECONDS * 1000,
      attemptsLeft: OTP_ATTEMPTS,
      maxAttempts: OTP_ATTEMPTS,
      verified: false,
    });

    now += 5000;
    const early = await call('POST', 'otp', { sessionId, phone, resend: true });
    expect(early).toEqual({
      status: 429,
      body: { error: 'otp_resend_too_soon', resendAt: START + OTP_RESEND_SECONDS * 1000 },
    });

    const wrong = await call('POST', 'otp/verify', { sessionId, phone, code: '000000' });
    expect(wrong).toEqual({
      status: 422,
      body: { error: 'otp_wrong_code', attemptsLeft: OTP_ATTEMPTS - 1, resendAt: START },
    });
    // After a wrong code a new one can be sent straight away.
    expect((await call('POST', 'otp', { sessionId, phone, resend: true })).status).toBe(200);

    const ok = await call('POST', 'otp/verify', { sessionId, phone, code: '123456' });
    expect(ok).toEqual({ status: 200, body: { verified: true } });
    // Sending to the same number again keeps it verified; another number doesn't.
    expect((await call('POST', 'otp', { sessionId, phone })).body).toMatchObject({
      verified: true,
    });
    const other = await call('POST', 'otp', { sessionId, phone: '9123456780' });
    expect(other.body).toMatchObject({ verified: false });
  });

  it('locks after the last wrong code and checks the number against the branch', async () => {
    const { id: sessionId } = await openSession();
    const phone = '9876543210';
    await call('POST', 'otp', { sessionId, phone });
    for (let left = OTP_ATTEMPTS - 1; left >= 0; left--) {
      const res = await call('POST', 'otp/verify', { sessionId, phone, code: '000000' });
      expect(res.body).toMatchObject({ error: 'otp_wrong_code', attemptsLeft: left });
    }
    const locked = await call('POST', 'otp/verify', { sessionId, phone, code: '123456' });
    expect(locked).toEqual({ status: 423, body: { error: 'otp_locked', attemptsLeft: 0 } });
    // The number must be valid for the branch (India: 10 digits starting 6–9).
    expect((await call('POST', 'otp', { sessionId, phone: '1234567890' })).status).toBe(400);
    expect(error(await call('POST', 'otp', { sessionId: 'nobody', phone }))).toBe(
      'session_not_found',
    );
  });
});

describe('orders', () => {
  it('places a counter order: numbered after the history, priced by the server, table from the session', async () => {
    const session = await verifiedSession('blr-indiranagar', 7);
    const res = await call('POST', 'orders', {
      sessionId: session.id,
      customerName: ' Rohan ',
      method: 'counter',
      kitchenNote: 'No onion',
      // A client price is ignored: the server prices from its menu.
      lines: [{ ...linesOf(session.branchId)[0], unitPrice: 1 }],
      fulfilment: DINE_IN,
    });
    expect(res.status).toBe(201);
    // 2 × ₹289 = ₹578 + 5% GST (₹28.90) = ₹606.90 → ₹607
    expect(res.body).toMatchObject({
      id: 'A105',
      branchId: 'blr-indiranagar',
      table: 7,
      sessionId: session.id,
      customerName: 'Rohan',
      itemTotal: 578,
      total: 607,
      status: 'received',
      live: true,
      kitchenNote: 'No onion',
      payment: { method: 'counter', status: 'unpaid' },
    });
    expect((await placeCounterOrder(session)).id).toBe('A106');
  });

  it('refuses unverified sessions, online orders without a payment and empty orders', async () => {
    const unverified = await openSession();
    const body = {
      customerName: 'R',
      method: 'counter',
      kitchenNote: '',
      lines: linesOf('blr-indiranagar'),
      fulfilment: DINE_IN,
    };
    expect(error(await call('POST', 'orders', { ...body, sessionId: unverified.id }))).toBe(
      'phone_not_verified',
    );
    const session = await verifiedSession();
    const online = { ...body, sessionId: session.id, method: 'online' };
    expect(await call('POST', 'orders', online)).toEqual({
      status: 402,
      body: { error: 'payment_required' },
    });
    const empty = { ...body, sessionId: session.id, lines: [] };
    expect(error(await call('POST', 'orders', empty))).toBe('empty_order');
  });

  it('places an online order with a succeeded payment for exactly its amount (Nepal: eSewa, service + VAT)', async () => {
    const session = await verifiedSession('ktm-thamel', 5);
    const lines = linesOf('ktm-thamel');
    const opened = await call('POST', 'payments', {
      purpose: 'order',
      sessionId: session.id,
      method: 'esewa',
      lines,
      fulfilment: DINE_IN,
    });
    const payment = opened.body as Payment;
    // 2 × रू 460 = 920 + 10% service (92) = 1,012 + 13% VAT (131.56) = 1,143.56 → 1,144
    expect(payment).toMatchObject({
      status: 'pending',
      amount: 1144,
      expiresAt: START + PAYMENT_WINDOW_SECONDS * 1000,
    });
    const order = {
      sessionId: session.id,
      customerName: 'Sita',
      method: 'esewa',
      kitchenNote: '',
      fulfilment: DINE_IN,
    };
    // Not paid yet.
    const early = await call('POST', 'orders', { ...order, lines, paymentId: payment.id });
    expect(error(early)).toBe('payment_conflict');

    await call('POST', `payments/${payment.id}/simulate`, { outcome: 'succeeded' });
    // The cart changed since: the amount no longer matches.
    const more = await call('POST', 'orders', {
      ...order,
      lines: linesOf('ktm-thamel', 'dahi-kebab', 3),
      paymentId: payment.id,
    });
    expect(error(more)).toBe('payment_conflict');

    const placed = await call('POST', 'orders', { ...order, lines, paymentId: payment.id });
    expect(placed.status).toBe(201);
    expect(placed.body).toMatchObject({
      branchId: 'ktm-thamel',
      table: 5,
      total: 1144,
      payment: { method: 'online', status: 'paid', detail: 'eSewa', transactionRef: '•••• 4821' },
      timeline: [{ status: 'received', time: '7:15 PM', note: 'Paid online' }],
    });
    // A payment pays for one order only.
    expect(error(await call('POST', 'orders', { ...order, lines, paymentId: payment.id }))).toBe(
      'payment_conflict',
    );
  });

  it('reports the live status: the kitchen moves an order along over time', async () => {
    const session = await verifiedSession();
    const { id } = await placeCounterOrder(session);
    now += 8 * 60_000;
    const preparing = await call('GET', `orders/${id}`);
    expect(preparing.body).toMatchObject({ status: 'preparing', etaMinutes: 10, live: true });
    now += 30 * 60_000;
    expect((await call('GET', `orders/${id}`)).body).toMatchObject({
      status: 'served',
      live: false,
    });
    // Drawn history orders keep their drawn status and aren't live.
    const drawn = await call('GET', 'orders/A104');
    expect(drawn.body).toMatchObject({ id: 'A104', status: 'preparing' });
    expect((drawn.body as Order).live).toBeUndefined();
    expect(await call('GET', 'orders/A110')).toEqual({ status: 404, body: { error: 'not_found' } });
  });

  it('keeps numbering past the old pool of 20 and never reuses a number', async () => {
    const session = await verifiedSession();
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) {
      ids.push((await placeCounterOrder(session)).id);
      now += 1_000;
    }
    expect(ids).toEqual(Array.from({ length: 25 }, (_, i) => `A${105 + i}`));
    // An hour later they've all been served: numbers still count on, every order is kept.
    now += 60 * 60_000;
    expect((await placeCounterOrder(session)).id).toBe('A130');
    const mine = (await call('GET', `sessions/${session.id}/orders`)).body as { orders: Order[] };
    const placed = mine.orders.filter((o) => Number(o.id.slice(1)) >= 105);
    expect(new Set(placed.map((o) => o.id)).size).toBe(26);
  });

  it("lists the guest's orders and the table's orders", async () => {
    const mine = await verifiedSession();
    const other = await verifiedSession();
    const a = await placeCounterOrder(mine);
    const b = await placeCounterOrder(other);

    const guest = (await call('GET', `sessions/${mine.id}/orders`)).body as OrderListResponse;
    const ids = guest.orders.map((o) => o.id);
    // The device's orders and the guest's drawn history, never other guests' history.
    expect(ids).toEqual(expect.arrayContaining([a.id, b.id, 'A104', 'A097']));
    expect(ids).not.toContain('A101');

    const table = (await call('GET', 'tables/blr-indiranagar/12/orders')).body as OrderListResponse;
    expect(table.orders.map((o) => o.id)).toEqual(expect.arrayContaining([a.id, b.id, 'A101']));
    expect(table.orders.every((o) => o.table === 12 && o.status !== 'cancelled')).toBe(true);
    // Nothing from another branch.
    const nepal = (await call('GET', 'tables/ktm-thamel/12/orders')).body as OrderListResponse;
    expect(nepal.orders.map((o) => o.id)).not.toContain(a.id);
  });
});

describe('bill payments', () => {
  it("pays the session's own unpaid orders and settles its bill request", async () => {
    const session = await verifiedSession();
    const order = await placeCounterOrder(session);
    const theirs = await placeCounterOrder(await verifiedSession());
    await call('POST', 'service-requests', { sessionId: session.id, kind: 'bill', scope: 'mine' });

    const opened = await call('POST', 'payments', {
      purpose: 'bill',
      sessionId: session.id,
      method: 'upi',
      orderIds: [order.id, theirs.id, 'A104'],
    });
    // Another guest's order and the history can't be paid here.
    expect(opened.body).toMatchObject({ amount: order.total, orderIds: [order.id] });

    const { id } = opened.body as Payment;
    const settled = (await call('POST', `payments/${id}/simulate`, { outcome: 'succeeded' }))
      .body as SettledPaymentResponse;
    expect(settled.payment.status).toBe('succeeded');
    expect(settled.orders).toHaveLength(1);
    expect(settled.orders[0].payment).toEqual({
      method: 'online',
      status: 'paid',
      detail: 'UPI',
      transactionRef: '•••• 4821',
    });
    const requests = await call('GET', `sessions/${session.id}/service-requests`);
    expect(requests.body).toEqual({ requests: [] });

    // Paying again: nothing left.
    const again = await call('POST', 'payments', {
      purpose: 'bill',
      sessionId: session.id,
      method: 'upi',
      orderIds: [order.id],
    });
    expect(again).toEqual({ status: 409, body: { error: 'nothing_to_pay' } });
  });

  it('records a failure, and refuses a result once the window has closed', async () => {
    const session = await verifiedSession();
    const order = await placeCounterOrder(session);
    const open = async () =>
      (
        await call('POST', 'payments', {
          purpose: 'bill',
          sessionId: session.id,
          method: 'card',
          orderIds: [order.id],
        })
      ).body as Payment;
    const failed = await open();
    const result = await call('POST', `payments/${failed.id}/simulate`, { outcome: 'failed' });
    expect(result.body).toMatchObject({ payment: { status: 'failed' }, orders: [] });
    expect(
      error(await call('POST', `payments/${failed.id}/simulate`, { outcome: 'succeeded' })),
    ).toBe('payment_conflict');

    const late = await open();
    now += PAYMENT_WINDOW_SECONDS * 1000;
    expect(
      error(await call('POST', `payments/${late.id}/simulate`, { outcome: 'succeeded' })),
    ).toBe('payment_conflict');
    const order2 = (await call('GET', `orders/${order.id}`)).body as Order;
    expect(order2.payment.status).toBe('unpaid');
  });
});

describe('service requests', () => {
  it('keeps one pending request of each kind per session, with the bill balance worked out', async () => {
    const session = await verifiedSession();
    const order = await placeCounterOrder(session);
    const waiter = await call('POST', 'service-requests', {
      sessionId: session.id,
      kind: 'waiter',
      reason: 'water',
      note: '  A high chair  ',
    });
    expect(waiter.status).toBe(201);
    expect((waiter.body as CreateServiceRequestResponse).request).toMatchObject({
      kind: 'waiter',
      table: 12,
      reason: 'water',
      note: 'A high chair',
    });
    const again = await call('POST', 'service-requests', {
      sessionId: session.id,
      kind: 'waiter',
      reason: 'other',
    });
    expect(again.body).toMatchObject({ created: false, request: { reason: 'water' } });

    const bill = await call('POST', 'service-requests', {
      sessionId: session.id,
      kind: 'bill',
      scope: 'mine',
    });
    expect((bill.body as CreateServiceRequestResponse).request).toMatchObject({
      scope: 'mine',
      balance: order.total,
    });

    // Another guest at the table doesn't see them.
    const other = await openSession();
    expect((await call('GET', `sessions/${other.id}/service-requests`)).body).toEqual({
      requests: [],
    });
    const { id } = (waiter.body as CreateServiceRequestResponse).request;
    expect(await call('DELETE', `service-requests/${id}`)).toEqual({ status: 204 });
    expect(error(await call('DELETE', `service-requests/${id}`))).toBe('not_found');
    const left = (await call('GET', `sessions/${session.id}/service-requests`)).body;
    expect(left).toMatchObject({ requests: [{ kind: 'bill' }] });

    now += SERVICE_REQUEST_TTL_MS;
    expect((await call('GET', `sessions/${session.id}/service-requests`)).body).toEqual({
      requests: [],
    });
  });
});

describe('transport', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends every request to the backend when NEXT_PUBLIC_API_MOCK=false', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCK', 'false');
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: 'A105' }), { status: 201 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { apiDelete, apiGet, apiPatch, apiPost } = await import('@/api/client');

    expect(await apiPost('orders', { sessionId: 's1' })).toEqual({ id: 'A105' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/orders.json',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ sessionId: 's1' }) }),
    );
    await apiGet('orders/A105');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/orders/A105.json',
      expect.objectContaining({ method: 'GET' }),
    );
    await apiPatch('orders/A105', { kitchenNote: 'x' });
    expect(fetchMock.mock.lastCall?.[1]?.method).toBe('PATCH');

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiDelete('service-requests/r1')).resolves.toBeUndefined();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'otp_wrong_code', attemptsLeft: 2 }), { status: 422 }),
    );
    await expect(apiPost('otp/verify', {})).rejects.toMatchObject({
      status: 422,
      code: 'otp_wrong_code',
      body: { attemptsLeft: 2 },
    });
  });

  it('answers server-owned endpoints from the mock by default, without a request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { apiGet, ApiError } = await import('@/api/client');
    const missing = apiGet('orders/A999');
    await expect(missing).rejects.toBeInstanceOf(ApiError);
    await expect(missing).rejects.toMatchObject({ status: 404, code: 'not_found' });
    // Only the mock's seed (the static JSON) was fetched, never the endpoint itself.
    expect(fetchSpy.mock.calls.map(([url]) => String(url))).not.toContain('/api/orders/A999.json');
    fetchSpy.mockRestore();
  });
});
