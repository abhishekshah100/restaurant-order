import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiResponse } from '@/api/client';
import type {
  ApiErrorBody,
  OrderChangeResponse,
  OrderLineRequest,
  Payment,
  PromoQuote,
} from '@/api/contracts';
import { defaultConfig, orderLine, unitPrice } from '@/lib/cartLine';
import type { Dish } from '@/types/menu';
import type { Order } from '@/types/order';
import type { GuestSession } from '@/types/session';
import { createTestServer, testMenu } from '../apiState';

/*
 * Promotions on the mock server (the authority): POST /promos/validate, promo codes and happy
 * hour on payments and orders (taxes after the discount under both tax models), the per-guest
 * limit, and a running tab's code worked out over every round.
 */

// Thursday 8 Oct 2026, 7:30 PM in Bengaluru (7:45 PM in Kathmandu): after happy hour.
const EVENING = Date.parse('2026-10-08T19:30:00+05:30');
// 5:00 PM in Bengaluru (5:15 PM in Kathmandu): happy hour.
const HAPPY_HOUR = Date.parse('2026-10-08T17:00:00+05:30');
const MINUTE = 60_000;
let now = EVENING;
const server = createTestServer(() => now);
const call = (method: 'POST' | 'GET', path: string, body?: unknown) =>
  server({ method, path, body }) as Promise<ApiResponse>;
const error = (res: ApiResponse) => (res.body as ApiErrorBody).error;

beforeEach(() => {
  now = EVENING;
  localStorage.clear();
});

const PHONES = { 'blr-indiranagar': '9876543210', 'ktm-thamel': '9841234567' } as const;
type BranchId = keyof typeof PHONES;

async function guest(
  branchId: BranchId = 'blr-indiranagar',
  start: Record<string, unknown> = { mode: 'dineIn', table: 12 },
  verify = true,
): Promise<GuestSession> {
  const res = await call('POST', 'sessions', { branchId, ...start });
  expect(res.status).toBe(201);
  const session = res.body as GuestSession;
  if (verify) {
    const phone = PHONES[branchId];
    await call('POST', 'otp', { sessionId: session.id, phone });
    await call('POST', 'otp/verify', { sessionId: session.id, phone, code: '123456' });
  }
  return session;
}

/** Order lines: [slug, quantity] pairs at the branch's default choices. */
function lines(branchId: string, ...items: [string, number][]): OrderLineRequest[] {
  const menu = testMenu(branchId);
  return items.map(([slug, quantity]) => {
    const dish = menu.getDish(slug) as Dish;
    const config = defaultConfig(dish);
    return orderLine({ ...config, key: slug, quantity, unitPrice: unitPrice(dish, config) });
  });
}

const validate = (session: GuestSession, code: string, body: OrderLineRequest[]) =>
  call('POST', 'promos/validate', { sessionId: session.id, code, lines: body });

async function place(
  session: GuestSession,
  body: OrderLineRequest[],
  extra: Record<string, unknown> = {},
): Promise<ApiResponse> {
  return call('POST', 'orders', {
    sessionId: session.id,
    customerName: 'Ananya',
    method: 'counter',
    kitchenNote: '',
    lines: body,
    fulfilment: { mode: 'dineIn' },
    ...extra,
  });
}

const BUTTER_CHICKEN_AND_DAL = (): OrderLineRequest[] =>
  lines('blr-indiranagar', ['old-delhi-butter-chicken', 1], ['dal-makhani', 1]);

describe('POST /promos/validate', () => {
  it('prices WELCOME10 for the cart: 10% of ₹748', async () => {
    const session = await guest('blr-indiranagar', undefined, false);
    const res = await validate(session, ' welcome10 ', BUTTER_CHICKEN_AND_DAL());
    expect(res.status).toBe(200);
    expect(res.body).toEqual<PromoQuote>({
      code: 'WELCOME10',
      descriptionKey: 'percentCapped',
      discount: 74.8,
      offerDiscount: 0,
    });
  });

  it('caps it at ₹100, and takes it after happy hour', async () => {
    const session = await guest();
    const big = lines('blr-indiranagar', ['old-delhi-butter-chicken', 2], ['lamb-rogan-josh', 1]);
    expect((await validate(session, 'WELCOME10', big)).body).toMatchObject({ discount: 100 });

    now = HAPPY_HOUR;
    const atFive = await guest();
    const withDrinks = lines('blr-indiranagar', ['cold-coffee', 2], ['dal-makhani', 1]);
    // ₹657 − ₹72 happy hour = ₹585; 10% = ₹58.50.
    expect((await validate(atFive, 'WELCOME10', withDrinks)).body).toMatchObject({
      discount: 58.5,
      offerDiscount: 72,
    });
  });

  it('says why a code takes nothing off', async () => {
    const session = await guest();
    const kebab = lines('blr-indiranagar', ['dahi-kebab', 1]);
    expect((await validate(session, 'WELCOME10', kebab)).body).toEqual({
      error: 'below_minimum',
      shortBy: 10,
    });
    const nope = await validate(session, 'NOPE', kebab);
    expect(nope).toEqual({ status: 422, body: { error: 'promo_invalid' } });
    // Nepal's code isn't India's.
    expect(error(await validate(session, 'NAMASTE15', kebab))).toBe('promo_invalid');
    expect(error(await validate(session, 'FLAT50', BUTTER_CHICKEN_AND_DAL()))).toBe(
      'promo_mode_not_eligible',
    );
    expect((await validate(session, '', kebab)).status).toBe(400);
  });

  it('FLAT50 on a delivery order', async () => {
    const session = await guest('blr-indiranagar', {
      mode: 'delivery',
      deliveryArea: 'Indiranagar',
    });
    const res = await validate(session, 'flat50', lines('blr-indiranagar', ['dal-makhani', 2]));
    expect(res.body).toMatchObject({ code: 'FLAT50', discount: 50 });
  });
});

describe('POST /orders with a promo code', () => {
  it('India: records WELCOME10 and charges GST on the discounted items', async () => {
    const session = await guest();
    const res = await place(session, BUTTER_CHICKEN_AND_DAL(), { promoCode: 'welcome10' });
    expect(res.status).toBe(201);
    // ₹748 − ₹74.80 = ₹673.20 + GST ₹33.66 = ₹706.86 → ₹707.
    expect(res.body).toMatchObject({
      itemTotal: 748,
      total: 707,
      promoCode: 'WELCOME10',
      discounts: [{ kind: 'code', code: 'WELCOME10', amount: 74.8 }],
    });
  });

  it('turns the code down again when it no longer applies', async () => {
    const session = await guest();
    const kebab = lines('blr-indiranagar', ['dahi-kebab', 1]);
    const res = await place(session, kebab, { promoCode: 'WELCOME10' });
    expect(res).toEqual({ status: 422, body: { error: 'below_minimum', shortBy: 10 } });
    expect(error(await place(session, kebab, { promoCode: 'NOPE' }))).toBe('promo_invalid');
  });

  it('WELCOME10 is once per guest: their number, across sessions', async () => {
    const first = await guest();
    expect((await place(first, BUTTER_CHICKEN_AND_DAL(), { promoCode: 'WELCOME10' })).status).toBe(
      201,
    );
    // Later, at another table: same number, new session.
    const again = await guest('blr-indiranagar', { mode: 'dineIn', table: 7 });
    expect(error(await validate(again, 'WELCOME10', BUTTER_CHICKEN_AND_DAL()))).toBe(
      'promo_limit_reached',
    );
    expect(error(await place(again, BUTTER_CHICKEN_AND_DAL(), { promoCode: 'WELCOME10' }))).toBe(
      'promo_limit_reached',
    );
    // Before verifying a number, only the session's own orders count.
    const anonymous = await guest('blr-indiranagar', { mode: 'dineIn', table: 9 }, false);
    expect((await validate(anonymous, 'WELCOME10', BUTTER_CHICKEN_AND_DAL())).status).toBe(200);
  });

  it('Nepal: NAMASTE15 paid online — service charge, then VAT, on the discounted items', async () => {
    const session = await guest('ktm-thamel', { mode: 'dineIn', table: 5 });
    const dal = lines('ktm-thamel', ['dal-makhani', 1]);
    const opened = await call('POST', 'payments', {
      purpose: 'order',
      sessionId: session.id,
      method: 'esewa',
      lines: dal,
      fulfilment: { mode: 'dineIn' },
      promoCode: 'NAMASTE15',
    });
    // रू 480 − 72 = 408 + service 40.80 + VAT 58.34 = रू 507.14 → रू 507.
    const payment = opened.body as Payment;
    expect(payment.amount).toBe(507);
    await call('POST', `payments/${payment.id}/simulate`, { outcome: 'succeeded' });
    const res = await place(session, dal, {
      method: 'esewa',
      paymentId: payment.id,
      promoCode: 'NAMASTE15',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      total: 507,
      discounts: [{ kind: 'code', code: 'NAMASTE15', amount: 72 }],
      payment: { status: 'paid' },
    });
  });
});

describe('happy hour on the server', () => {
  const drinks = () => lines('blr-indiranagar', ['cold-coffee', 2], ['dal-makhani', 1]);

  it('takes 20% off beverages inside the window, recorded on each item', async () => {
    now = HAPPY_HOUR;
    const session = await guest();
    const order = (await place(session, drinks())).body as Order;
    expect(order.items[0].offer).toEqual({ id: 'happy-hour', labelKey: 'happyHour', discount: 72 });
    expect(order.items[1].offer).toBeUndefined();
    // ₹657 − ₹72 = ₹585 + GST ₹29.25 = ₹614.25 → ₹614.
    expect(order).toMatchObject({
      itemTotal: 657,
      total: 614,
      discounts: [{ kind: 'offer', id: 'happy-hour', amount: 72 }],
    });
  });

  it('nothing outside it', async () => {
    const session = await guest();
    const order = (await place(session, drinks())).body as Order;
    expect(order.discounts).toBeUndefined();
    expect(order.total).toBe(690); // ₹657 + ₹32.85 = ₹689.85
  });

  it('Kathmandu time: 4:05 PM there is still 3:50 PM in Bengaluru', async () => {
    now = Date.parse('2026-10-08T10:20:00Z');
    const nepal = await guest('ktm-thamel', { mode: 'dineIn', table: 5 });
    const coffee = lines('ktm-thamel', ['cold-coffee', 1]);
    expect(((await place(nepal, coffee)).body as Order).discounts).toEqual([
      { kind: 'offer', id: 'happy-hour', labelKey: 'happyHour', amount: 57 },
    ]);
    const india = await guest();
    expect(
      ((await place(india, lines('blr-indiranagar', ['cold-coffee', 1]))).body as Order).discounts,
    ).toBeUndefined();
  });

  it('a payment opened during happy hour keeps its price after it ends', async () => {
    now = Date.parse('2026-10-08T18:59:00+05:30');
    const session = await guest();
    const opened = await call('POST', 'payments', {
      purpose: 'order',
      sessionId: session.id,
      method: 'online',
      lines: drinks(),
      fulfilment: { mode: 'dineIn' },
    });
    const payment = opened.body as Payment;
    expect(payment.amount).toBe(614);
    await call('POST', `payments/${payment.id}/simulate`, { outcome: 'succeeded' });
    now += 2 * MINUTE;
    const res = await place(session, drinks(), { method: 'online', paymentId: payment.id });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ total: 614, payment: { status: 'paid' } });
  });
});

describe('a running tab keeps its code', () => {
  it('works the code out again over every round (minimum and cap on the whole tab)', async () => {
    const session = await guest();
    const first = (
      await place(session, lines('blr-indiranagar', ['dal-makhani', 1]), {
        promoCode: 'WELCOME10',
      })
    ).body as Order;
    // ₹299 − ₹29.90 = ₹269.10 + GST ₹13.46 = ₹282.56 → ₹283.
    expect(first).toMatchObject({ total: 283, promoCode: 'WELCOME10' });

    now += MINUTE;
    const round = await call('POST', `orders/${first.id}/rounds`, {
      sessionId: session.id,
      lines: lines('blr-indiranagar', ['old-delhi-butter-chicken', 2], ['lamb-rogan-josh', 1]),
      kitchenNote: '',
    });
    const tab = round.body as Order;
    // ₹1,716: 10% = ₹171.60, capped at ₹100 → ₹1,616 + GST ₹80.80 = ₹1,696.80 → ₹1,697.
    expect(tab).toMatchObject({
      itemTotal: 1716,
      total: 1697,
      discounts: [{ kind: 'code', code: 'WELCOME10', amount: 100 }],
    });

    // Taking the round back leaves the first round's discount.
    const cancelled = await call('POST', `orders/${first.id}/cancel`, {
      sessionId: session.id,
      round: 2,
    });
    expect((cancelled.body as OrderChangeResponse).order).toMatchObject({
      total: 283,
      discounts: [{ kind: 'code', code: 'WELCOME10', amount: 29.9 }],
    });
  });
});
