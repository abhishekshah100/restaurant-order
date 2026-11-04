import { describe, expect, it } from 'vitest';
import {
  filterRefunds,
  reasonTotals,
  refundStaff,
  refundsEntries,
  refundsSummary,
  transactionSeq,
} from '@/lib/refundsReport';
import type { Order, PaymentTransaction } from '@/types/order';

/* Refunds & cancellations: one list, its totals, reasons and filters. */

const tx = (id: string, extra: Partial<PaymentTransaction>): PaymentTransaction => ({
  id,
  kind: 'refund',
  amount: 100,
  channel: 'inPerson',
  method: 'cash',
  at: '2026-11-03T10:00:00.000Z',
  ...extra,
});

const order = (id: string, extra: Partial<Order>): Order =>
  ({
    id,
    branchId: 'b',
    mode: 'dineIn',
    table: 4,
    customerName: 'Asha',
    status: 'served',
    placedAt: '2026-11-03T09:00:00.000Z',
    total: 600,
    timeline: [],
    payment: { transactions: [] },
    ...extra,
  }) as unknown as Order;

const orders = [
  order('A1', {
    payment: {
      transactions: [
        tx('A1-T1', { kind: 'payment', amount: 600 }),
        tx('A1-T2', { amount: 50, reason: 'complaint', by: 'Meera' }),
      ],
    } as Order['payment'],
  }),
  order('A2', {
    status: 'cancelled',
    cancelledBy: 'restaurant',
    cancelReason: 'An item ran out',
    total: 400,
    timeline: [{ status: 'cancelled', time: '', at: '2026-11-03T11:00:00.000Z' }],
    payment: {
      transactions: [
        tx('A2-T1', { kind: 'payment', channel: 'online', method: 'upi', amount: 400 }),
        tx('A2-T2', {
          channel: 'online',
          method: 'upi',
          amount: 400,
          reason: 'cancelled',
          status: 'started',
          at: '2026-11-03T11:00:00.000Z',
        }),
      ],
    } as Order['payment'],
  }),
];

describe('refunds and cancellations', () => {
  it('lists every refund and cancellation, newest first', () => {
    const entries = refundsEntries(orders);
    // At the same moment, the cancellation first.
    expect(entries.map((e) => e.key)).toEqual(['A2-cancel', 'A2-T2', 'A1-T2']);
    expect(transactionSeq('BLR-001-T12')).toBe(12);
    expect(entries[1]).toMatchObject({ kind: 'refund', seq: 2, pending: true });
  });

  it('adds up refunds by channel, cancellations and what is still on its way', () => {
    expect(refundsSummary(refundsEntries(orders))).toEqual({
      refunded: 450,
      refundedInPerson: 50,
      refundedOnline: 400,
      refunds: 2,
      cancelled: 1,
      cancelledValue: 400,
      pending: 1,
      pendingAmount: 400,
    });
  });

  it('totals the reasons and filters by kind, reason, staff and search', () => {
    const entries = refundsEntries(orders);
    expect(reasonTotals(entries).map((r) => [r.kind, r.reason, r.amount])).toEqual([
      ['cancel', 'An item ran out', 400],
      ['refund', 'cancelled', 400],
      ['refund', 'complaint', 50],
    ]);
    const all = { kind: 'all', reason: 'all', staff: 'all', query: '' } as const;
    expect(filterRefunds(entries, { ...all, kind: 'cancel' })).toHaveLength(1);
    expect(filterRefunds(entries, { ...all, reason: 'refund:complaint' })).toHaveLength(1);
    expect(filterRefunds(entries, { ...all, staff: 'Meera' }).map((e) => e.key)).toEqual(['A1-T2']);
    expect(filterRefunds(entries, { ...all, query: 'a2' })).toHaveLength(2);
    expect(refundStaff(entries)).toEqual(['Meera']);
  });
});
