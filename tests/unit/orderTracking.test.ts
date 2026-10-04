import { describe, expect, it } from 'vitest';
import {
  formatOrderDay,
  formatPlaced,
  groupByVisit,
  itemLabel,
  itemStatus,
  orderBill,
  paymentLabel,
  paymentProgress,
  spentTotal,
  totalLabel,
  trackSteps,
} from '@/lib/orders';
import { guestOrders } from '@/api/mock/handlers/orders';
import { simulateOrder } from '@/api/mock/kitchen';
import { createClock } from '@/lib/clock';
import type { Order } from '@/types/order';
import { testBranch, testMenu, testOrderHistory } from '../apiState';

const menu = testMenu();
const branch = testBranch();
const clock = createClock(branch);
const mockOrders = testOrderHistory().history;

const byId = (id: string) => mockOrders.find((o) => o.id === id) as Order;

const placedAt = new Date('2026-10-03T19:00:00+05:30');
const at = (minutes: number) => new Date(placedAt.getTime() + minutes * 60_000);

const placed: Order = {
  ...byId('A104'),
  id: 'A105',
  placedAt: placedAt.toISOString(),
  status: 'received',
  timeline: [{ status: 'received', time: '7:00 PM', note: 'Paid online' }],
  items: byId('A104').items.map((i) => ({ ...i, status: 'queued' as const })),
  etaMinutes: undefined,
  readyBy: undefined,
};

describe('simulateOrder', () => {
  it('starts received, everything queued, ready in 18 min', () => {
    const order = simulateOrder(placed, at(0.5), clock, branch);
    expect(order.status).toBe('received');
    expect(order.etaMinutes).toBe(18);
    expect(order.readyBy).toBe('7:18 PM');
    expect(order.items.map((i) => i.status)).toEqual(['queued', 'queued', 'queued']);
    expect(order.timeline).toEqual(placed.timeline);
  });

  it('moves to preparing with items finishing in turn', () => {
    const order = simulateOrder(placed, at(8), clock, branch);
    expect(order.status).toBe('preparing');
    expect(order.etaMinutes).toBe(10);
    expect(order.timeline.map((e) => [e.status, e.time])).toEqual([
      ['received', '7:00 PM'],
      ['preparing', '7:02 PM'],
    ]);
    // 3 items over 16 min: first ready at 7:07:20, second starting at 7:04:40.
    expect(order.items.map((i) => i.status)).toEqual(['ready', 'preparing', 'preparing']);
  });

  it('is ready, then served, with no ETA', () => {
    const ready = simulateOrder(placed, at(19), clock, branch);
    expect(ready.status).toBe('ready');
    expect(ready.etaMinutes).toBeUndefined();
    expect(ready.items.every((i) => i.status === 'ready')).toBe(true);

    const served = simulateOrder(placed, at(40), clock, branch);
    expect(served.status).toBe('served');
    expect(served.timeline.map((e) => e.status)).toEqual([
      'received',
      'preparing',
      'ready',
      'served',
    ]);
    expect(served.items.every((i) => i.status === 'served')).toBe(true);
  });

  it('keeps a cancelled order unchanged and copes with a clock behind placedAt', () => {
    const cancelled = { ...placed, status: 'cancelled' as const };
    expect(simulateOrder(cancelled, at(30), clock, branch)).toBe(cancelled);
    expect(simulateOrder(placed, at(-5), clock, branch).status).toBe('received');
  });
});

describe('trackSteps', () => {
  it('marks done, current and upcoming steps', () => {
    expect(trackSteps(byId('A104')).map((s) => [s.step, s.state, s.time])).toEqual([
      ['received', 'done', '7:42 PM'],
      ['preparing', 'current', '7:46 PM'],
      ['ready', 'upcoming', undefined],
      ['served', 'upcoming', undefined],
    ]);
  });

  it('shows Received as done and Preparing as up next for a new order', () => {
    const order = {
      mode: 'dineIn' as const,
      status: 'received' as const,
      timeline: [{ status: 'received' as const, time: '8:23 PM' }],
    };
    expect(trackSteps(order).map((s) => [s.step, s.state])).toEqual([
      ['received', 'done'],
      ['preparing', 'next'],
      ['ready', 'upcoming'],
      ['served', 'upcoming'],
    ]);
  });

  it('marks every step done once served', () => {
    expect(trackSteps(byId('A097')).every((s) => s.state === 'done')).toBe(true);
  });
});

describe('display helpers', () => {
  it('keys payment as a status on the timeline', () => {
    const counter = { payment: { method: 'counter' as const, status: 'unpaid' as const } };
    const online = { payment: { method: 'online' as const, status: 'paid' as const } };
    expect(paymentProgress(counter)).toBe('payingAtCounter');
    expect(paymentProgress(online)).toBe('paidOnline');
  });

  it('names the size only when it is not the default', () => {
    const [tikka, pasta, latte] = byId('A104').items;
    expect(itemLabel(tikka, menu)).toBe('1 × Paneer Tikka (Full)');
    expect(itemLabel(pasta, menu)).toBe('1 × Truffle Mushroom Pasta');
    expect(itemLabel(latte, menu)).toBe('2 × Iced Hazelnut Latte');
  });

  it('derives item status from the order when the kitchen has not set one', () => {
    const rohan = byId('A101');
    expect(itemStatus(rohan.items[0], rohan)).toBe('preparing');
    expect(itemStatus(byId('A104').items[1], byId('A104'))).toBe('queued');
  });

  it('keys payment and totals', () => {
    expect(paymentLabel(byId('A104'))).toBe('paidOnline');
    expect(paymentLabel(byId('A097'))).toBe('payAtCounter');
    expect(paymentLabel(byId('A029'))).toBe('refunded');
    expect(totalLabel(byId('A104'))).toBe('totalPaid');
    expect(totalLabel(byId('A097'))).toBe('toPayAtCounter');
  });

  it("rebuilds the drawn bills from the order's lines", () => {
    expect(orderBill(byId('A104'), branch)).toMatchObject({ itemTotal: 1356, total: 1424 });
    for (const id of ['A097', 'A061', 'A033', 'A029', 'A101']) {
      expect(orderBill(byId(id), branch).total).toBe(byId(id).total);
    }
  });

  it('formats placed times relative to today (branch time, IST)', () => {
    const now = new Date('2026-10-03T21:00:00+05:30');
    expect(formatPlaced('2026-10-03T19:42:00+05:30', now, clock)).toBe('7:42 PM');
    expect(formatPlaced('2026-09-12T20:18:00+05:30', now, clock)).toBe('12 Sep 2026, 8:18 PM');
    expect(formatOrderDay('2026-10-03T19:42:00+05:30', now, 'Today', clock)).toBe('Today');
    expect(formatOrderDay('2026-08-28T13:12:00+05:30', now, 'Today', clock)).toBe('28 Aug 2026');
  });
});

describe('order lists', () => {
  it("lists this device's orders and the guest's history, newest first, without other guests'", () => {
    const list = guestOrders([placed], mockOrders);
    expect(list.map((o) => o.id)).not.toContain('A101');
    expect(list).toContain(placed);
    const times = list.map((o) => Date.parse(o.placedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('groups by visit and sums what was spent, leaving out cancelled orders', () => {
    const now = new Date();
    const { today, earlier } = groupByVisit(guestOrders([], mockOrders), now, clock);
    expect(today.map((o) => o.id).sort()).toEqual(['A097', 'A098', 'A104']);
    expect(earlier.map((o) => o.id)).toEqual(['A061', 'A033', 'A029']);
    expect(spentTotal(today)).toBe(1742);
  });
});
