import { describe, expect, it } from 'vitest';
import type { SalesDay, SalesHour } from '@/api/contracts';
import {
  axisDay,
  bestAndQuietest,
  changeOf,
  compactAmount,
  dayParts,
  grainOf,
  hourStep,
  hourWindow,
  nepaliDay,
  niceTicks,
  openHours,
  peakHours,
  presetOf,
  rangeText,
  salesPresets,
  shareOf,
  shortDay,
  trendBuckets,
  unlinkedRefunds,
} from '@/lib/salesReport';

/* Sales: the ranges it offers, changes against the span before, and the charts' shapes. */

const day = (key: string, netSales: number, orders = netSales > 0 ? 1 : 0): SalesDay => ({
  day: key,
  netSales,
  orders,
});

describe('sales report', () => {
  it('offers the spans managers reach for, fiscal years when the branch has them', () => {
    const presets = salesPresets('2026-11-19', {
      current: { from: '2026-07-17', to: '2027-07-16', label: '2083-84' },
      previous: { from: '2025-07-17', to: '2026-07-16', label: '2082-83' },
    });
    expect(presets.map((p) => [p.key, p.range.from, p.range.to])).toEqual([
      ['today', '2026-11-19', '2026-11-19'],
      ['yesterday', '2026-11-18', '2026-11-18'],
      ['week', '2026-11-13', '2026-11-19'],
      ['month', '2026-10-21', '2026-11-19'],
      ['thisMonth', '2026-11-01', '2026-11-19'],
      ['lastMonth', '2026-10-01', '2026-10-31'],
      // This year runs to today, not to days still to come.
      ['thisFy', '2026-07-17', '2026-11-19'],
      ['lastFy', '2025-07-17', '2026-07-16'],
    ]);
    expect(presetOf(presets, { from: '2026-11-13', to: '2026-11-19' })?.key).toBe('week');
    expect(presetOf(presets, { from: '2026-11-12', to: '2026-11-19' })).toBeUndefined();
    // On the 1st, last month is the whole of it; no fiscal years without them.
    expect(salesPresets('2026-03-01').find((p) => p.key === 'lastMonth')?.range).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(salesPresets('2026-03-01').some((p) => p.key === 'thisFy')).toBe(false);
  });

  it('says how a figure moved, and whether that is good news', () => {
    expect(changeOf(112, 100)).toEqual({ percent: 12, direction: 'up', tone: 'good' });
    expect(changeOf(90, 100)).toEqual({ percent: -10, direction: 'down', tone: 'bad' });
    // More refunds is bad news; fewer is good.
    expect(changeOf(150, 100, false)).toMatchObject({ direction: 'up', tone: 'bad' });
    expect(changeOf(50, 100, false)).toMatchObject({ direction: 'down', tone: 'good' });
    expect(changeOf(100, 100)).toEqual({ percent: 0, direction: 'flat', tone: 'neutral' });
    // Nothing before: no percent to give.
    expect(changeOf(500, 0)).toEqual({ percent: null, direction: 'up', tone: 'good' });
  });

  it('draws days while they fit, then weeks, then months', () => {
    expect(grainOf(7)).toBe('day');
    expect(grainOf(45)).toBe('day');
    expect(grainOf(91)).toBe('week');
    expect(grainOf(365)).toBe('month');

    const days = [
      day('2026-10-30', 100.1),
      day('2026-10-31', 200.2),
      day('2026-11-01', 300.3),
      day('2026-11-02', 0),
    ];
    expect(trendBuckets(days, 'day')).toHaveLength(4);
    expect(trendBuckets(days, 'month')).toEqual([
      { from: '2026-10-30', to: '2026-10-31', netSales: 300.3, orders: 2 },
      { from: '2026-11-01', to: '2026-11-02', netSales: 300.3, orders: 1 },
    ]);
    const fortnight = Array.from({ length: 10 }, (_, i) =>
      day(`2026-11-${String(i + 1).padStart(2, '0')}`, 10),
    );
    expect(trendBuckets(fortnight, 'week').map((b) => [b.from, b.to, b.netSales])).toEqual([
      ['2026-11-01', '2026-11-07', 70],
      ['2026-11-08', '2026-11-10', 30],
    ]);
  });

  it('finds the best and quietest days that had sales', () => {
    const days = [day('2026-11-17', 900), day('2026-11-18', 0), day('2026-11-19', 300)];
    expect(bestAndQuietest(days)).toMatchObject({
      best: { day: '2026-11-17' },
      quiet: { day: '2026-11-19' },
    });
    expect(bestAndQuietest([day('2026-11-17', 900)])).toBeNull();
  });

  it('keeps the open hours and names the busiest', () => {
    const hours: SalesHour[] = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orders: hour >= 11 && hour <= 21 && hour !== 16 ? 2 : 0,
      netSales:
        hour === 19 ? 900 : hour === 13 ? 700 : hour >= 11 && hour <= 21 && hour !== 16 ? 100 : 0,
    }));
    expect(openHours(hours).map((h) => h.hour)).toEqual([
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    ]);
    expect(peakHours(hours).map((h) => h.hour)).toEqual([19, 13]);
    expect(openHours(hours.map((h) => ({ ...h, orders: 0 })))).toEqual([]);
    expect(hourWindow(19)).toBe('7–8 PM');
    expect(hourWindow(11)).toBe('11 AM–12 PM');
    expect(hourWindow(23)).toBe('11 PM–12 AM');
  });

  it('splits the day into its parts, late night past midnight', () => {
    const hours: SalesHour[] = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orders: 1,
      netSales: hour === 0 || hour === 23 ? 50 : 100,
    }));
    expect(dayParts(hours).map((p) => [p.key, p.from, p.to, p.orders, p.netSales])).toEqual([
      ['morning', 6, 11, 5, 500],
      ['lunch', 11, 15, 4, 400],
      ['afternoon', 15, 18, 3, 300],
      ['dinner', 18, 22, 4, 400],
      // 10 PM to 6 AM: 22, 23 (50) and 0 (50) to 5.
      ['late', 22, 6, 8, 100 + 50 + 50 + 500],
    ]);
  });

  it('labels the hours sparsely enough for any opening hours', () => {
    expect(hourStep(6)).toBe(1);
    expect(hourStep(11)).toBe(2);
    // Open 8 AM to 11 PM: 16 hours, labelled every 3 (9 AM, 12 PM, 3 PM, 6 PM, 9 PM).
    expect(hourStep(16)).toBe(3);
    expect(hourStep(24)).toBe(4);
  });

  it('finds the staff refunds that named no dish', () => {
    // ₹250 given back, ₹180.40 of it for named dishes: ₹69.60 named none.
    expect(unlinkedRefunds(250, [{ amount: 100.2 }, { amount: 80.2 }])).toBe(69.6);
    expect(unlinkedRefunds(100, [{ amount: 100 }])).toBe(0);
    expect(unlinkedRefunds(40, [])).toBe(40);
    // Never below nothing (a refund named dishes on another day's figures).
    expect(unlinkedRefunds(10, [{ amount: 30 }])).toBe(0);
  });

  it('writes a span of days with the year once', () => {
    expect(rangeText('2026-11-19', '2026-11-19')).toBe('Thu 19 Nov 2026');
    expect(rangeText('2026-11-01', '2026-11-19')).toBe('1–19 Nov 2026');
    expect(rangeText('2026-10-21', '2026-11-19')).toBe('21 Oct – 19 Nov 2026');
    expect(rangeText('2025-12-21', '2026-01-19')).toBe('21 Dec 2025 – 19 Jan 2026');
  });

  it('labels axes and shares cleanly', () => {
    expect(niceTicks(48_200)).toEqual([0, 20_000, 40_000, 60_000]);
    expect(niceTicks(900)).toEqual([0, 250, 500, 750, 1000]);
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(shareOf(68, 100)).toBe(68);
    expect(shareOf(5, 0)).toBe(0);
    expect(compactAmount(125_000, 'en-IN', '₹')).toBe('₹1.3L');
    expect(compactAmount(45_000, 'en-US', 'रू')).toBe('रू 45K');
    expect(shortDay('2026-11-15')).toBe('Sun 15 Nov');
    expect(axisDay('2026-11-15', 'day', true)).toBe('15 Nov');
    expect(axisDay('2026-11-16', 'day', false)).toBe('16');
    expect(axisDay('2026-12-01', 'day', false)).toBe('1 Dec');
    expect(axisDay('2026-12-01', 'month', false)).toBe('Dec');
    expect(axisDay('2026-08-14', 'week', false)).toBe('14 Aug');
    expect(
      nepaliDay('2083-08-03', [
        'Baisakh',
        'Jestha',
        'Asar',
        'Shrawan',
        'Bhadra',
        'Asoj',
        'Kartik',
        'Mangsir',
      ]),
    ).toBe('3 Mangsir');
  });
});
