import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiResponse } from '@/api/client';
import type {
  AdminBranchesResponse,
  AdminSignInResponse,
  ApiErrorBody,
  BranchSettingsResponse,
} from '@/api/contracts';
import { DEMO_ADMIN } from '@/api/mock/demoAdmin';
import { defaultConfig, orderLine, unitPrice } from '@/lib/cartLine';
import type { AdminBranch, FloorPlanLayout } from '@/types/admin';
import type { Branch } from '@/types/branch';
import type { BranchDetails } from '@/types/branchSettings';
import type { Dish, MenuData } from '@/types/menu';
import type { BranchPromotions } from '@/types/promotion';
import type { GuestSession } from '@/types/session';
import { createTestServer, testMenu, testPromotions } from '../apiState';

/*
 * Settings on the mock server: reading and saving a branch's settings (GET and PATCH
 * …/settings) and what follows them (GET /branches, guests' orders); adding a branch as a copy
 * of another (POST /admin/branches) and removing one (DELETE), never the last.
 */

let now = Date.parse('2026-10-15T13:00:00Z'); // Thursday, 6:30 PM in Bengaluru
const server = createTestServer(() => now);
const call = (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) => server({ method, path, body, headers }) as Promise<ApiResponse>;

const BLR = 'admin/branches/blr-indiranagar';
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

const settings = async (base = BLR) =>
  (await call('GET', `${base}/settings`, undefined, admin)).body as BranchSettingsResponse;
const save = (body: unknown, base = BLR) => call('PATCH', `${base}/settings`, body, admin);
const guestBranches = async () => (await call('GET', 'branches')).body as Branch[];
const guestBranch = async (id = 'blr-indiranagar') =>
  (await guestBranches()).find((b) => b.id === id) as Branch;
const adminBranches = async () =>
  ((await call('GET', 'admin/branches', undefined, admin)).body as AdminBranchesResponse).branches;

const kebab = testMenu('blr-indiranagar').getDish('dahi-kebab') as Dish;

async function guestOrder(branchId = 'blr-indiranagar') {
  const session = (await call('POST', 'sessions', { branchId, mode: 'dineIn', table: 5 }))
    .body as GuestSession;
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

describe('GET and PATCH /admin/branches/:branchId/settings (mock)', () => {
  it("reads the branch's settings and the region's payment choices, for its admins only", async () => {
    const { settings: s, choices } = await settings();
    expect(s.details.shortName).toBe('Udyog Vihar');
    expect(s.hours.days.thu).toEqual({ open: true, opens: '11:00', closes: '21:00' });
    expect(s.tax.lines.map((l) => l.rateBp)).toEqual([500]);
    expect(s.delivery.zones).toHaveLength(3);
    expect(choices.payments.checkout.map((c) => c.id)).toEqual(['online', 'counter']);
    expect((await call('GET', `${BLR}/settings`)).status).toBe(401);
    expect((await call('GET', 'admin/branches/nowhere/settings', undefined, admin)).status).toBe(
      403,
    );
  });

  it('saves a section, keeps the others, and guests see it in GET /branches', async () => {
    const before = await settings();
    const tax = { ...before.settings.tax, serviceChargeBp: 750 };
    const res = await save({ tax });
    expect(res.status).toBe(200);
    const after = res.body as BranchSettingsResponse;
    expect(after.settings.tax.serviceChargeBp).toBe(750);
    expect(after.settings.details).toEqual(before.settings.details);

    const branch = await guestBranch();
    expect(branch.tax.serviceCharge).toEqual({ labelKey: 'serviceCharge', rateBp: 750 });
    // Still today's hours and status on top.
    expect(branch.hoursToday).toBe('11:00 AM – 9:00 PM');
  });

  it("closes the branch on a day it's shut, and guests' orders are refused", async () => {
    const { settings: s } = await settings();
    const hours = {
      ...s.hours,
      days: { ...s.hours.days, thu: { ...s.hours.days.thu, open: false } },
    };
    expect((await save({ hours })).status).toBe(200);
    expect(await guestBranch()).toMatchObject({
      status: 'closed',
      reopensOn: 'fri',
      reopensTomorrow: true,
      hoursToday: 'Closed today',
    });
    const refused = await guestOrder();
    expect(refused.status).toBe(409);
    expect((refused.body as ApiErrorBody).error).toBe('ordering_unavailable');
    // Staff opening from the admin bar wins for the day.
    await call('PATCH', `${BLR}/status`, { status: 'open' }, admin);
    expect((await guestBranch()).status).toBe('open');
  });

  it('gives new delivery zones ids and turns pickup off', async () => {
    const { settings: s } = await settings();
    const zone = {
      name: 'Old Airport Road',
      areas: ['Murugeshpalya'],
      fee: 59,
      minOrder: 349,
      etaMinutes: 45,
    };
    const res = await save({
      delivery: { ...s.delivery, zones: [...s.delivery.zones, zone] },
      pickup: { ...s.pickup, enabled: false },
    });
    expect(res.status).toBe(200);
    const branch = await guestBranch();
    expect(branch.modes.delivery.zones.at(-1)).toEqual({ id: 'old-airport-road', ...zone });
    expect(branch.modes.takeaway.enabled).toBe(false);
    // Payment methods weren't touched.
    expect(branch.modes.takeaway.payments.map((p) => p.id)).toEqual(['online', 'pickup']);
  });

  it('refuses what the pages would refuse, an unknown section and an empty body', async () => {
    const { settings: s } = await settings();
    const bad = (body: unknown) => save(body).then((r) => r.status);
    expect(await bad({ details: { ...s.details, phone: '+9779852024631' } })).toBe(400);
    expect(await bad({ details: { ...s.details, shortName: 'thamel' } })).toBe(400);
    expect(await bad({ tax: { ...s.tax, lines: [{ ...s.tax.lines[0], rateBp: 9000 }] } })).toBe(
      400,
    );
    expect(
      await bad({
        payments: { ...s.payments, checkout: { methods: ['esewa'], recommended: null } },
      }),
    ).toBe(400);
    expect(await bad({ pickup: { ...s.pickup, slotMinutes: 7 } })).toBe(400);
    expect(await bad({ colour: 'green' })).toBe(400);
    expect(await bad({})).toBe(400);
    expect((await settings()).settings).toEqual(s);
  });
});

describe('POST and DELETE /admin/branches (mock)', () => {
  const details: BranchDetails = {
    name: 'The Olive Table — Sector 29',
    shortName: 'Sector 29',
    city: 'Gurgaon',
    address: 'Sector 29, Gurgaon',
    phone: '+91 98111 22233',
    wifiName: '',
    tableLocation: '',
  };
  const add = (body: unknown) => call('POST', 'admin/branches', body, admin);

  it('adds a branch as a copy of another, with its own details, for guests and staff', async () => {
    const res = await add({ details, copyFrom: 'blr-indiranagar' });
    expect(res.status).toBe(201);
    const created = res.body as AdminBranch;
    expect(created).toMatchObject({
      id: 'gurgaon-sector-29',
      name: 'The Olive Table — Sector 29',
      shortName: 'Sector 29',
      status: 'open',
      currencyCode: 'INR',
    });
    expect((await adminBranches()).map((b) => b.id)).toEqual([
      'blr-indiranagar',
      'ktm-thamel',
      'gurgaon-sector-29',
    ]);

    const branch = await guestBranch('gurgaon-sector-29');
    expect(branch.phone).toBe('+919811122233');
    expect(branch.tax).toEqual((await guestBranch()).tax);
    expect(branch.image).toBeUndefined();

    // Its menu, promotions and floor plan are the source's.
    const base = `branches/gurgaon-sector-29`;
    const menu = (await call('GET', `${base}/menu`)).body as MenuData;
    expect(menu.dishes.length).toBe(testMenu('blr-indiranagar').dishes.length);
    const promos = (await call('GET', `${base}/promotions`)).body as BranchPromotions;
    expect(promos).toEqual(testPromotions('blr-indiranagar'));
    const floors = (await call('GET', `admin/${base}/floors`, undefined, admin))
      .body as FloorPlanLayout;
    expect(floors.floors.length).toBeGreaterThan(0);

    // Its settings are its own from now on.
    const own = await settings(`admin/${base}`);
    expect(own.settings.details.shortName).toBe('Sector 29');
    await save({ pickup: { ...own.settings.pickup, slotMinutes: 30 } }, `admin/${base}`);
    expect((await guestBranch('gurgaon-sector-29')).modes.takeaway.slotMinutes).toBe(30);
    expect((await guestBranch()).modes.takeaway.slotMinutes).toBe(15);

    // Guests can order there.
    expect((await guestOrder('gurgaon-sector-29')).status).toBe(201);
  });

  it("refuses a short name that's taken, the wrong country code and an unknown source", async () => {
    const status = (body: unknown) => add(body).then((r) => r.status);
    expect(
      await status({ details: { ...details, shortName: 'Thamel' }, copyFrom: 'blr-indiranagar' }),
    ).toBe(400);
    expect(await status({ details, copyFrom: 'ktm-thamel' })).toBe(400);
    expect(await status({ details, copyFrom: 'nowhere' })).toBe(400);
    expect((await call('POST', 'admin/branches', { details, copyFrom: 'ktm-thamel' })).status).toBe(
      401,
    );
  });

  it('removes a branch, never one with orders to settle, and never the last', async () => {
    const remove = (id: string) => call('DELETE', `admin/branches/${id}`, undefined, admin);
    // Udyog Vihar has bills open today (the drawn history).
    const inUse = await remove('blr-indiranagar');
    expect(inUse.status).toBe(409);
    expect((inUse.body as ApiErrorBody).error).toBe('branch_in_use');

    expect((await remove('ktm-thamel')).status).toBe(204);
    expect((await adminBranches()).map((b) => b.id)).toEqual(['blr-indiranagar']);
    expect((await guestBranches()).map((b) => b.id)).toEqual(['blr-indiranagar']);
    expect((await call('GET', 'admin/branches/ktm-thamel/settings', undefined, admin)).status).toBe(
      403,
    );

    const last = await remove('blr-indiranagar');
    expect(last.status).toBe(409);
    expect((last.body as ApiErrorBody).error).toBe('last_branch');

    // A new branch never takes a removed one's id.
    const res = await add({
      details: { ...details, city: 'Kathmandu', shortName: 'Thamel', phone: '+919811122233' },
      copyFrom: 'blr-indiranagar',
    });
    expect((res.body as AdminBranch).id).toBe('kathmandu-thamel');
  });
});
