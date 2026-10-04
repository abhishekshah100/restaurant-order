import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiResponse } from '@/api/client';
import type { ApiErrorBody, DeliveryQuoteResponse, Payment } from '@/api/contracts';
import { defaultConfig, orderLine, unitPrice } from '@/lib/cartLine';
import type { Dish } from '@/types/menu';
import type { Order } from '@/types/order';
import type { GuestSession } from '@/types/session';
import { createTestServer, testMenu } from '../apiState';

/*
 * Order modes on the mock server: sessions opened for takeaway or delivery, switching mode,
 * delivery quotes, and placing, paying for and tracking takeaway and delivery orders.
 */

// 7:00 PM in Bengaluru, 7:15 PM in Kathmandu.
const START = Date.parse('2026-10-03T19:00:00+05:30');
const MINUTE = 60_000;
let now = START;
const server = createTestServer(() => now);
const call = (method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown) =>
  server({ method, path, body }) as Promise<ApiResponse>;
const error = (res: ApiResponse) => (res.body as ApiErrorBody).error;

beforeEach(() => {
  now = START;
});

const PHONES = { 'blr-indiranagar': '9876543210', 'ktm-thamel': '9841234567' } as const;
type BranchId = keyof typeof PHONES;

async function session(branchId: BranchId, body: Record<string, unknown>): Promise<GuestSession> {
  const res = await call('POST', 'sessions', { branchId, ...body });
  expect(res.status).toBe(201);
  const opened = res.body as GuestSession;
  const phone = PHONES[branchId];
  await call('POST', 'otp', { sessionId: opened.id, phone });
  await call('POST', 'otp/verify', { sessionId: opened.id, phone, code: '123456' });
  return opened;
}

function linesOf(branchId: string, quantity: number, slug = 'dahi-kebab') {
  const dish = testMenu(branchId).getDish(slug) as Dish;
  const config = defaultConfig(dish);
  return [orderLine({ ...config, key: slug, quantity, unitPrice: unitPrice(dish, config) })];
}

const ADDRESS = { line: 'Flat 3B, 12 Lake Road', area: 'Lazimpat', label: 'home' } as const;

describe('sessions for takeaway and delivery', () => {
  it('opens one without a table, with the delivery area', async () => {
    const res = await call('POST', 'sessions', {
      branchId: 'ktm-thamel',
      mode: 'delivery',
      deliveryArea: 'Lazimpat',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ mode: 'delivery', deliveryArea: 'Lazimpat' });
    expect(res.body).not.toHaveProperty('table');
    const nowhere = { branchId: 'ktm-thamel', mode: 'delivery', deliveryArea: 'Pokhara' };
    expect(error(await call('POST', 'sessions', nowhere))).toBe('area_not_served');
  });

  it('switches mode in the same session; dine-in needs the scanned table', async () => {
    const atTable = await session('blr-indiranagar', { mode: 'dineIn', table: 7 });
    const takeaway = await call('PATCH', `sessions/${atTable.id}`, { mode: 'takeaway' });
    expect(takeaway.body).toMatchObject({ id: atTable.id, mode: 'takeaway', table: 7 });
    const back = await call('PATCH', `sessions/${atTable.id}`, { mode: 'dineIn' });
    expect(back.body).toMatchObject({ id: atTable.id, mode: 'dineIn' });

    const away = await session('blr-indiranagar', { mode: 'takeaway' });
    expect(error(await call('PATCH', `sessions/${away.id}`, { mode: 'dineIn' }))).toBe(
      'mode_unavailable',
    );
    const area = await call('PATCH', `sessions/${away.id}`, {
      mode: 'delivery',
      deliveryArea: 'Domlur',
    });
    expect(area.body).toMatchObject({ mode: 'delivery', deliveryArea: 'Domlur' });
  });

  it('keeps waiter and bill requests for guests at a table', async () => {
    const away = await session('blr-indiranagar', { mode: 'takeaway' });
    const res = await call('POST', 'service-requests', {
      sessionId: away.id,
      kind: 'waiter',
      reason: 'water',
    });
    expect(res).toEqual({ status: 409, body: { error: 'dine_in_only' } });
  });
});

describe('POST /delivery/quote', () => {
  const quote = (area: string, itemTotal: number) =>
    call('POST', 'delivery/quote', { branchId: 'ktm-thamel', area, itemTotal });

  it("resolves the area's zone: fee, minimum and ETA", async () => {
    const res = await quote('Lazimpat', 500);
    expect(res.body).toEqual<DeliveryQuoteResponse>({
      area: 'Lazimpat',
      zoneId: 'ktm-thamel',
      zoneName: 'Thamel & Lazimpat',
      fee: 60,
      baseFee: 60,
      freeAbove: 2500,
      minOrder: 800,
      shortBy: 300,
      etaMinutes: 35,
    });
  });

  it('delivers free above the threshold and refuses areas it doesn’t serve', async () => {
    expect((await quote('Thamel', 2500)).body).toMatchObject({ fee: 0, shortBy: 0 });
    expect(error(await quote('Pokhara', 900))).toBe('area_not_served');
  });
});

describe('takeaway orders', () => {
  const order = (s: GuestSession, extra: Record<string, unknown>) =>
    call('POST', 'orders', {
      sessionId: s.id,
      customerName: 'Sita',
      method: 'pickup',
      kitchenNote: '',
      lines: linesOf(s.branchId, 2),
      ...extra,
    });

  it('as soon as possible: ready in the prep time, paid at pickup', async () => {
    const s = await session('ktm-thamel', { mode: 'takeaway' });
    const res = await order(s, { fulfilment: { mode: 'takeaway', pickupAt: null } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      mode: 'takeaway',
      // 7:15 PM + 25 min
      pickup: { asap: true, at: new Date(START + 25 * MINUTE).toISOString() },
      payment: { method: 'pickup', status: 'unpaid' },
      timeline: [{ status: 'received', note: 'Pay at pickup' }],
      readyBy: '7:40 PM',
    });
    expect(res.body).not.toHaveProperty('table');
  });

  it('at a slot on offer only, and with a method takeaway offers', async () => {
    const s = await session('ktm-thamel', { mode: 'takeaway' });
    // Slots run every 15 min from opening (10:00 AM, Kathmandu time): 7:45 PM is the first after 7:40.
    const slot = '2026-10-03T19:45:00+05:45';
    const placed = await order(s, { fulfilment: { mode: 'takeaway', pickupAt: slot } });
    expect(placed.body).toMatchObject({
      pickup: { asap: false, at: new Date(slot).toISOString() },
    });
    const off = await order(s, {
      fulfilment: { mode: 'takeaway', pickupAt: '2026-10-03T19:50:00+05:45' },
    });
    expect(error(off)).toBe('pickup_unavailable');
    const counter = await order(s, {
      method: 'counter',
      fulfilment: { mode: 'takeaway', pickupAt: null },
    });
    expect(counter.status).toBe(400);
    // The fulfilment has to be the session's mode.
    expect(error(await order(s, { fulfilment: { mode: 'dineIn' } }))).toBe('mode_unavailable');
  });

  it('moves to ready at the pickup time, then picked up', async () => {
    const s = await session('ktm-thamel', { mode: 'takeaway' });
    const { id } = (await order(s, { fulfilment: { mode: 'takeaway', pickupAt: null } }))
      .body as Order;
    now = START + 26 * MINUTE;
    expect((await call('GET', `orders/${id}`)).body).toMatchObject({ status: 'ready', live: true });
    now = START + 40 * MINUTE;
    expect((await call('GET', `orders/${id}`)).body).toMatchObject({
      status: 'pickedUp',
      live: false,
    });
  });
});

describe('delivery orders', () => {
  const body = (s: GuestSession, quantity: number, extra: Record<string, unknown> = {}) => ({
    sessionId: s.id,
    customerName: 'Sita',
    method: 'cod',
    kitchenNote: '',
    lines: linesOf(s.branchId, quantity),
    fulfilment: { mode: 'delivery', address: ADDRESS },
    ...extra,
  });

  it('refuses an order below the zone minimum, saying how far', async () => {
    const s = await session('ktm-thamel', { mode: 'delivery', deliveryArea: 'Lazimpat' });
    // 1 × रू 460: रू 340 short of रू 800.
    const res = await call('POST', 'orders', body(s, 1));
    expect(res).toEqual({ status: 422, body: { error: 'below_minimum', shortBy: 340 } });
    const away = { ...ADDRESS, area: 'Pokhara' };
    const nowhere = body(s, 4, { fulfilment: { mode: 'delivery', address: away } });
    expect(error(await call('POST', 'orders', nowhere))).toBe('area_not_served');
  });

  it("adds the zone's fee after tax and pays online for exactly that", async () => {
    const s = await session('ktm-thamel', { mode: 'delivery', deliveryArea: 'Lazimpat' });
    const opened = await call('POST', 'payments', {
      purpose: 'order',
      sessionId: s.id,
      method: 'esewa',
      lines: linesOf('ktm-thamel', 4),
      fulfilment: { mode: 'delivery', address: ADDRESS },
    });
    // 4 × रू 460 = 1,840 + 10% service (184) + 13% VAT on 2,024 (263.12) + fee 60 = 2,347.12 → 2,347
    const payment = opened.body as Payment;
    expect(payment.amount).toBe(2347);
    await call('POST', `payments/${payment.id}/simulate`, { outcome: 'succeeded' });
    const placed = await call(
      'POST',
      'orders',
      body(s, 4, { method: 'esewa', paymentId: payment.id }),
    );
    expect(placed.status).toBe(201);
    expect(placed.body).toMatchObject({
      mode: 'delivery',
      total: 2347,
      delivery: {
        address: ADDRESS,
        zoneName: 'Thamel & Lazimpat',
        fee: 60,
        expectedAt: new Date(START + 35 * MINUTE).toISOString(),
      },
      payment: { method: 'online', status: 'paid', detail: 'eSewa' },
    });
  });

  it('goes out with a rider (shown from then on), then is delivered at the expected time', async () => {
    const s = await session('ktm-thamel', { mode: 'delivery', deliveryArea: 'Lazimpat' });
    const placed = (await call('POST', 'orders', body(s, 4))).body as Order;
    expect(placed.payment).toEqual({ method: 'cod', status: 'unpaid' });
    expect(placed.delivery?.rider).toBeUndefined();

    now = START + 26 * MINUTE;
    const out = (await call('GET', `orders/${placed.id}`)).body as Order;
    expect(out).toMatchObject({ status: 'outForDelivery', etaMinutes: 9, live: true });
    expect(out.delivery?.rider).toMatchObject({
      name: expect.any(String),
      callHref: expect.stringMatching(/^tel:/),
    });

    now = START + 36 * MINUTE;
    expect((await call('GET', `orders/${placed.id}`)).body).toMatchObject({
      status: 'delivered',
      live: false,
    });
  });
});
