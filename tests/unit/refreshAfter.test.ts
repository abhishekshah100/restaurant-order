import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { AFTER, branchOf, READS, refreshAfter } from '@/api/refreshAfter';

/* After X, refresh Y: the one list of what each change makes out of date. */

const KEYS = {
  paymentHistory: ['admin', 'payment-history', 'b1', 'token', { from: '2026-11-12' }],
  todayPayments: ['admin', 'service', 'payments-today', 'b1', 'token', {}],
  register: ['admin', 'cash-register', 'b1', 'token'],
  session: ['admin', 'cash-session', 'b1', 's1', 'token'],
  guestOrder: ['orders', 'detail', 'UDY-1'],
  rota: ['admin', 'rota', 'week', 'b1', 'token', '2026-11-09'],
  menuB1: ['branches', 'b1', 'menu'],
  menuB2: ['branches', 'b2', 'menu'],
  stockB1: ['admin', 'inventory', 'b1', 'stock', 'token'],
  stockB2: ['admin', 'inventory', 'b2', 'stock', 'token'],
  branchList: ['branches'],
  statusB1: ['branches', 'b1', 'status'],
};

const seeded = () => {
  const client = new QueryClient();
  for (const key of Object.values(KEYS)) client.setQueryData(key, 1);
  return client;
};
const stale = (client: QueryClient) =>
  Object.entries(KEYS)
    .filter(([, key]) => client.getQueryState(key)?.isInvalidated)
    .map(([name]) => name)
    .sort();

describe('refresh after a change', () => {
  it('a refund reads the money everywhere again, and nothing else', async () => {
    const client = seeded();
    await refreshAfter(client, 'refundGiven', 'b1');
    expect(stale(client)).toEqual(
      ['guestOrder', 'paymentHistory', 'register', 'session', 'todayPayments'].sort(),
    );
  });

  it("a branch's stock and menu, or every branch's when none is named", async () => {
    const one = seeded();
    await refreshAfter(one, 'stockChanged', 'b1');
    expect(stale(one)).toEqual(['menuB1', 'stockB1']);
    const all = seeded();
    await refreshAfter(all, 'stockChanged');
    expect(stale(all)).toEqual(['menuB1', 'menuB2', 'stockB1', 'stockB2']);
  });

  it('pausing a branch reads its status and the branch list, not its menu', async () => {
    const client = seeded();
    await refreshAfter(client, 'branchStatusChanged', 'b1');
    expect(stale(client)).toEqual(['branchList', 'statusB1']);
  });

  it('names only reads that exist, and finds the branch a write was for', () => {
    for (const reads of Object.values(AFTER)) {
      for (const read of reads) expect(READS).toHaveProperty(read);
    }
    expect(branchOf({ branchId: 'b1', orderId: 'x' })).toBe('b1');
    expect(branchOf('b1')).toBeUndefined();
    expect(branchOf(undefined)).toBeUndefined();
  });
});
