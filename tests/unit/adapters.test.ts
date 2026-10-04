import { describe, expect, it } from 'vitest';
import { toOrder, toOrderHistory } from '@/api/adapters';
import type { ApiOrder, OrdersResponse, RelativeTime } from '@/types/order';
import { readApiJson, testBranch } from '../apiState';

const india = testBranch();
const nepal = testBranch('ktm-thamel');

const raw = readApiJson<OrdersResponse>('orders');
const relative = raw.history.find((o) => o.placedAt === null) as ApiOrder;
const dated = raw.history.find((o) => o.placedAt !== null) as ApiOrder;
const placed = (placedRelative: RelativeTime): ApiOrder => ({
  ...relative,
  placedAt: null,
  placedRelative,
});

describe('toOrder', () => {
  it("dates a relative mock order on today's restaurant day (IST)", () => {
    // 23:30 UTC on 2 Oct is already 3 Oct in India.
    const now = new Date('2026-10-02T23:30:00Z');
    const order = toOrder(placed({ daysAgo: 0, time: '19:42' }), india, now);
    expect(order.placedAt).toBe('2026-10-03T19:42:00+05:30');
    expect(order).not.toHaveProperty('placedRelative');
    expect(order.id).toBe(relative.id);
    expect(order.timeline).toEqual(relative.timeline);
  });

  it('counts days back from today', () => {
    const now = new Date('2026-10-03T12:00:00+05:30');
    const order = toOrder(placed({ daysAgo: 2, time: '08:05' }), india, now);
    expect(order.placedAt).toBe('2026-10-01T08:05:00+05:30');
  });

  it("dates it in the branch's own time zone", () => {
    const now = new Date('2026-10-03T12:00:00Z');
    const order = toOrder(placed({ daysAgo: 0, time: '19:42' }), nepal, now);
    expect(order.placedAt).toBe('2026-10-03T19:42:00+05:45');
  });

  it('passes a real placedAt through untouched', () => {
    expect(toOrder(dated, india)).toBe(dated);
  });
});

describe('toOrderHistory', () => {
  it("adapts the branch's orders and keeps the id pool", () => {
    const now = new Date('2026-10-03T21:00:00+05:30');
    const { history, newOrderIds } = toOrderHistory(raw, india, now);
    expect(history.map((o) => o.id)).toEqual(raw.history.map((o) => o.id));
    expect(history.every((o) => !Number.isNaN(Date.parse(o.placedAt)))).toBe(true);
    expect(history.find((o) => o.id === 'A104')?.placedAt).toBe('2026-10-03T19:42:00+05:30');
    expect(newOrderIds).toBe(raw.newOrderIds);
  });

  it("leaves out other branches' orders", () => {
    expect(toOrderHistory(raw, nepal).history).toEqual([]);
  });
});
