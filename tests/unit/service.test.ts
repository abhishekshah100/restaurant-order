import { describe, expect, it } from 'vitest';
import { allOrders } from '@/lib/orders';
import {
  SERVICE_NOTE_MAX,
  SERVICE_REQUEST_TTL_MS,
  billFor,
  cleanNote,
  firstName,
  isServiceRequests,
  latestOwnOrder,
  latestRequest,
  liveRequests,
  tableOrders,
  telHref,
  type ServiceRequests,
} from '@/lib/service';
import type { Order } from '@/types/order';
import { testOrderHistory } from '../apiState';

const mockOrders = testOrderHistory().history;

const NOW = Date.parse('2026-10-03T20:00:00+05:30');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const SESSION = 'guest-1';

const waiter = {
  kind: 'waiter' as const,
  table: 12,
  sessionId: SESSION,
  reason: 'water' as const,
  note: 'A high chair',
  requestedAt: iso(60_000),
};
const bill = {
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
  it('accepts valid saved requests keyed by kind', () => {
    expect(isServiceRequests({ waiter, bill })).toBe(true);
    expect(isServiceRequests({})).toBe(true);
  });

  it('rejects malformed or mismatched entries', () => {
    expect(isServiceRequests(null)).toBe(false);
    expect(isServiceRequests({ waiter: bill })).toBe(false);
    expect(isServiceRequests({ waiter: { ...waiter, reason: 'dance' } })).toBe(false);
    expect(isServiceRequests({ bill: { ...bill, scope: 'all' } })).toBe(false);
    expect(isServiceRequests({ waiter: { ...waiter, requestedAt: 'soon' } })).toBe(false);
    expect(isServiceRequests({ other: waiter })).toBe(false);
    const { sessionId: _sessionId, ...noSession } = waiter;
    expect(isServiceRequests({ waiter: noSession })).toBe(false);
  });
});

describe('liveRequests / latestRequest', () => {
  it('keeps only this guest session’s requests within the TTL', () => {
    const saved: ServiceRequests = {
      waiter: { ...waiter, requestedAt: iso(SERVICE_REQUEST_TTL_MS + 1) },
      bill,
    };
    expect(liveRequests(saved, SESSION, NOW)).toEqual({ bill });
    // Another guest at the same table doesn't see them.
    expect(liveRequests({ waiter, bill }, 'guest-2', NOW)).toEqual({});
  });

  it('picks the most recent request', () => {
    expect(latestRequest({ waiter, bill })).toEqual(bill);
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

  it('builds a tel: link, falling back while the number is a placeholder', () => {
    expect(telHref('+91 98765 43210')).toBe('tel:+919876543210');
    expect(telHref('[RESTAURANT PHONE]')).toBe('tel:+910000000000');
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
  // From the order history: no session, so `placedBy` decides.
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
    const list = tableOrders([a, b, c, cancelled, otherTable, yesterday], 12, NOW);
    expect(list.map((o) => o.id)).toEqual(['A3', 'A1', 'A2']);
    expect(latestOwnOrder([a, b, c], 12, NOW, SESSION)?.id).toBe('A1');
  });

  it('sums the whole table or just the guest’s orders', () => {
    const list = tableOrders([a, b, c], 12, NOW);
    expect(billFor(list, 'table', SESSION)).toMatchObject({
      total: 2498,
      paid: 1424,
      balance: 1074,
    });
    expect(billFor(list, 'table', SESSION).orders.map((o) => o.id)).toEqual(['A1', 'A2', 'A3']);
    expect(billFor(list, 'mine', SESSION)).toMatchObject({ total: 1742, paid: 1424, balance: 318 });
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
    const list = tableOrders([a, b, c, d], 12, NOW);
    expect(latestOwnOrder(list, 12, NOW, SESSION)?.id).toBe('A1');
    expect(latestOwnOrder(list, 12, NOW, 'guest-2')?.id).toBe('A7');
    expect(billFor(list, 'mine', SESSION).orders.map((o) => o.id)).toEqual(['A1', 'A2']);
    expect(billFor(list, 'mine', 'guest-2').orders.map((o) => o.id)).toEqual(['A7', 'A2']);
    // The whole table lists the guest's own orders first.
    expect(billFor(list, 'table', 'guest-2').orders.map((o) => o.id)).toEqual([
      'A7',
      'A2',
      'A3',
      'A1',
    ]);
  });

  it('merges device orders over the mock history without duplicates', () => {
    const merged = allOrders([a, { ...mockOrders[0], total: 1 }], mockOrders);
    expect(merged.filter((o) => o.id === mockOrders[0].id)).toHaveLength(1);
    expect(merged.find((o) => o.id === mockOrders[0].id)?.total).toBe(1);
  });
});
