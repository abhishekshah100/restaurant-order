import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiResponse } from '@/api/client';
import type {
  AdminSignInResponse,
  ApiErrorBody,
  BranchServiceResponse,
  CreateServiceRequestResponse,
  FloorPlanResponse,
  ResolveRequestResponse,
  ServiceRequestListResponse,
  TableDetailResponse,
} from '@/api/contracts';
import { MOCK_KEYS } from '@/api/mock/db';
import { DEMO_ADMIN } from '@/api/mock/demoAdmin';
import { MINUTE_MS } from '@/api/mock/rules';
import { defaultConfig, orderLine, unitPrice } from '@/lib/cartLine';
import type { Dish } from '@/types/menu';
import type { Order } from '@/types/order';
import type { GuestSession } from '@/types/session';
import { createTestServer, testMenu } from '../apiState';

/*
 * The floor staff's endpoints on the mock server: GET /admin/branches/:branchId/service (counts,
 * queue, tables), POST /admin/service-requests/:id/resolve and POST /admin/orders/:id/served,
 * with what the guest sees afterwards. Dine-in food is ready 18 minutes after it's ordered.
 */

const START = Date.parse('2026-10-14T19:00:00+05:30');
const READY_AFTER = 18 * MINUTE_MS;
let now = START;
const server = createTestServer(() => now);

const call = (
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) => server({ method, path, body, headers }) as Promise<ApiResponse>;
const error = (res: ApiResponse) => (res.body as ApiErrorBody).error;

const PHONES = { 'blr-indiranagar': '9876543210', 'ktm-thamel': '9841234567' } as const;
type BranchId = keyof typeof PHONES;

let admin: Record<string, string>;

beforeEach(async () => {
  now = START;
  window.localStorage.clear();
  window.sessionStorage.clear();
  const res = await call('POST', 'admin/sessions', {
    identity: DEMO_ADMIN.email,
    password: DEMO_ADMIN.password,
  });
  admin = { authorization: `Bearer ${(res.body as AdminSignInResponse).token}` };
});

async function guest(
  branchId: BranchId = 'blr-indiranagar',
  start: Record<string, unknown> = { mode: 'dineIn', table: 12 },
): Promise<GuestSession> {
  const session = (await call('POST', 'sessions', { branchId, ...start })).body as GuestSession;
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

async function place(session: GuestSession, extra: Record<string, unknown> = {}): Promise<Order> {
  const res = await call('POST', 'orders', {
    sessionId: session.id,
    customerName: 'Ananya Rao',
    method: 'counter',
    kitchenNote: '',
    lines: linesOf(session.branchId),
    fulfilment: { mode: 'dineIn' },
    ...extra,
  });
  expect(res.status).toBe(201);
  return res.body as Order;
}

const callWaiter = async (session: GuestSession, reason = 'water', note?: string) =>
  (
    (
      await call('POST', 'service-requests', {
        sessionId: session.id,
        kind: 'waiter',
        reason,
        note,
      })
    ).body as CreateServiceRequestResponse
  ).request;

const floor = async (branchId: BranchId = 'blr-indiranagar') => {
  const res = await call('GET', `admin/branches/${branchId}/service`, undefined, admin);
  expect(res.status).toBe(200);
  return res.body as BranchServiceResponse;
};

const served = (orderId: string, body: unknown = {}, headers = admin) =>
  call('POST', `admin/orders/${orderId}/served`, body, headers);

describe('GET /admin/branches/:branchId/service (mock)', () => {
  it('counts and lists what needs doing at the branch', async () => {
    const atTwelve = await guest();
    const atFive = await guest('blr-indiranagar', { mode: 'dineIn', table: 5 });
    await callWaiter(atTwelve, 'water', '  No ice, please  ');
    now += MINUTE_MS;
    await call('POST', 'service-requests', { sessionId: atFive.id, kind: 'bill', scope: 'table' });
    const order = await place(atFive);

    let service = await floor();
    expect(service.counts).toEqual({
      waiterCalls: 1,
      billRequests: 1,
      readyToServe: 0,
      // The drawn history's two unpaid orders at table 12 today, and the new one.
      unpaid: 3,
    });
    expect(service.requests.map((r) => [r.kind, r.table])).toEqual([
      ['waiter', 12],
      ['bill', 5],
    ]);
    expect(service.requests[0]).toMatchObject({ reason: 'water', note: 'No ice, please' });
    expect(service.orders.find((o) => o.id === order.id)).toMatchObject({
      id: order.id,
      table: 5,
      status: 'received',
      itemCount: 2,
      due: order.total,
      readyRounds: [],
    });
    expect(service.tables.find((t) => t.table === 12)?.status).toBe('needsWaiter');
    expect(service.tables.find((t) => t.table === 5)?.status).toBe('wantsBill');

    // Ready 18 minutes after it was ordered: on the queue (and counted) until it's served.
    now = Date.parse(order.placedAt) + READY_AFTER;
    service = await floor();
    expect(service.counts.readyToServe).toBe(1);
    expect(service.orders.find((o) => o.id === order.id)?.readyRounds).toEqual([
      { round: 1, itemCount: 2, readyAt: new Date(now).toISOString() },
    ]);
  });

  it('keeps each branch to its own requests and orders', async () => {
    await callWaiter(await guest('ktm-thamel', { mode: 'dineIn', table: 4 }));
    expect((await floor()).counts.waiterCalls).toBe(0);
    const thamel = await floor('ktm-thamel');
    expect(thamel.counts.waiterCalls).toBe(1);
    expect(thamel.tables).toEqual([
      expect.objectContaining({ table: 4, status: 'needsWaiter', orderCount: 0 }),
    ]);
  });

  it('shows takeaway orders without a table, and their ready round', async () => {
    const away = await guest('ktm-thamel', { mode: 'takeaway' });
    const order = await place(away, {
      method: 'pickup',
      fulfilment: { mode: 'takeaway', pickupAt: null },
    });
    now = Date.parse(order.pickup!.at);
    const service = await floor('ktm-thamel');
    const summary = service.orders.find((o) => o.id === order.id);
    expect(summary).toMatchObject({ mode: 'takeaway', status: 'ready' });
    expect(summary).not.toHaveProperty('table');
    expect(service.counts.readyToServe).toBe(1);
    expect(service.tables).toEqual([]);
  });

  it('answers 401 without a session and 403 for a branch the admin does not manage', async () => {
    const anonymous = await call('GET', 'admin/branches/blr-indiranagar/service');
    expect(anonymous.status).toBe(401);
    expect(error(anonymous)).toBe('unauthorized');
    const other = await call('GET', 'admin/branches/nowhere/service', undefined, admin);
    expect(other.status).toBe(403);
    expect(error(other)).toBe('forbidden');
  });
});

describe('POST /admin/service-requests/:id/resolve (mock)', () => {
  it("takes the request off the queue and the guest's pending list, idempotently", async () => {
    const session = await guest();
    const request = await callWaiter(session);
    now += 2 * MINUTE_MS;

    const res = await call(
      'POST',
      `admin/service-requests/${request.id}/resolve`,
      undefined,
      admin,
    );
    expect(res.status).toBe(200);
    const { request: resolved } = res.body as ResolveRequestResponse;
    expect(resolved).toMatchObject({ id: request.id, resolvedAt: new Date(now).toISOString() });

    expect((await floor()).counts.waiterCalls).toBe(0);
    const pending = await call('GET', `sessions/${session.id}/service-requests`);
    expect((pending.body as ServiceRequestListResponse).requests).toEqual([]);

    now += MINUTE_MS;
    const again = await call(
      'POST',
      `admin/service-requests/${request.id}/resolve`,
      undefined,
      admin,
    );
    expect(again.body).toEqual(res.body);
    // The guest can call again: a new request.
    expect((await callWaiter(session)).id).not.toBe(request.id);
  });

  it('is kept in localStorage, where staff in another tab can read it', async () => {
    const request = await callWaiter(await guest());
    expect(window.localStorage.getItem(MOCK_KEYS.serviceRequests)).toContain(request.id);
    expect(window.sessionStorage.getItem(MOCK_KEYS.serviceRequests)).toBeNull();
  });

  it('answers 404 for an unknown or lapsed request, 401 and 403 as the service read', async () => {
    const missing = await call('POST', 'admin/service-requests/nope/resolve', undefined, admin);
    expect(missing.status).toBe(404);
    expect(error(missing)).toBe('not_found');

    const request = await callWaiter(await guest());
    const anonymous = await call('POST', `admin/service-requests/${request.id}/resolve`);
    expect(anonymous.status).toBe(401);

    now += 30 * MINUTE_MS;
    const lapsed = await call(
      'POST',
      `admin/service-requests/${request.id}/resolve`,
      undefined,
      admin,
    );
    expect(lapsed.status).toBe(404);
  });
});

describe('POST /admin/orders/:id/served (mock)', () => {
  it('serves a ready order: it leaves the queue and the guest sees Served', async () => {
    const session = await guest();
    const order = await place(session);
    expect(error(await served(order.id))).toBe('not_ready');

    now = Date.parse(order.placedAt) + READY_AFTER + MINUTE_MS;
    const res = await served(order.id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: order.id, status: 'served', live: false });

    const tracked = (await call('GET', `orders/${order.id}`)).body as Order;
    expect(tracked.status).toBe('served');
    expect(tracked.items.every((item) => item.status === 'served')).toBe(true);
    expect((await floor()).counts.readyToServe).toBe(0);

    // Idempotent.
    expect((await served(order.id)).body).toEqual(res.body);
  });

  it('serves one round of a running order', async () => {
    const session = await guest();
    const order = await place(session);
    now += 2 * MINUTE_MS;
    const second = await call('POST', `orders/${order.id}/rounds`, {
      sessionId: session.id,
      lines: linesOf(session.branchId, 'dahi-kebab', 1),
      kitchenNote: '',
    });
    expect(second.status).toBe(201);

    // Both rounds ready (the first is served by the kitchen's own timing at 22 minutes).
    now = Date.parse(order.placedAt) + READY_AFTER + 2 * MINUTE_MS;
    expect((await floor()).counts.readyToServe).toBe(2);

    expect(error(await served(order.id, { round: 3 }))).toBe('invalid_request');
    const res = await served(order.id, { round: 1 });
    const rounds = (res.body as Order).rounds!;
    expect(rounds.map((r) => r.status)).toEqual(['served', 'ready']);
    const service = await floor();
    expect(service.counts.readyToServe).toBe(1);
    expect(service.orders.find((o) => o.id === order.id)?.readyRounds).toEqual([
      expect.objectContaining({ round: 2, itemCount: 1 }),
    ]);
  });

  it('hands a takeaway order over: Picked up', async () => {
    const away = await guest('ktm-thamel', { mode: 'takeaway' });
    const order = await place(away, {
      method: 'pickup',
      fulfilment: { mode: 'takeaway', pickupAt: null },
    });
    now = Date.parse(order.pickup!.at) + MINUTE_MS;
    expect((await served(order.id)).body).toMatchObject({ status: 'pickedUp' });
  });

  it('answers 404, 401 and 403', async () => {
    expect(error(await served('Z999'))).toBe('not_found');
    const order = await place(await guest());
    expect((await served(order.id, {}, {})).status).toBe(401);

    // The drawn history is already served (A097) or still cooking (A101).
    expect((await served('A097')).status).toBe(200);
    expect(error(await served('A101'))).toBe('not_ready');
  });
});

describe('GET /admin/branches/:branchId/tables (mock)', () => {
  const plan = async (branchId: BranchId = 'blr-indiranagar') => {
    const res = await call('GET', `admin/branches/${branchId}/tables`, undefined, admin);
    expect(res.status).toBe(200);
    return res.body as FloorPlanResponse;
  };
  const tableFive = async () =>
    (await plan()).floors.flatMap((f) => f.tables).find((t) => t.table === 5);

  it("lists each area's tables, free until a guest orders", async () => {
    const floors = (await plan()).floors;
    expect(floors.map((f) => [f.id, f.name, f.tables.length])).toEqual([
      ['ground', 'Ground floor', 8],
      ['first', 'First floor', 6],
      ['outdoor', 'Outdoor', 4],
    ]);
    expect(await tableFive()).toEqual({
      table: 5,
      seats: 6,
      status: 'available',
      orderCount: 0,
      due: 0,
    });
    expect((await plan('ktm-thamel')).floors.map((f) => f.name)).toEqual([
      'Ground floor',
      'First floor',
      'Courtyard',
    ]);
  });

  it('shows why a table needs a person: waiter, then bill, then food, then eating', async () => {
    const atFive = await guest('blr-indiranagar', { mode: 'dineIn', table: 5 });
    const order = await place(atFive);
    expect(await tableFive()).toMatchObject({
      status: 'ordering',
      orderCount: 1,
      due: order.total,
      seatedAt: order.placedAt,
    });

    await call('POST', 'service-requests', { sessionId: atFive.id, kind: 'bill', scope: 'mine' });
    expect((await tableFive())?.status).toBe('wantsBill');
    const waiterCall = await callWaiter(atFive);
    expect((await tableFive())?.status).toBe('needsWaiter');

    await call('POST', `admin/service-requests/${waiterCall.id}/resolve`, undefined, admin);
    expect((await tableFive())?.status).toBe('wantsBill');

    now += READY_AFTER;
    await served(order.id);
    const bill = (await floor()).requests.find((r) => r.kind === 'bill');
    await call('POST', `admin/service-requests/${bill?.id}/resolve`, undefined, admin);
    // Served, not paid: still at the table.
    expect((await tableFive())?.status).toBe('eating');
  });

  it('needs a staff session', async () => {
    const res = await call('GET', 'admin/branches/blr-indiranagar/tables');
    expect(res.status).toBe(401);
  });
});

describe('GET /admin/branches/:branchId/tables/:table (mock)', () => {
  const detail = (table: number | string) =>
    call('GET', `admin/branches/blr-indiranagar/tables/${table}`, undefined, admin);

  it('has the area, the open orders in full and the open requests', async () => {
    const first = await guest('blr-indiranagar', { mode: 'dineIn', table: 5 });
    const second = await guest('blr-indiranagar', { mode: 'dineIn', table: 5 });
    const older = await place(first);
    now += MINUTE_MS;
    const newer = await place(second, { customerName: 'Karan' });
    const request = await callWaiter(second, 'cutlery');

    const res = await detail(5);
    expect(res.status).toBe(200);
    const body = res.body as TableDetailResponse;
    expect(body).toMatchObject({
      table: 5,
      seats: 6,
      floor: { id: 'ground', name: 'Ground floor' },
      status: 'needsWaiter',
      orderCount: 2,
      due: older.total + newer.total,
      seatedAt: older.placedAt,
    });
    expect(body.orders.map((o) => o.id)).toEqual([newer.id, older.id]);
    expect(body.orders[0].items[0]).toMatchObject({ dishSlug: 'dahi-kebab', quantity: 2 });
    expect(body.requests.map((r) => r.id)).toEqual([request.id]);
  });

  it('is 404 for a table on no area', async () => {
    expect((await detail(99)).status).toBe(404);
    expect((await detail('five')).status).toBe(404);
  });
});

describe('Orders a waiter takes at the table (mock)', () => {
  const take = (table: number | string, body: unknown, headers = admin) =>
    call('POST', `admin/branches/blr-indiranagar/tables/${table}/orders`, body, headers);
  const addTo = (orderId: string, body: unknown, branchId = 'blr-indiranagar') =>
    call('POST', `admin/branches/${branchId}/orders/${orderId}/rounds`, body, admin);
  const lines = linesOf('blr-indiranagar');

  it('takes a new order at a table: dine-in, at the counter, taken by the waiter', async () => {
    const res = await take(6, { customerName: ' Table 6 guest ', kitchenNote: ' No ice ', lines });
    expect(res.status).toBe(201);
    const order = res.body as Order;
    expect(order).toMatchObject({
      mode: 'dineIn',
      table: 6,
      customerName: 'Table 6 guest',
      status: 'received',
      kitchenNote: 'No ice',
      payment: { method: 'counter', status: 'unpaid' },
    });
    expect(order.sessionId).toBeUndefined();
    expect(order.timeline[0].note).toBe(`Taken by ${DEMO_ADMIN.name}`);
    // Priced by the server: the item total plus GST.
    expect(order.total).toBeGreaterThan(order.itemTotal);

    const table = (await call('GET', 'admin/branches/blr-indiranagar/tables/6', undefined, admin))
      .body as TableDetailResponse;
    expect(table).toMatchObject({ status: 'ordering', orderCount: 1, due: order.total });
  });

  it('refuses a missing name, a table on no area, an empty order and no session', async () => {
    expect((await take(6, { customerName: '  ', lines })).status).toBe(400);
    expect((await take(99, { customerName: 'Guest', lines })).status).toBe(404);
    expect((await take(6, { customerName: 'Guest', lines: [] })).status).toBe(422);
    expect((await take(6, { customerName: 'Guest', lines }, {})).status).toBe(401);
  });

  it("adds a round to a guest's running order, on the same bill", async () => {
    const atFive = await guest('blr-indiranagar', { mode: 'dineIn', table: 5 });
    const placed = await place(atFive);
    now += 10 * MINUTE_MS;

    const res = await addTo(placed.id, {
      kitchenNote: 'With the mains',
      lines: linesOf('blr-indiranagar', 'dahi-kebab', 1),
    });
    expect(res.status).toBe(201);
    const order = res.body as Order;
    expect(order.rounds?.map((r) => [r.number, r.status])).toEqual([
      [1, 'preparing'],
      [2, 'received'],
    ]);
    expect(order.rounds?.[1]).toMatchObject({ kitchenNote: 'With the mains' });
    expect(order.rounds?.[1].timeline[0].note).toBe(`Taken by ${DEMO_ADMIN.name}`);
    expect(order.total).toBeGreaterThan(placed.total);
    expect(order.payment).toMatchObject({ method: 'counter', status: 'unpaid' });

    // The guest sees it on their order.
    const mine = (await call('GET', `orders/${placed.id}`)).body as Order;
    expect(mine.rounds).toHaveLength(2);
    expect(mine.total).toBe(order.total);
  });

  it('only adds to an open dine-in order at the branch', async () => {
    const pickup = await guest('blr-indiranagar', { mode: 'takeaway' });
    const takeaway = await place(pickup, {
      method: 'pickup',
      fulfilment: { mode: 'takeaway', pickupAt: null },
    });
    expect((await addTo(takeaway.id, { lines })).status).toBe(409);
    expect((await addTo('A999', { lines })).status).toBe(404);

    const atFive = await guest('blr-indiranagar', { mode: 'dineIn', table: 5 });
    const placed = await place(atFive);
    expect((await addTo(placed.id, { lines }, 'ktm-thamel')).status).toBe(404);
  });
});

describe('POST /admin/service-requests/:id/acknowledge (mock)', () => {
  const acknowledge = (id: string, headers = admin) =>
    call('POST', `admin/service-requests/${id}/acknowledge`, undefined, headers);

  it('says who is on the way; the request stays open and the guest sees it', async () => {
    const atFive = await guest('blr-indiranagar', { mode: 'dineIn', table: 5 });
    const request = await callWaiter(atFive);
    now += MINUTE_MS;

    const res = await acknowledge(request.id);
    expect(res.status).toBe(200);
    expect((res.body as ResolveRequestResponse).request).toMatchObject({
      acknowledgedBy: DEMO_ADMIN.name,
      acknowledgedAt: new Date(now).toISOString(),
    });
    // Again: whoever said it first stays.
    now += MINUTE_MS;
    const again = (await acknowledge(request.id)).body as ResolveRequestResponse;
    expect(again.request.acknowledgedAt).toBe(new Date(now - MINUTE_MS).toISOString());

    const open = (await floor()).requests.find((r) => r.id === request.id);
    expect(open?.acknowledgedBy).toBe(DEMO_ADMIN.name);
    const mine = (await call('GET', `sessions/${atFive.id}/service-requests`))
      .body as ServiceRequestListResponse;
    expect(mine.requests[0]).toMatchObject({ acknowledgedBy: DEMO_ADMIN.name });
  });

  it('lists a request dealt with under done, with who and when, for 30 minutes', async () => {
    const atFive = await guest('blr-indiranagar', { mode: 'dineIn', table: 5 });
    const request = await callWaiter(atFive);
    now += 2 * MINUTE_MS;
    await call('POST', `admin/service-requests/${request.id}/resolve`, undefined, admin);

    const service = await floor();
    expect(service.requests).toHaveLength(0);
    expect(service.doneRequests).toEqual([
      expect.objectContaining({
        id: request.id,
        resolvedBy: DEMO_ADMIN.name,
        resolvedAt: new Date(now).toISOString(),
      }),
    ]);
    expect((await acknowledge(request.id)).status).toBe(409);

    now += 31 * MINUTE_MS;
    expect((await floor()).doneRequests).toHaveLength(0);
  });

  it('needs a staff session and a known request', async () => {
    const atFive = await guest('blr-indiranagar', { mode: 'dineIn', table: 5 });
    const request = await callWaiter(atFive);
    expect((await acknowledge(request.id, {})).status).toBe(401);
    expect((await acknowledge('nope')).status).toBe(404);
  });
});
