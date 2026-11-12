import { describe, expect, it } from 'vitest';
import {
  cancelEntriesOf,
  filterRefunds,
  isLateRefund,
  reasonTotals,
  refundStaff,
  refundsEntries,
  refundsSummary,
  transactionSeq,
} from '@/lib/refundsReport';
import { ledgerOf } from '@/lib/adminPayments';
import type { Order, PaymentTransaction } from '@/types/order';

/** The money given back, as the server lists it: each refund with its order. */
const linesOf = (orders: readonly Order[]) =>
  orders.flatMap((o) => ledgerOf(o).map((t) => ({ ...t, order: o })));
const entriesOf = (orders: readonly Order[]) => refundsEntries(linesOf(orders), orders);

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
    const entries = entriesOf(orders);
    // At the same moment, the cancellation first.
    expect(entries.map((e) => e.key)).toEqual(['A2-cancel', 'A2-T2', 'A1-T2']);
    expect(transactionSeq('BLR-001-T12')).toBe(12);
    expect(entries[1]).toMatchObject({ kind: 'refund', seq: 2, pending: true });
  });

  it('adds up refunds by channel, cancellations and what is still on its way', () => {
    expect(refundsSummary(entriesOf(orders))).toEqual({
      refunded: 450,
      refundedInPerson: 50,
      refundedOnline: 400,
      refunds: 2,
      cancelled: 1,
      cancelledRounds: 0,
      ranOut: 0,
      cancelledValue: 400,
      pending: 1,
      pendingAmount: 400,
    });
  });

  it('totals the reasons and filters by kind, reason, staff and search', () => {
    const entries = entriesOf(orders);
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

  it('calls an online refund late after 7 days on its way', () => {
    const [cancel, onWay, cash] = entriesOf(orders);
    // Given 3 Nov 11:00.
    expect(isLateRefund(onWay!, new Date('2026-11-10T10:00:00.000Z'))).toBe(false);
    expect(isLateRefund(onWay!, new Date('2026-11-10T12:00:00.000Z'))).toBe(true);
    expect(isLateRefund(cash!, new Date('2026-12-01T00:00:00.000Z'))).toBe(false);
    expect(isLateRefund(cancel!, new Date('2026-12-01T00:00:00.000Z'))).toBe(false);
  });

  it('lists rounds taken back and dishes run out on orders that went on, each once', () => {
    const item = (name: string, unitPrice: number, quantity: number, extra = {}) => ({
      name,
      unitPrice,
      quantity,
      ...extra,
    });
    const round = (number: number, extra = {}) => ({
      number,
      placedAt: '2026-11-03T09:00:00.000Z',
      status: 'served',
      timeline: [],
      items: [],
      ...extra,
    });
    const going = order('A3', {
      rounds: [
        round(1, {
          items: [
            item('Dal', 300, 1),
            item('Butter naan', 60, 1, {
              unavailable: 2,
              unavailableAt: '2026-11-03T09:20:00.000Z',
              unavailableBy: 'Ravi',
              unavailableNote: 'Naan dough finished',
            }),
          ],
        }),
        // Taken back by a waiter: what's left of it (the naan already ran out) counts once.
        round(2, {
          items: [item('Lassi', 90, 2), item('Kulfi', 120, 0, { unavailable: 1 })],
          cancelled: {
            at: '2026-11-03T09:30:00.000Z',
            who: 'restaurant',
            reason: 'Cancelled at the table',
            by: 'Meera',
          },
        }),
        // The guest took it back themselves.
        round(3, {
          items: [item('Tea', 40, 1)],
          cancelled: { at: '2026-11-03T09:40:00.000Z', who: 'guest' },
        }),
        // Every dish ran out: told by its dishes, not as a round of nothing.
        round(4, {
          items: [item('Soup', 150, 0, { unavailable: 1 })],
          cancelled: { at: '2026-11-03T09:50:00.000Z', who: 'restaurant', reason: 'Ran out' },
        }),
      ] as unknown as Order['rounds'],
      payment: {
        transactions: [
          tx('A3-T1', { kind: 'payment', amount: 900 }),
          // Round 2 was paid: its money went back on its own.
          tx('A3-T2', { amount: 180, reason: 'changed', at: '2026-11-03T09:30:02.000Z' }),
        ],
      } as Order['payment'],
    });
    const words = { guest: 'Guest took it back', ranOut: 'Ran out in the kitchen' };
    // A round from before who and why were kept: still listed, with when.
    const older = order('A5', {
      rounds: [
        round(1, { items: [item('Dal', 300, 1)] }),
        round(2, {
          status: 'cancelled',
          items: [item('Tea', 40, 2)],
          timeline: [{ status: 'cancelled', time: '', at: '2026-11-03T08:00:00.000Z' }],
        }),
      ] as unknown as Order['rounds'],
    });
    expect(cancelEntriesOf([older], words)).toMatchObject([
      { part: 'round', round: 2, amount: 80, at: '2026-11-03T08:00:00.000Z' },
    ]);
    const entries = cancelEntriesOf([going], words);
    expect(entries.map((e) => [e.part, e.amount, e.reason, e.by ?? null])).toEqual([
      ['round', 180, 'Cancelled at the table', 'Meera'],
      ['round', 40, 'Guest took it back', null],
      ['ranOut', 120, 'Ran out in the kitchen', 'Ravi'],
      ['ranOut', 120, 'Ran out in the kitchen', null],
      ['ranOut', 150, 'Ran out in the kitchen', null],
    ]);
    expect(entries[0]).toMatchObject({ round: 2, who: 'restaurant', refundedAuto: true });
    expect(entries[1]).toMatchObject({ who: 'guest' });
    expect(entries[1]?.refundedAuto).toBeUndefined();
    expect(entries[2]).toMatchObject({
      dishes: '2 × Butter naan',
      note: 'Naan dough finished',
      at: '2026-11-03T09:20:00.000Z',
    });

    // A whole order cancelled is one line, never its rounds or dishes again.
    const whole = order('A4', {
      status: 'cancelled',
      cancelledBy: 'restaurant',
      rounds: [
        round(1, {
          items: [item('Dal', 300, 1, { unavailable: 1 })],
          cancelled: { at: '2026-11-03T10:00:00.000Z', who: 'restaurant', by: 'Ravi' },
        }),
      ] as unknown as Order['rounds'],
    });
    expect(cancelEntriesOf([whole], words).map((e) => [e.part, e.by])).toEqual([['order', 'Ravi']]);

    const all = [...entries, ...cancelEntriesOf([whole], words)];
    expect(refundsSummary(all)).toMatchObject({
      cancelled: 1,
      cancelledRounds: 2,
      ranOut: 3,
      cancelledValue: 180 + 40 + 120 + 120 + 150 + 600,
    });
    const none = { kind: 'all', reason: 'all', staff: 'all', query: '' } as const;
    expect(filterRefunds(all, { ...none, part: 'ranOut' })).toHaveLength(3);
    expect(
      filterRefunds(all, { ...none, staff: 'Ravi' }).map((e) =>
        e.kind === 'cancel' ? e.part : e.kind,
      ),
    ).toEqual(['ranOut', 'order']);
    expect(refundStaff(all)).toEqual(['Meera', 'Ravi']);
  });
});
