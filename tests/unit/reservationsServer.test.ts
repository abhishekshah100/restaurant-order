import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiResponse } from '@/api/client';
import type {
  AdminSignInResponse,
  ApiErrorBody,
  ReservationInput,
  ReservationsResponse,
} from '@/api/contracts';
import { DEMO_ADMIN } from '@/api/mock/demoAdmin';
import { defaultConfig, orderLine, unitPrice } from '@/lib/cartLine';
import type { AdminFloorPlan, AdminTableDetail, Reservation } from '@/types/admin';
import type { Dish } from '@/types/menu';
import type { GuestSession } from '@/types/session';
import { createTestServer, testMenu } from '../apiState';

/*
 * Reservations on the mock server: booking a table (checked, no double booking), the list from
 * today on, seating, cancelling, no-shows and restoring, and what the floor plan makes of them —
 * reserved within the hour, seated until they order or the table is freed, the next booking.
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

async function signIn() {
  const res = await call('POST', 'admin/sessions', {
    identity: DEMO_ADMIN.email,
    password: DEMO_ADMIN.password,
  });
  admin = { authorization: `Bearer ${(res.body as AdminSignInResponse).token}` };
}

beforeEach(async () => {
  now = Date.parse('2026-10-15T13:00:00Z');
  window.localStorage.clear();
  window.sessionStorage.clear();
  await signIn();
});

/** 7:00 PM today at table 6 for Rahul, four guests, 90 minutes. */
const booking = (fields: Partial<ReservationInput> = {}): ReservationInput => ({
  table: 6,
  guestName: 'Rahul Mehta',
  phone: '9876501234',
  partySize: 4,
  at: '2026-10-15T13:30:00.000Z',
  ...fields,
  tables: fields.tables ?? [fields.table ?? 6],
});

const book = (fields?: Partial<ReservationInput>, headers = admin) =>
  call('POST', `${BASE}/reservations`, booking(fields), headers);
const setStatus = (id: string, status: string) =>
  call('PATCH', `${BASE}/reservations/${id}/status`, { status }, admin);
const list = async () =>
  ((await call('GET', `${BASE}/reservations`, undefined, admin)).body as ReservationsResponse)
    .reservations;
const tableOnFloor = async (table: number) =>
  ((await call('GET', `${BASE}/tables`, undefined, admin)).body as AdminFloorPlan).floors
    .flatMap((f) => f.tables)
    .find((t) => t.table === table);
const tablePage = async (table: number) =>
  (await call('GET', `${BASE}/tables/${table}`, undefined, admin)).body as AdminTableDetail;

const kebab = testMenu('blr-indiranagar').getDish('dahi-kebab') as Dish;

/** A guest at `table` orders on their phone. */
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

describe('POST /admin/branches/:branchId/reservations (mock)', () => {
  it('books a table: numbered, who took it, held 90 minutes, in the list', async () => {
    const res = await book({ note: '  Anniversary  ' });
    expect(res.status).toBe(201);
    expect(res.body as Reservation).toEqual({
      id: 'R1001',
      table: 6,
      tables: [6],
      guestName: 'Rahul Mehta',
      phone: '9876501234',
      partySize: 4,
      at: '2026-10-15T13:30:00.000Z',
      minutes: 90,
      note: 'Anniversary',
      status: 'booked',
      createdAt: '2026-10-15T13:00:00.000Z',
      createdBy: DEMO_ADMIN.name,
    });
    expect((await book({ table: 7 })).body).toMatchObject({ id: 'R1002' });
    expect((await list()).map((r) => r.id)).toEqual(['R1001', 'R1002']);
  });

  it('refuses a table another booking holds then, and says whose; back to back is fine', async () => {
    await book(); // 7:00–8:30 PM
    const clash = await book({ guestName: 'Isha', at: '2026-10-15T14:30:00.000Z' }); // 8:00 PM
    expect(clash.status).toBe(409);
    expect(clash.body as ApiErrorBody).toEqual({
      error: 'table_taken',
      table: 6,
      reservation: { id: 'R1001', guestName: 'Rahul Mehta', at: '2026-10-15T13:30:00.000Z' },
    });
    // An earlier booking running into it clashes too.
    expect((await book({ at: '2026-10-15T12:45:00.000Z', minutes: 60 })).status).toBe(409);
    expect((await book({ at: '2026-10-15T15:00:00.000Z' })).status).toBe(201); // 8:30 PM
    expect((await book({ table: 7, at: '2026-10-15T14:30:00.000Z' })).status).toBe(201);
  });

  it('checks the booking', async () => {
    const refused = [
      { guestName: '  ' },
      { partySize: 0 },
      { partySize: 21 },
      { phone: '12345' },
      { at: 'tonight' },
      { at: '2026-10-15T12:30:00.000Z' }, // half an hour ago
      { at: '2026-12-20T13:30:00.000Z' }, // over 60 days ahead
      { minutes: 45 },
      { note: 'x'.repeat(201) },
    ];
    for (const fields of refused) {
      expect((await book(fields)).status, JSON.stringify(fields)).toBe(400);
    }
    expect((await book({ table: 99 })).status).toBe(404);
    expect((await book({}, {})).status).toBe(401);
    // A party at the door, a few minutes after their time, is still taken.
    expect((await book({ at: '2026-10-15T12:50:00.000Z' })).status).toBe(201);
  });

  it('lists bookings from the start of today (branch time) on', async () => {
    await book({ at: '2026-10-17T14:30:00.000Z' }); // the day after tomorrow
    await book({ table: 2 });
    expect((await list()).map((r) => r.table)).toEqual([2, 6]);
    now = Date.parse('2026-10-16T19:00:00Z'); // 12:30 AM on the 17th
    await signIn(); // the morning's session has ended
    expect((await list()).map((r) => r.table)).toEqual([6]);
  });
});

describe('GET /admin/branches/:branchId/reservations?from=&to= (mock)', () => {
  it('lists the days asked for, for the history, and refuses a wrong range', async () => {
    await book();
    await book({ table: 7, at: '2026-10-16T13:30:00.000Z' });
    now = Date.parse('2026-10-18T06:00:00Z');
    await signIn();
    const between = async (query: string) =>
      call('GET', `${BASE}/reservations${query}`, undefined, admin);
    const ids = async (query: string) =>
      ((await between(query)).body as ReservationsResponse).reservations.map((r) => r.id);

    expect(await list()).toEqual([]);
    expect(await ids('?from=2026-10-15&to=2026-10-16')).toEqual(['R1001', 'R1002']);
    expect(await ids('?from=2026-10-16')).toEqual(['R1002']);
    expect((await between('?from=2026-10-16&to=2026-10-15')).status).toBe(400);
    expect((await between('?from=2026-01-01&to=2026-10-15')).status).toBe(400);
  });
});

describe('PATCH /admin/branches/:branchId/reservations/:id (mock)', () => {
  it('changes a booking, clearing what was left out, and checks the table is free', async () => {
    await book({ note: 'Window seat' });
    await book({ table: 7, guestName: 'Isha' });
    const res = await call(
      'PATCH',
      `${BASE}/reservations/R1001`,
      { table: 6, guestName: 'Rahul M.', partySize: 3, at: '2026-10-15T14:00:00.000Z' },
      admin,
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'R1001', guestName: 'Rahul M.', partySize: 3 });
    expect(res.body).not.toHaveProperty('note');
    expect(res.body).not.toHaveProperty('phone');
    const moved = await call('PATCH', `${BASE}/reservations/R1001`, booking({ table: 7 }), admin);
    expect(moved.status).toBe(409);
    expect((moved.body as ApiErrorBody).error).toBe('table_taken');
    expect((await call('PATCH', `${BASE}/reservations/R9`, booking(), admin)).status).toBe(404);
    await setStatus('R1001', 'cancelled');
    const closed = await call('PATCH', `${BASE}/reservations/R1001`, booking(), admin);
    expect((closed.body as ApiErrorBody).error).toBe('reservation_closed');
  });
});

describe('a party on several tables (mock)', () => {
  it('books them together, in one area, seating everyone; either is then taken', async () => {
    const party = await book({ table: 6, tables: [6, 7], partySize: 8, guestName: 'Office party' });
    expect(party.status).toBe(201);
    expect(party.body).toMatchObject({ table: 6, tables: [6, 7], partySize: 8 });
    const taken = await book({ table: 7 });
    expect(taken.body as ApiErrorBody).toMatchObject({ error: 'table_taken', table: 7 });
    // More guests than the table seats: refused.
    expect((await book({ table: 8, tables: [8], partySize: 16 })).status).toBe(400);
    // The floor plan shows the party at both tables.
    expect(await tableOnFloor(6)).toMatchObject({ booking: { id: 'R1001' } });
    expect(await tableOnFloor(7)).toMatchObject({ booking: { id: 'R1001' } });
  });
});

describe('PATCH /admin/branches/:branchId/reservations/:id/status (mock)', () => {
  it('seats the guests from an hour before; who and when', async () => {
    await book({ at: '2026-10-15T14:30:00.000Z' }); // 8:00 PM: 90 min away
    expect((await setStatus('R1001', 'seated')).status).toBe(409);
    now = Date.parse('2026-10-15T13:35:00Z'); // 55 min before
    const res = await setStatus('R1001', 'seated');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'seated',
      seatedAt: '2026-10-15T13:35:00.000Z',
      updatedAt: '2026-10-15T13:35:00.000Z',
      updatedBy: DEMO_ADMIN.name,
    });
    expect(((await setStatus('R1001', 'seated')).body as ApiErrorBody).error).toBe(
      'reservation_closed',
    );
  });

  it('marks a no-show only once its time has passed; restores it while the table is free', async () => {
    await book(); // 7:00 PM
    expect((await setStatus('R1001', 'noShow')).status).toBe(409);
    now = Date.parse('2026-10-15T13:50:00Z'); // 7:20 PM
    expect((await setStatus('R1001', 'noShow')).body).toMatchObject({ status: 'noShow' });
    expect((await setStatus('R1001', 'booked')).body).toMatchObject({ status: 'booked' });
    await setStatus('R1001', 'cancelled');
    await book({ guestName: 'Walk-in Isha', at: '2026-10-15T14:00:00.000Z' });
    const restore = await setStatus('R1001', 'booked');
    expect(restore.status).toBe(409);
    expect((restore.body as ApiErrorBody).error).toBe('table_taken');
  });

  it('cancels a booking, freeing its time; refuses unknown statuses and bookings', async () => {
    await book();
    expect((await setStatus('R1001', 'cancelled')).body).toMatchObject({ status: 'cancelled' });
    expect((await book({ guestName: 'Isha' })).status).toBe(201);
    expect((await setStatus('R1001', 'cancelled')).status).toBe(409);
    expect((await setStatus('R1001', 'lost')).status).toBe(400);
    expect((await setStatus('R404', 'seated')).status).toBe(404);
  });
});

describe('reservations on the floor plan (mock)', () => {
  it('shows a table reserved within the hour until half an hour after, then free', async () => {
    await book(); // 7:00 PM at table 6
    await book({ table: 7, guestName: 'Isha', at: '2026-10-15T16:00:00.000Z' }); // 9:30 PM
    expect(await tableOnFloor(6)).toMatchObject({
      status: 'reserved',
      booking: { id: 'R1001', guestName: 'Rahul Mehta', partySize: 4, status: 'booked' },
    });
    // A booking later today: free now, with the booking to come.
    expect(await tableOnFloor(7)).toMatchObject({
      status: 'available',
      booking: { id: 'R1002', at: '2026-10-15T16:00:00.000Z' },
    });
    expect((await tablePage(6)).reservations.map((r) => r.id)).toEqual(['R1001']);
    now = Date.parse('2026-10-15T14:00:00Z'); // 7:30 PM: 30 min late, still held
    expect((await tableOnFloor(6))?.status).toBe('reserved');
    now = Date.parse('2026-10-15T14:01:00Z');
    expect(await tableOnFloor(6)).toMatchObject({ status: 'available' });
    expect(await tableOnFloor(6)).not.toHaveProperty('booking');
  });

  it('shows seated guests until they order, and frees the table after', async () => {
    await book();
    await setStatus('R1001', 'seated');
    expect(await tableOnFloor(6)).toMatchObject({
      status: 'seated',
      seatedAt: '2026-10-15T13:00:00.000Z',
      booking: { id: 'R1001', status: 'seated' },
      freed: false,
    });
    now += 5 * 60_000;
    await guestOrder(6);
    expect((await tableOnFloor(6))?.status).toBe('ordering');
    now += 60_000;
    await call('POST', `${BASE}/tables/6/free`, undefined, admin);
    expect(await tableOnFloor(6)).toMatchObject({ status: 'available', freed: true });
  });

  it("a guest ordering at a reserved table makes it taken; cancelled and no-shows don't hold it", async () => {
    await book();
    await guestOrder(6);
    expect((await tableOnFloor(6))?.status).toBe('ordering');
    await book({ table: 7 });
    await setStatus('R1002', 'cancelled');
    expect(await tableOnFloor(7)).toMatchObject({ status: 'available' });
    expect((await tablePage(7)).reservations).toEqual([]);
  });
});
