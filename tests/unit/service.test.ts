import { describe, expect, it } from 'vitest';
import { isServiceRequest } from '@/api/mock/db';
import { allOrders, tableOrders } from '@/api/mock/handlers/orders';
import { cleanNote, isPending } from '@/api/mock/handlers/serviceRequests';
import { SERVICE_REQUEST_TTL_MS } from '@/api/mock/rules';
import { isOwnOrder } from '@/lib/orders';
import {
  SERVICE_NOTE_MAX,
  billFor,
  byKind,
  firstName,
  payableOrders,
  latestRequest,
} from '@/lib/service';
import type { Order } from '@/types/order';
import { createClock } from '@/lib/clock';
import { testBranch, testOrderHistory } from '../apiState';

const clock = createClock(testBranch());

const mockOrders = testOrderHistory().history;

const NOW = Date.parse('2026-10-03T20:00:00+05:30');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const SESSION = 'guest-1';

const waiter = {
  id: 'r1',
  kind: 'waiter' as const,
  table: 12,
  sessionId: SESSION,
  reason: 'water' as const,
  note: 'A high chair',
  requestedAt: iso(60_000),
};
const bill = {
  id: 'r2',
  kind: 'bill' as const,
  table: 12,
  sessionId: SESSION,
  scope: 'table' as const,
  balance: 1074,
  requestedAt: iso(30_000),
};

const order = (over: Partial<Order>): Order => ({
  ...mockOrders[0],
  placedAt: '2026-10-03T19:42:00+05:30',
  ...over,
});

describe('service request guards', () => {
  it('accepts valid stored requests', () => {
    expect(isServiceRequest(waiter)).toBe(true);
    expect(isServiceRequest(bill)).toBe(true);
  });

  it('rejects malformed entries', () => {
    expect(isServiceRequest(null)).toBe(false);
    expect(isServiceRequest({ ...waiter, reason: 'dance' })).toBe(false);
    expect(isServiceRequest({ ...bill, scope: 'all' })).toBe(false);
    expect(isServiceRequest({ ...waiter, requestedAt: 'soon' })).toBe(false);
    expect(isServiceRequest({ ...waiter, kind: 'other' })).toBe(false);
    const { sessionId: _sessionId, ...noSession } = waiter;
    expect(isServiceRequest(noSession)).toBe(false);
    const { id: _id, ...noId } = waiter;
    expect(isServiceRequest(noId)).toBe(false);
  });
});

describe('pending requests', () => {
  it('lapse after the TTL', () => {
    expect(isPending(bill, NOW)).toBe(true);
    expect(isPending({ ...waiter, requestedAt: iso(SERVICE_REQUEST_TTL_MS + 1) }, NOW)).toBe(false);
  });

  it('picks the most recent request', () => {
    expect(latestRequest(byKind([waiter, bill]))).toEqual(bill);
    expect(latestRequest({})).toBeNull();
  });
});

describe('notes and labels', () => {
  it('trims and caps notes, dropping empty ones', () => {
    expect(cleanNote('  hello  ')).toBe('hello');
    expect(cleanNote('   ')).toBeUndefined();
    expect(cleanNote('x'.repeat(200))).toHaveLength(SERVICE_NOTE_MAX);
  });

  it('finds first names', () => {
    expect(firstName('Ananya Rao')).toBe('Ananya');
  });
});

describe('table orders and bill', () => {
  // Placed in this guest session.
  const a = order({
    id: 'A1',
    total: 1424,
    placedBy: 'you',
    sessionId: SESSION,
    payment: { method: 'online', status: 'paid' },
  });
  // From the order history: no session, so it's the table's, not this guest's.
  const b = order({
    id: 'A2',
    total: 318,
    placedBy: 'you',
    placedAt: '2026-10-03T19:05:00+05:30',
    payment: { method: 'counter', status: 'unpaid' },
  });
  const c = order({
    id: 'A3',
    total: 756,
    placedBy: 'other',
    placedAt: '2026-10-03T19:50:00+05:30',
    payment: { method: 'counter', status: 'unpaid' },
  });
  const cancelled = order({ id: 'A4', status: 'cancelled' });
  const otherTable = order({ id: 'A5', table: 5 });
  const yesterday = order({ id: 'A6', placedAt: '2026-10-02T19:00:00+05:30' });

  it('lists today’s non-cancelled orders at the table, newest first', () => {
    const list = tableOrders([a, b, c, cancelled, otherTable, yesterday], 12, NOW, clock);
    expect(list.map((o) => o.id)).toEqual(['A3', 'A1', 'A2']);
    expect(list.find((o) => isOwnOrder(o, SESSION))?.id).toBe('A1');
  });

  it('sums the whole table or just the guest’s orders', () => {
    const list = tableOrders([a, b, c], 12, NOW, clock);
    expect(billFor(list, 'table', SESSION)).toMatchObject({
      total: 2498,
      paid: 1424,
      balance: 1074,
    });
    // The guest's own orders first, then the rest of the table (newest first).
    expect(billFor(list, 'table', SESSION).orders.map((o) => o.id)).toEqual(['A1', 'A3', 'A2']);
    expect(billFor(list, 'mine', SESSION)).toMatchObject({ total: 1424, paid: 1424, balance: 0 });
  });

  it('scopes "mine" to the guest session', () => {
    // Another guest's session at the same table, newest of all.
    const d = order({
      id: 'A7',
      total: 200,
      placedBy: 'you',
      sessionId: 'guest-2',
      placedAt: '2026-10-03T19:55:00+05:30',
      payment: { method: 'counter', status: 'unpaid' },
    });
    const list = tableOrders([a, b, c, d], 12, NOW, clock);
    expect(list.find((o) => isOwnOrder(o, SESSION))?.id).toBe('A1');
    expect(list.find((o) => isOwnOrder(o, 'guest-2'))?.id).toBe('A7');
    // Each guest's bill holds only their own session's orders, never the shared history.
    expect(billFor(list, 'mine', SESSION).orders.map((o) => o.id)).toEqual(['A1']);
    expect(billFor(list, 'mine', 'guest-2').orders.map((o) => o.id)).toEqual(['A7']);
    // The whole table lists the guest's own orders first.
    expect(billFor(list, 'table', 'guest-2').orders.map((o) => o.id)).toEqual([
      'A7',
      'A3',
      'A1',
      'A2',
    ]);
  });

  it('can pay only the guest session’s own unpaid orders, and only for "mine"', () => {
    // Placed in this session and still unpaid (pay at the counter).
    const mineUnpaid = order({
      id: 'A8',
      total: 272,
      placedBy: 'you',
      sessionId: SESSION,
      placedAt: '2026-10-03T19:58:00+05:30',
      payment: { method: 'counter', status: 'unpaid' },
    });
    const theirs = order({
      id: 'A9',
      total: 200,
      placedBy: 'you',
      sessionId: 'guest-2',
      payment: { method: 'counter', status: 'unpaid' },
    });
    const list = tableOrders([a, b, c, mineUnpaid, theirs], 12, NOW, clock);
    // A2 is the table's history and A9 another guest's; A1 is already paid.
    expect(payableOrders(list, SESSION).map((o) => o.id)).toEqual(['A8']);
    expect(payableOrders(list, undefined)).toEqual([]);
    expect(billFor(list, 'mine', SESSION)).toMatchObject({ balance: 272, payableTotal: 272 });
    expect(billFor(list, 'mine', SESSION).payable.map((o) => o.id)).toEqual(['A8']);
    expect(billFor(list, 'table', SESSION)).toMatchObject({ payable: [], payableTotal: 0 });
  });

  it('shows the bill as paid once the payable orders are paid', () => {
    const mineUnpaid = order({
      id: 'A8',
      total: 272,
      placedBy: 'you',
      sessionId: SESSION,
      payment: { method: 'counter', status: 'unpaid' },
    });
    const before = billFor([a, mineUnpaid], 'mine', SESSION);
    expect(before).toMatchObject({ total: 1696, paid: 1424, balance: 272, payableTotal: 272 });
    const paid = { ...mineUnpaid, payment: { method: 'online' as const, status: 'paid' as const } };
    expect(billFor([a, paid], 'mine', SESSION)).toMatchObject({
      total: 1696,
      paid: 1696,
      balance: 0,
      payable: [],
      payableTotal: 0,
    });
  });

  it('merges device orders over the mock history without duplicates', () => {
    const merged = allOrders([a, { ...mockOrders[0], total: 1 }], mockOrders);
    expect(merged.filter((o) => o.id === mockOrders[0].id)).toHaveLength(1);
    expect(merged.find((o) => o.id === mockOrders[0].id)?.total).toBe(1);
  });
});
