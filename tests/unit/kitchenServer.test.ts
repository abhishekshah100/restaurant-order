import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiResponse } from '@/api/client';
import type {
  AdminOrdersResponse,
  AdminSignInResponse,
  ApiErrorBody,
  BranchServiceResponse,
} from '@/api/contracts';
import { DEMO_ADMIN } from '@/api/mock/demoAdmin';
import { MINUTE_MS } from '@/api/mock/rules';
import { defaultConfig, orderLine, unitPrice } from '@/lib/cartLine';
import { kitchenTickets } from '@/lib/kitchenBoard';
import { kitchenEvents } from '@/lib/kitchenActivity';
import type { Dish } from '@/types/menu';
import type { Order } from '@/types/order';
import type { GuestSession } from '@/types/session';
import { createTestServer, testBranch, testMenu } from '../apiState';

/*
 * The kitchen on the mock server: PATCH /admin/branches/:branchId/orders/:id/rounds/:round/status
 * (started, ready) on guests' and waiters' orders, what the guest's tracking and the floor see
 * afterwards, and the board's tickets from GET /admin/branches/:branchId/orders. Without the
 * kitchen, dine-in food is started 2 minutes and ready 18 minutes after it's ordered.
 */

const START = Date.parse('2026-10-14T19:00:00+05:30');
let now = START;
const server = createTestServer(() => now);
const BRANCH = 'blr-indiranagar';

const call = (
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) => server({ method, path, body, headers }) as Promise<ApiResponse>;
const error = (res: ApiResponse) => (res.body as ApiErrorBody).error;

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

function lines(slug = 'dahi-kebab', quantity = 2) {
  const dish = testMenu(BRANCH).getDish(slug) as Dish;
  const config = defaultConfig(dish);
  return [orderLine({ ...config, key: slug, quantity, unitPrice: unitPrice(dish, config) })];
}

async function guestOrder(table = 12): Promise<Order> {
  const session = (await call('POST', 'sessions', { branchId: BRANCH, mode: 'dineIn', table }))
    .body as GuestSession;
  await call('POST', 'otp', { sessionId: session.id, phone: '9876543210' });
  await call('POST', 'otp/verify', { sessionId: session.id, phone: '9876543210', code: '123456' });
  const res = await call('POST', 'orders', {
    sessionId: session.id,
    customerName: 'Ananya Rao',
    method: 'counter',
    kitchenNote: 'No onion in anything',
    lines: lines(),
    fulfilment: { mode: 'dineIn' },
  });
  expect(res.status).toBe(201);
  return res.body as Order;
}

const mark = (orderId: string, round: number, status: unknown, headers = admin) =>
  call(
    'PATCH',
    `admin/branches/${BRANCH}/orders/${orderId}/rounds/${round}/status`,
    { status },
    headers,
  );

const getOrder = async (id: string) => (await call('GET', `orders/${id}`)).body as Order;

const todaysOrders = async () =>
  (
    (await call('GET', `admin/branches/${BRANCH}/orders`, undefined, admin))
      .body as AdminOrdersResponse
  ).orders;

describe('PATCH …/orders/:id/rounds/:round/status (mock)', () => {
  it('starts a guest order before the kitchen timing, then has it ready; the guest sees both', async () => {
    const order = await guestOrder();
    now += 30_000;

    const started = await mark(order.id, 1, 'preparing');
    expect(started.status).toBe(200);
    expect((started.body as Order).status).toBe('preparing');
    expect((started.body as Order).rounds?.[0].kitchen?.started).toEqual({
      at: new Date(now).toISOString(),
      by: DEMO_ADMIN.name,
    });
    // The guest can't change it any more: the kitchen has started.
    expect((await getOrder(order.id)).status).toBe('preparing');

    now += 6 * MINUTE_MS;
    const ready = await mark(order.id, 1, 'ready');
    expect((ready.body as Order).status).toBe('ready');
    expect((await getOrder(order.id)).status).toBe('ready');

    // Waiters see it to serve, and a waiter serves it 4 minutes later by the kitchen's timing.
    const service = (await call('GET', `admin/branches/${BRANCH}/service`, undefined, admin))
      .body as BranchServiceResponse;
    expect(service.orders.find((o) => o.id === order.id)?.readyRounds).toEqual([
      { round: 1, itemCount: 2, readyAt: new Date(now).toISOString() },
    ]);
    now += 4 * MINUTE_MS;
    expect((await getOrder(order.id)).status).toBe('served');
  });

  it('marks ready without starting first, and is idempotent', async () => {
    const order = await guestOrder();
    const ready = await mark(order.id, 1, 'ready');
    expect((ready.body as Order).status).toBe('ready');
    const startedAfter = await mark(order.id, 1, 'preparing');
    expect(startedAfter.status).toBe(200);
    expect((startedAfter.body as Order).status).toBe('ready');
    const again = await mark(order.id, 1, 'ready');
    expect((again.body as Order).rounds?.[0].kitchen?.ready?.at).toBe(
      new Date(START).toISOString(),
    );
  });

  it('moves one round of a running order on its own', async () => {
    const order = await guestOrder();
    now += 3 * MINUTE_MS;
    await call(
      'POST',
      `admin/branches/${BRANCH}/orders/${order.id}/rounds`,
      { lines: lines('dahi-kebab', 1) },
      admin,
    );
    const res = await mark(order.id, 2, 'ready');
    const rounds = (res.body as Order).rounds ?? [];
    // Round 1 is cooking by the kitchen's timing; round 2 is ready because the kitchen said so.
    expect(rounds.map((r) => r.status)).toEqual(['preparing', 'ready']);
  });

  it('refuses what it should', async () => {
    const order = await guestOrder();
    expect(error(await mark(order.id, 1, 'served'))).toBe('invalid_request');
    expect(error(await mark(order.id, 3, 'ready'))).toBe('not_found');
    expect(error(await mark('A999', 1, 'ready'))).toBe('not_found');
    expect((await mark(order.id, 1, 'ready', {})).status).toBe(401);

    now += 30 * MINUTE_MS;
    // Served by now: nothing more for the kitchen to do.
    expect(error(await mark(order.id, 1, 'ready'))).toBe('order_closed');

    const cancelled = await guestOrder(5);
    await call(
      'POST',
      `admin/branches/${BRANCH}/orders/${cancelled.id}/cancel`,
      { reason: 'outOfStock' },
      admin,
    );
    expect(error(await mark(cancelled.id, 1, 'preparing'))).toBe('order_closed');
  });
});

describe('the kitchen board from GET …/orders (mock)', () => {
  it('turns guests’ and waiters’ rounds into tickets, with events in the order they happened', async () => {
    const order = await guestOrder();
    now += MINUTE_MS;
    const waiter = await call(
      'POST',
      `admin/branches/${BRANCH}/tables/5/orders`,
      { customerName: 'Kabir', lines: lines('dahi-kebab', 3) },
      admin,
    );
    const taken = waiter.body as Order;
    now += 30_000;
    await mark(order.id, 1, 'preparing');
    now += 5 * MINUTE_MS;
    await mark(order.id, 1, 'ready');

    const tickets = kitchenTickets(await todaysOrders(), testBranch(BRANCH));
    const guestTicket = tickets.find((t) => t.orderId === order.id);
    const waiterTicket = tickets.find((t) => t.orderId === taken.id);
    expect(guestTicket).toMatchObject({
      stage: 'ready',
      source: 'guest',
      table: 12,
      itemCount: 2,
      kitchenNote: 'No onion in anything',
      readyAt: new Date(now).toISOString(),
    });
    expect(waiterTicket).toMatchObject({
      stage: 'cooking',
      source: 'staff',
      table: 5,
      itemCount: 3,
    });
    expect(waiterTicket?.takenBy).toContain(DEMO_ADMIN.name);

    const events = kitchenEvents(tickets.filter((t) => t.orderId === order.id));
    expect(events.map((e) => [e.kind, e.by])).toEqual([
      ['ready', DEMO_ADMIN.name],
      ['started', DEMO_ADMIN.name],
      ['received', undefined],
    ]);
  });
});
