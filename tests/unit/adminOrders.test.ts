import { describe, expect, it } from 'vitest';
import { ordersPath } from '@/lib/adminNav';
import {
  editableRound,
  filterOrders,
  modeCounts,
  nextAction,
  parseView,
  todayTotals,
  viewCounts,
} from '@/lib/adminOrders';
import type { Order } from '@/types/order';

/* The Orders page's logic: views, type and search filters, counts, today's totals, actions. */

const order = (id: string, fields: Partial<Order>): Order =>
  ({
    id,
    branchId: 'blr-indiranagar',
    mode: 'dineIn',
    customerName: 'Guest',
    placedBy: 'other',
    placedAt: '2026-10-15T13:00:00.000Z',
    status: 'received',
    items: [],
    itemTotal: 500,
    total: 525,
    payment: { method: 'counter', status: 'unpaid' },
    timeline: [],
    ...fields,
  }) as Order;

const preparing = order('A101', { table: 5, customerName: 'Priya', status: 'preparing' });
const ready = order('A102', { table: 7, status: 'ready' });
const pickup = order('A103', { mode: 'takeaway', status: 'ready', customerName: 'Meera' });
const servedUnpaid = order('A104', { table: 12, status: 'served' });
const paid = order('A105', {
  table: 3,
  status: 'served',
  payment: { method: 'online', status: 'paid' },
});
const cancelled = order('A106', { table: 9, status: 'cancelled' });
const delivered = order('A107', {
  mode: 'delivery',
  status: 'delivered',
  payment: { method: 'online', status: 'paid' },
});
const all = [preparing, ready, pickup, servedUnpaid, paid, cancelled, delivered];
const ids = (orders: Order[]) => orders.map((o) => o.id);

describe('orders page', () => {
  it('lists each view: active, ready, unpaid, completed, cancelled, all', () => {
    const view = (v: Parameters<typeof filterOrders>[1]['view']) =>
      ids(filterOrders(all, { view: v, mode: 'all', query: '' }));
    expect(view('active')).toEqual(['A101', 'A102', 'A103']);
    expect(view('ready')).toEqual(['A102', 'A103']);
    expect(view('unpaid')).toEqual(['A101', 'A102', 'A103', 'A104']);
    expect(view('completed')).toEqual(['A104', 'A105', 'A107']);
    expect(view('cancelled')).toEqual(['A106']);
    expect(view('all')).toHaveLength(7);
  });

  it('filters by type and searches the number, the guest and the table', () => {
    const find = (query: string, mode: 'all' | 'takeaway' = 'all') =>
      ids(filterOrders(all, { view: 'all', mode, query }));
    expect(find('', 'takeaway')).toEqual(['A103']);
    expect(find('a101')).toEqual(['A101']);
    expect(find('105')).toEqual(['A105']);
    expect(find('meera')).toEqual(['A103']);
    expect(find('12')).toEqual(['A104']);
  });

  it('counts views within the type filter, and types within the view', () => {
    expect(viewCounts(all, { mode: 'dineIn', query: '' })).toMatchObject({
      active: 2,
      ready: 1,
      unpaid: 3,
      cancelled: 1,
    });
    expect(modeCounts(all, { view: 'ready', query: '' })).toEqual({
      all: 2,
      dineIn: 1,
      takeaway: 1,
      delivery: 0,
    });
  });

  it("totals today's orders, sales and what's still to collect (not cancelled)", () => {
    expect(todayTotals(all)).toEqual({ count: 6, sales: 525 * 6, toCollect: 525 * 4 });
  });

  it('offers the one action an order needs next', () => {
    expect(nextAction(ready)).toBe('serve');
    expect(nextAction(pickup)).toBe('handOver');
    expect(nextAction(servedUnpaid)).toBe('collect');
    expect(nextAction(preparing)).toBeNull();
    expect(nextAction(paid)).toBeNull();
    expect(nextAction(cancelled)).toBeNull();
  });

  it('keeps the view in the address', () => {
    expect(parseView('unpaid')).toBe('unpaid');
    expect(parseView(null)).toBe('active');
    expect(parseView('nope')).toBe('active');
    expect(ordersPath('active')).toBe('/admin/dashboard/orders/');
    expect(ordersPath('completed')).toBe('/admin/dashboard/orders/?view=completed');
  });
});

describe('changing an order', () => {
  const round = (number: number, status: Order['status']) =>
    ({ number, status, items: [], placedAt: '', timeline: [], changeableUntil: '' }) as NonNullable<
      Order['rounds']
    >[number];

  it("offers the latest round the kitchen hasn't finished, dine-in only", () => {
    expect(editableRound(preparing)?.number).toBe(1);
    expect(editableRound(ready)).toBeNull();
    expect(editableRound(order('A108', { mode: 'takeaway', status: 'received' }))).toBeNull();
    const tab = order('A109', {
      table: 5,
      status: 'preparing',
      rounds: [round(1, 'served'), round(2, 'preparing'), round(3, 'cancelled')],
    });
    expect(editableRound(tab)?.number).toBe(2);
    const served = order('A110', { table: 5, rounds: [round(1, 'ready'), round(2, 'served')] });
    expect(editableRound(served)).toBeNull();
  });
});
