import { describe, expect, it } from 'vitest';
import { paymentsPath } from '@/lib/adminNav';
import {
  changeDue,
  daySummary,
  dueGroups,
  filterEntries,
  filterGroups,
  ledgerCsv,
  ledgerEntries,
  ledgerOf,
  parsePaymentsView,
  refundable,
  splitShares,
  tipFor,
} from '@/lib/adminPayments';
import type { Order, PaymentTransaction } from '@/types/order';
import type { BillRequest } from '@/types/service';

/* The Payments page's logic: the ledger, the day's money, what's to collect, splitting, tips, CSV. */

const order = (id: string, fields: Partial<Order>): Order =>
  ({
    id,
    branchId: 'blr-indiranagar',
    mode: 'dineIn',
    customerName: 'Guest',
    placedBy: 'other',
    placedAt: '2026-10-15T13:00:00.000Z',
    status: 'served',
    items: [],
    itemTotal: 500,
    total: 500,
    payment: { method: 'counter', status: 'unpaid' },
    timeline: [],
    ...fields,
  }) as Order;

const tx = (fields: Partial<PaymentTransaction> & Pick<PaymentTransaction, 'id'>) =>
  ({
    kind: 'payment',
    amount: 500,
    channel: 'inPerson',
    method: 'cash',
    at: '2026-10-15T14:00:00.000Z',
    ...fields,
  }) as PaymentTransaction;

// Paid 300 in cash with a 20 tip, then 200 by card; 50 given back in cash.
const split = order('A101', {
  table: 5,
  customerName: 'Priya',
  payment: {
    method: 'counter',
    status: 'paid',
    refundAmount: 50,
    transactions: [
      tx({ id: 'A101-T1', amount: 300, tip: 20, by: 'Abhishek' }),
      tx({ id: 'A101-T2', amount: 200, method: 'card', at: '2026-10-15T14:05:00.000Z' }),
      tx({
        id: 'A101-T3',
        kind: 'refund',
        amount: 50,
        reason: 'wrongItem',
        status: 'done',
        at: '2026-10-15T14:10:00.000Z',
      }),
    ],
  },
});
// Paid online before transactions were recorded.
const legacy = order('A102', {
  mode: 'delivery',
  total: 400,
  payment: { method: 'online', status: 'paid', transactionRef: 'UPI 123' },
});
// Cancelled after paying online: the refund is on its way.
const cancelled = order('A103', {
  status: 'cancelled',
  total: 450,
  payment: { method: 'online', status: 'refund-started', refundAmount: 450 },
});
const tableTwelve = order('A104', { table: 12, total: 600, placedAt: '2026-10-15T12:00:00.000Z' });
const tableTwelveAgain = order('A105', {
  table: 12,
  total: 300,
  placedAt: '2026-10-15T12:30:00.000Z',
  payment: { method: 'counter', status: 'unpaid', paid: 100 },
});
const tableSeven = order('A106', { table: 7, total: 250, placedAt: '2026-10-15T13:30:00.000Z' });
const pickup = order('A107', {
  mode: 'takeaway',
  total: 350,
  customerName: 'Meera',
  placedAt: '2026-10-15T11:00:00.000Z',
});
const all = [split, legacy, cancelled, tableTwelve, tableTwelveAgain, tableSeven, pickup];

describe('the ledger', () => {
  it("uses what the server recorded, else works it out from the order's payment", () => {
    expect(ledgerOf(split)).toBe(split.payment.transactions);
    expect(ledgerOf(legacy)).toEqual([
      expect.objectContaining({
        kind: 'payment',
        amount: 400,
        channel: 'online',
        transactionRef: 'UPI 123',
      }),
    ]);
    expect(ledgerOf(cancelled)).toEqual([
      expect.objectContaining({ kind: 'payment', amount: 450 }),
      expect.objectContaining({
        kind: 'refund',
        amount: 450,
        reason: 'cancelled',
        status: 'started',
      }),
    ]);
    expect(ledgerOf(tableTwelveAgain)).toEqual([
      expect.objectContaining({ kind: 'payment', amount: 100, channel: 'inPerson' }),
    ]);
    expect(ledgerOf(tableTwelve)).toEqual([]);
  });

  it('refunds what was paid and not given back yet; nothing on a cancelled order', () => {
    expect(refundable(split)).toBe(450);
    expect(refundable(legacy)).toBe(400);
    expect(refundable(tableTwelveAgain)).toBe(100);
    expect(refundable(cancelled)).toBe(0);
    expect(refundable(tableTwelve)).toBe(0);
  });

  it('lists every payment and refund newest first, and filters by method, channel and search', () => {
    const entries = ledgerEntries(all);
    expect(entries[0].id).toBe('A101-T3');
    expect(entries.map((e) => e.order.id)).toContain('A102');
    const by = (filters: Partial<Parameters<typeof filterEntries>[1]>) =>
      filterEntries(entries, { method: 'all', channel: 'all', query: '', ...filters }).map(
        (e) => e.id,
      );
    expect(by({ method: 'card' })).toEqual(['A101-T2']);
    expect(by({ channel: 'online' })).toEqual(['A103-refund', 'A103-paid', 'A102-paid']);
    expect(by({ query: 'priya' })).toHaveLength(3);
    expect(by({ query: 'upi 1' })).toEqual(['A102-paid']);
    expect(by({ query: 'abhishek' })).toEqual(['A101-T1']);
    // Table 5's three, and order A105's.
    expect(by({ query: '5' })).toHaveLength(4);
  });
});

describe('the day at a glance', () => {
  it('adds up payments, refunds, tips, what is due and each method', () => {
    const day = daySummary(all);
    expect(day.collected).toBe(300 + 200 + 400 + 450 + 100);
    expect(day.refunds).toBe(50 + 450);
    expect(day.refundsPending).toBe(450);
    expect(day.net).toBe(day.collected - day.refunds);
    expect(day.tips).toBe(20);
    expect(day.payments).toBe(5);
    expect(day.online).toBe(850);
    expect(day.inPerson).toBe(600);
    expect(day.toCollect).toBe(600 + 200 + 250 + 350);
    expect(day.unpaidOrders).toBe(4);
    expect(day.paidOrders).toBe(2);
    expect(day.averageBill).toBe(450);
    expect(day.byMethod.map((m) => m.method)).toEqual(['online', 'cash', 'card', 'counter']);
    // Cash taken and tipped, less cash handed back.
    expect(day.cashInDrawer).toBe(300 + 20 - 50);
  });
});

describe('to collect', () => {
  const asked: BillRequest = {
    id: 'R1',
    kind: 'bill',
    scope: 'table',
    table: 7,
    sessionId: 's',
    requestedAt: '2026-10-15T13:40:00.000Z',
    balance: 250,
  };

  it('groups dine-in by table, tables that asked for the bill first, then oldest first', () => {
    const groups = dueGroups(all, [asked]);
    expect(groups.map((g) => g.key)).toEqual(['table-7', 'order-A107', 'table-12']);
    const twelve = groups[2];
    expect(twelve).toMatchObject({ kind: 'table', due: 800, paid: 100 });
    expect(twelve.kind === 'table' && twelve.orders.map((o) => o.id)).toEqual(['A104', 'A105']);
    expect(groups[0]).toMatchObject({ request: asked });
  });

  it('searches by table, order or guest', () => {
    const groups = dueGroups(all);
    expect(filterGroups(groups, '12').map((g) => g.key)).toEqual(['table-12']);
    expect(filterGroups(groups, 'meera').map((g) => g.key)).toEqual(['order-A107']);
    expect(filterGroups(groups, 'a105').map((g) => g.key)).toEqual(['table-12']);
    expect(filterGroups(groups, '')).toHaveLength(3);
  });
});

describe('collecting', () => {
  it('splits a bill evenly, the last share taking the odd paisa', () => {
    expect(splitShares(100, 3, 100)).toEqual([33.33, 33.33, 33.34]);
    expect(splitShares(525, 2, 100)).toEqual([262.5, 262.5]);
    expect(splitShares(80, 1, 100)).toEqual([80]);
  });

  it('works out tips and change', () => {
    expect(tipFor(525, 10, 100)).toBe(52.5);
    expect(tipFor(333, 5, 1)).toBe(17);
    expect(changeDue(1000, 852.5, 100)).toBe(147.5);
    expect(changeDue(800, 852.5, 100)).toBeNull();
  });

  it('opens on the view in the address', () => {
    expect(parsePaymentsView('refunds')).toBe('refunds');
    expect(parsePaymentsView('nope')).toBe('collect');
    expect(paymentsPath()).toBe('/admin/dashboard/payments/');
    expect(paymentsPath('transactions')).toBe('/admin/dashboard/payments/?view=transactions');
    expect(paymentsPath('refunds', { from: '2026-10-20', to: '2026-10-25' })).toBe(
      '/admin/dashboard/payments/?view=refunds&from=2026-10-20&to=2026-10-25',
    );
  });
});

describe('export', () => {
  it('writes the ledger as CSV, quoting what needs it', () => {
    const entries = ledgerEntries([split]).slice(0, 1);
    const csv = ledgerCsv(entries, ['Order', 'Guest', 'Amount'], (e) => [
      e.order.id,
      'Priya, "P"',
      e.amount,
    ]);
    expect(csv).toBe('Order,Guest,Amount\nA101,"Priya, ""P""",50');
  });
});
