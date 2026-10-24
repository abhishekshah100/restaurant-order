import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiResponse } from '@/api/client';
import type { AdminSignInResponse, ApiErrorBody } from '@/api/contracts';
import { DEMO_ADMIN } from '@/api/mock/demoAdmin';
import { defaultConfig, orderLine, unitPrice } from '@/lib/cartLine';
import type { AdminBranch } from '@/types/admin';
import type { Branch } from '@/types/branch';
import type { Dish } from '@/types/menu';
import type { GuestSession } from '@/types/session';
import { createTestServer, testMenu } from '../apiState';

/*
 * The branch's status on the mock server: staff pause new orders (back by itself after the
 * minutes), close for the rest of the day (open again the next day), or open again; GET
 * /branches reports it to guests, whose orders are refused meanwhile while waiters' aren't.
 */

let now = Date.parse('2026-10-15T13:00:00Z'); // 6:30 PM in Bengaluru
const server = createTestServer(() => now);
const call = (
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) => server({ method, path, body, headers }) as Promise<ApiResponse>;

let admin: Record<string, string>;

beforeEach(async () => {
  now = Date.parse('2026-10-15T13:00:00Z');
  window.localStorage.clear();
  window.sessionStorage.clear();
  const res = await call('POST', 'admin/sessions', {
    identity: DEMO_ADMIN.email,
    password: DEMO_ADMIN.password,
  });
  admin = { authorization: `Bearer ${(res.body as AdminSignInResponse).token}` };
});

const setStatus = (body: unknown, headers = admin) =>
  call('PATCH', 'admin/branches/blr-indiranagar/status', body, headers);
const guestBranch = async () =>
  ((await call('GET', 'branches')).body as Branch[]).find((b) => b.id === 'blr-indiranagar');
const adminBranch = async () =>
  ((await call('GET', 'admin/branches', undefined, admin)).body as { branches: AdminBranch[] })
    .branches[0];

const kebab = testMenu('blr-indiranagar').getDish('dahi-kebab') as Dish;
const lines = () => {
  const config = defaultConfig(kebab);
  return [orderLine({ ...config, key: 'k', quantity: 1, unitPrice: unitPrice(kebab, config) })];
};

async function guestOrder() {
  const session = (
    await call('POST', 'sessions', {
      branchId: 'blr-indiranagar',
      mode: 'dineIn',
      table: 5,
    })
  ).body as GuestSession;
  await call('POST', 'otp', { sessionId: session.id, phone: '9876543210' });
  await call('POST', 'otp/verify', { sessionId: session.id, phone: '9876543210', code: '123456' });
  return call('POST', 'orders', {
    sessionId: session.id,
    customerName: 'Ananya Rao',
    method: 'counter',
    kitchenNote: '',
    lines: lines(),
    fulfilment: { mode: 'dineIn' },
  });
}

describe('PATCH /admin/branches/:branchId/status (mock)', () => {
  it('pauses new orders for a while: guests see it, then it opens by itself', async () => {
    const res = await setStatus({ status: 'paused', minutes: 30 });
    expect(res.status).toBe(200);
    expect(res.body as AdminBranch).toMatchObject({
      status: 'paused',
      statusUntil: '2026-10-15T13:30:00.000Z',
    });
    expect(await guestBranch()).toMatchObject({
      status: 'paused',
      statusUntil: '2026-10-15T13:30:00.000Z',
    });
    now += 10 * 60_000;
    // What guests' ordering pages poll: the status alone, as in the whole list.
    const status = await call('GET', 'branches/blr-indiranagar/status');
    // The pause holds for every way of ordering.
    const paused = { status: 'paused', statusUntil: '2026-10-15T13:30:00.000Z' };
    expect(status.body).toEqual({
      id: 'blr-indiranagar',
      ...paused,
      modeStatus: { takeaway: paused, delivery: paused },
    });
    expect((await call('GET', 'branches/nowhere/status')).status).toBe(404);
    expect((await adminBranch()).status).toBe('paused');
    now += 21 * 60_000;
    // The pause is over: the week again, open until last orders at 8:30 PM (15:00 UTC).
    expect(await guestBranch()).toMatchObject({
      status: 'open',
      statusUntil: '2026-10-15T15:00:00.000Z',
    });
    expect((await adminBranch()).statusUntil).toBe('2026-10-15T15:00:00.000Z');
  });

  it('closes for the rest of today: open again the next day (branch time)', async () => {
    await setStatus({ status: 'closed' });
    // Opens again at tomorrow's opening time: guests and staff are told the same moment.
    expect(await guestBranch()).toMatchObject({
      status: 'closed',
      statusUntil: '2026-10-16T05:30:00.000Z',
    });
    const until = (await adminBranch()).statusUntil ?? '';
    expect(new Date(until).toISOString()).toBe('2026-10-16T05:30:00.000Z');
    now = Date.parse('2026-10-15T18:00:00Z'); // 11:30 PM: still today
    expect((await guestBranch())?.status).toBe('closed');
    now = Date.parse('2026-10-15T19:00:00Z'); // 12:30 AM the next day: before it opens
    expect((await guestBranch())?.status).toBe('closed');
    now = Date.parse('2026-10-16T05:30:00Z'); // 11:00 AM: the closure is over, and it opens
    expect((await guestBranch())?.status).toBe('open');
  });

  it('opens again at once', async () => {
    await setStatus({ status: 'paused', minutes: 60 });
    await setStatus({ status: 'open' });
    expect((await guestBranch())?.status).toBe('open');
  });

  it("refuses guests' orders while paused or closed; waiters can still take them", async () => {
    await setStatus({ status: 'paused', minutes: 15 });
    const refused = await guestOrder();
    expect(refused.status).toBe(409);
    expect((refused.body as ApiErrorBody).error).toBe('ordering_unavailable');
    const byWaiter = await call(
      'POST',
      'admin/branches/blr-indiranagar/tables/6/orders',
      { customerName: 'Table 6 guest', lines: lines() },
      admin,
    );
    expect(byWaiter.status).toBe(201);
    await setStatus({ status: 'open' });
    expect((await guestOrder()).status).toBe(201);
  });

  it('refuses another status or pause length, and needs a staff session', async () => {
    expect((await setStatus({ status: 'paused', minutes: 20 })).status).toBe(400);
    expect((await setStatus({ status: 'busy' })).status).toBe(400);
    expect((await setStatus({ status: 'open' }, {})).status).toBe(401);
  });
});
