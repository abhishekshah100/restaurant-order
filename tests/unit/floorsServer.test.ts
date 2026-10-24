import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiResponse } from '@/api/client';
import type { AdminSignInResponse, ApiErrorBody, TableQrCodesResponse } from '@/api/contracts';
import { DEMO_ADMIN } from '@/api/mock/demoAdmin';
import { defaultConfig, orderLine, unitPrice } from '@/lib/cartLine';
import type { AdminFloorPlan, FloorPlanLayout } from '@/types/admin';
import type { Branch } from '@/types/branch';
import type { Dish } from '@/types/menu';
import type { GuestSession } from '@/types/session';
import { createTestServer, testMenu } from '../apiState';

/*
 * Settings › Floor plan on the mock server: reading and saving the layout (the floors.json
 * shape), what follows it (the floor plan, table pages, QR codes, the tables guests can scan),
 * and what it refuses (a bad layout; a table left out while it has an open bill or a booking).
 */

let now = Date.parse('2026-10-15T13:00:00Z'); // 6:30 PM in Bengaluru
const server = createTestServer(() => now);
const call = (
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) => server({ method, path, body, headers }) as Promise<ApiResponse>;

const BASE = 'admin/branches/blr-indiranagar';
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

const layout = async () =>
  (await call('GET', `${BASE}/floors`, undefined, admin)).body as FloorPlanLayout;
const saveLayout = (body: unknown, headers = admin) =>
  call('PATCH', `${BASE}/floors`, body, headers);
const t = (number: number, seats = 4) => ({ number, seats, freed: false });

/** One area, "Main room": tables 1–4, 12 (the drawn history has a bill open there today) and a new 120. */
const oneArea: FloorPlanLayout = {
  floors: [
    { id: 'main', name: 'Main room', tables: [t(1), t(2), t(3, 6), t(4), t(12), t(120, 2)] },
  ],
};

const kebab = testMenu('blr-indiranagar').getDish('dahi-kebab') as Dish;

async function guestOrder(table: number) {
  const session = (
    await call('POST', 'sessions', { branchId: 'blr-indiranagar', mode: 'dineIn', table })
  ).body as GuestSession;
  await call('POST', 'otp', { sessionId: session.id, phone: '9876543210' });
  await call('POST', 'otp/verify', { sessionId: session.id, phone: '9876543210', code: '123456' });
  const config = defaultConfig(kebab);
  return call('POST', 'orders', {
    sessionId: session.id,
    customerName: 'Rahul Mehta',
    method: 'counter',
    kitchenNote: '',
    lines: [orderLine({ ...config, key: 'k', quantity: 1, unitPrice: unitPrice(kebab, config) })],
    fulfilment: { mode: 'dineIn' },
  });
}

describe('GET and PATCH /admin/branches/:branchId/floors (mock)', () => {
  it("reads the branch's floors.json until staff save their own", async () => {
    const before = await layout();
    expect(before.floors.map((f) => f.id)).toEqual(['ground', 'first', 'outdoor']);
    expect((await call('GET', `${BASE}/floors`)).status).toBe(401);
  });

  it('saves a layout, and the floor plan, table pages and QR codes follow it', async () => {
    const res = await saveLayout(oneArea);
    expect(res.status).toBe(200);
    expect(await layout()).toEqual(oneArea);

    const plan = (await call('GET', `${BASE}/tables`, undefined, admin)).body as AdminFloorPlan;
    expect(plan.floors.map((f) => [f.id, f.name, f.tables.map((tb) => tb.table)])).toEqual([
      ['main', 'Main room', [1, 2, 3, 4, 12, 120]],
    ]);
    expect((await call('GET', `${BASE}/tables/120`, undefined, admin)).status).toBe(200);
    expect((await call('GET', `${BASE}/tables/9`, undefined, admin)).status).toBe(404);
    const qr = (await call('GET', `${BASE}/tables/qr-codes`, undefined, admin))
      .body as TableQrCodesResponse;
    expect(qr.codes.map((c) => c.table)).toEqual([1, 2, 3, 4, 12, 120]);
  });

  it('lets guests scan a table numbered beyond the branch’s range once it’s on the plan', async () => {
    await call(
      'PATCH',
      'admin/branches/ktm-thamel/floors',
      {
        floors: [{ id: 'ground', name: 'Ground floor', tables: [t(1), t(55)] }],
      },
      admin,
    );
    const scan = await call('POST', 'sessions', {
      branchId: 'ktm-thamel',
      mode: 'dineIn',
      table: 55,
    });
    expect(scan.status).toBe(201);
    // Guests aren't sent the table numbers: the server checks them.
    const branches = (await call('GET', 'branches')).body as Branch[];
    expect(branches.find((b) => b.id === 'ktm-thamel')).not.toHaveProperty('tables');
  });

  it('refuses a layout that is malformed or breaks the rules', async () => {
    const bad = (body: unknown) => saveLayout(body).then((r) => r.status);
    expect(await bad({ floors: 'nope' })).toBe(400);
    expect(await bad({ floors: [] })).toBe(400);
    expect(await bad({ floors: [{ id: 'a', name: 'A', tables: [t(1), t(1)] }] })).toBe(400);
    expect(await bad({ floors: [{ id: 'a', name: '', tables: [t(1)] }] })).toBe(400);
    expect(await bad({ floors: [{ id: 'a', name: 'A', tables: [t(1, 0)] }] })).toBe(400);
    expect(await bad({ floors: [{ id: 'a', name: 'A', tables: [t(10000)] }] })).toBe(400);
    expect((await layout()).floors).toHaveLength(3);
  });

  it("won't drop a table with an open order or a booking to come, and says which", async () => {
    expect((await guestOrder(5)).status).toBe(201);
    await call(
      'POST',
      `${BASE}/reservations`,
      { table: 7, guestName: 'Isha', partySize: 2, at: '2026-10-15T14:30:00.000Z' },
      admin,
    );
    const current = await layout();
    const without = {
      floors: current.floors.map((f) =>
        f.id === 'ground'
          ? { ...f, tables: f.tables.filter((tb) => ![5, 7, 8].includes(tb.number)) }
          : f,
      ),
    };
    const res = await saveLayout(without);
    expect(res.status).toBe(409);
    expect(res.body as ApiErrorBody).toEqual({
      error: 'table_in_use',
      tables: [
        { number: 5, reason: 'openOrder', change: 'removed' },
        { number: 7, reason: 'booking', change: 'removed' },
      ],
    });
    // Table 8 alone can go.
    const onlyEight = {
      floors: current.floors.map((f) =>
        f.id === 'ground' ? { ...f, tables: f.tables.filter((tb) => tb.number !== 8) } : f,
      ),
    };
    expect((await saveLayout(onlyEight)).status).toBe(200);
  });

  it('takes a table out of service: kept on the plan, nobody can order at it or book it', async () => {
    const off = (current: FloorPlanLayout, number: number, disabled = true) => ({
      floors: current.floors.map((f) => ({
        ...f,
        tables: f.tables.map((tb) => (tb.number === number ? { ...tb, disabled } : tb)),
      })),
    });
    // With an order open at it, not yet.
    expect((await guestOrder(5)).status).toBe(201);
    const refused = await saveLayout(off(await layout(), 5));
    expect(refused.body as ApiErrorBody).toEqual({
      error: 'table_in_use',
      tables: [{ number: 5, reason: 'openOrder', change: 'disabled' }],
    });

    expect((await saveLayout(off(await layout(), 3))).status).toBe(200);
    const plan = (await call('GET', `${BASE}/tables`, undefined, admin)).body as AdminFloorPlan;
    expect(plan.floors[0].tables.find((tb) => tb.table === 3)).toMatchObject({
      status: 'outOfService',
      disabled: true,
    });
    // Guests, waiters and bookings are turned away.
    const scan = await call('POST', 'sessions', {
      branchId: 'blr-indiranagar',
      mode: 'dineIn',
      table: 3,
    });
    expect(scan).toEqual({ status: 409, body: { error: 'table_disabled' } });
    const waiter = await call(
      'POST',
      `${BASE}/tables/3/orders`,
      { customerName: 'Walk-in', lines: [] },
      admin,
    );
    expect((waiter.body as ApiErrorBody).error).toBe('table_disabled');
    const booking = await call(
      'POST',
      `${BASE}/reservations`,
      { table: 3, guestName: 'Isha', partySize: 2, at: '2026-10-15T14:30:00.000Z' },
      admin,
    );
    expect((booking.body as ApiErrorBody).error).toBe('table_disabled');

    // Back in service, it works again.
    expect((await saveLayout(off(await layout(), 3, false))).status).toBe(200);
    expect((await guestOrder(3)).status).toBe(201);
  });
});
