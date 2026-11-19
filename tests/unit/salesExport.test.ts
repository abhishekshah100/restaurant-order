import { describe, expect, it } from 'vitest';
import type { BranchSales, SalesFigures, SalesReport } from '@/api/contracts';
import { salesSheets, type SalesExportWords } from '@/lib/salesExport';

/* The sales report as a workbook: one sheet per part, amounts as numbers, words as given. */

const figures = (netSales: number, orders: number): SalesFigures => ({
  orders,
  itemSales: netSales,
  discounts: 0,
  netSales,
  serviceCharge: 0,
  tax: netSales * 0.13,
  billed: netSales * 1.13,
  averageBill: orders > 0 ? Math.round((netSales * 1.13) / orders) : 0,
  refunds: 0,
});

const report: SalesReport = {
  from: '2026-11-18',
  to: '2026-11-19',
  previous: { from: '2026-11-16', to: '2026-11-17' },
  totals: { ...figures(1000, 4), refunds: 50 },
  before: figures(800, 3),
  cancelled: { orders: 1, billed: 200 },
  days: [
    { day: '2026-11-18', bs: '2083-08-02', orders: 3, netSales: 700 },
    { day: '2026-11-19', bs: '2083-08-03', orders: 1, netSales: 300 },
  ],
  hours: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orders: hour === 19 ? 4 : 0,
    netSales: hour === 19 ? 1000 : 0,
  })),
  byMode: [
    { mode: 'dineIn', orders: 3, netSales: 750, billed: 847.5 },
    { mode: 'takeaway', orders: 1, netSales: 250, billed: 282.5 },
    { mode: 'delivery', orders: 0, netSales: 0, billed: 0 },
  ],
  byMethod: [{ method: 'esewa', channel: 'online', count: 4, amount: 1130, refunds: 0 }],
  dishes: [
    { slug: 'momo', name: 'Momo', category: 'Starters', veg: false, quantity: 6, sales: 600 },
    { name: 'Old special', category: null, veg: true, quantity: 2, sales: 400 },
  ],
  slowDishes: [],
  categories: [{ name: 'Starters', quantity: 6, sales: 600, dishes: 1 }],
  money: {
    itemSales: 1000,
    offers: 0,
    promoCodes: 0,
    staffDiscounts: 0,
    netSales: 1000,
    serviceCharge: 0,
    taxes: [{ labelKey: 'vat', rate: '13', amount: 130 }],
    deliveryFees: 0,
    roundOff: 0,
    other: 0,
    billed: 1130,
    received: 1130,
    refundsByReason: [{ reason: 'complaint', count: 1, amount: 50 }],
    waived: 0,
    netReceived: 1080,
    refundsByDish: [{ name: 'Momo', quantity: 1, amount: 30 }],
  },
  generatedAt: '2026-11-19T10:00:00.000Z',
};

const words: SalesExportWords = {
  sheet: (key) => `S:${key}`,
  column: (key) => key,
  figure: (key) => `F:${key}`,
  mode: (mode) => `M:${mode}`,
  method: (method) => method.toUpperCase(),
  channel: (channel) => channel,
  reason: (reason) => `R:${reason}`,
  tax: (labelKey, rate) => `${labelKey} ${rate}%`,
  money: (key) => `$${key}`,
  yes: 'Yes',
  no: 'No',
  removed: 'Removed',
};

const about = {
  branch: 'Thamel',
  period: '18 Nov – 19 Nov',
  compared: '16 Nov – 17 Nov',
  generated: '19 Nov 2026, 3:45 PM',
  nepal: true,
};

describe('sales workbook', () => {
  const sheets = salesSheets(report, about, words);
  const sheet = (name: string) => sheets.find((s) => s.name === `S:${name}`);

  it('has a sheet for each part of the report', () => {
    expect(sheets.map((s) => s.name)).toEqual([
      'S:report',
      'S:summary',
      'S:days',
      'S:hours',
      'S:modes',
      'S:methods',
      'S:dishes',
      'S:categories',
      'S:money',
    ]);
    expect(sheet('report')?.rows[0]).toEqual(['F:branch', 'Thamel']);
  });

  it('keeps amounts as numbers, with the change against the period before', () => {
    expect(sheet('summary')?.rows[0]).toEqual(['F:netSales', 1000, 800, 25]);
    expect(sheet('summary')?.rows.at(-1)).toEqual(['F:cancelled', 1, '', '']);
    // Nepal: the Nepali date beside each day.
    expect(sheet('days')?.columns).toEqual(['day', 'nepaliDay', 'orders', 'netSales']);
    expect(sheet('days')?.rows[0]).toEqual(['2026-11-18', '2083-08-02', 3, 700]);
    // Only the hours with orders.
    expect(sheet('hours')?.rows).toEqual([['7–8 PM', 4, 1000]]);
    expect(sheet('modes')?.rows[0]).toEqual(['M:dineIn', 3, 750, 847.5, 75]);
    expect(sheet('dishes')?.rows).toEqual([
      [1, 'Momo', 'Starters', 'No', 6, 600],
      [2, 'Old special', 'Removed', 'Yes', 2, 400],
    ]);
  });

  it('writes the money summary as a statement: discounts and refunds negative', () => {
    const money = sheet('money')?.rows ?? [];
    expect(money).toContainEqual(['vat 13%', 130]);
    expect(money).toContainEqual(['$offers', -0]);
    expect(money).toContainEqual(['$refundFor R:complaint', -50]);
    expect(money).toContainEqual(['$netReceived', 1080]);
    // The refunds staff gave, by dish, and what named none: ₹50 in all.
    expect(money).toContainEqual(['1× Momo', 30]);
    expect(money).toContainEqual(['$unlinked', 20]);
  });

  it('adds the branches side by side when they are shown, and the day sheet fits India', () => {
    const branch = (id: string, code: string, net: number): BranchSales => ({
      id,
      name: id,
      shortName: id,
      country: code === 'NPR' ? 'NP' : 'IN',
      money: { locale: 'en-IN', localeFallback: null, code, symbol: '₹', minorUnit: 100 },
      totals: figures(net, 2),
      before: figures(0, 0),
      topDish: null,
    });
    const withBranches = salesSheets(report, { ...about, nepal: false }, words, [
      branch('Thamel', 'NPR', 1000),
      branch('Udyog Vihar', 'INR', 500),
    ]);
    expect(withBranches.at(-1)?.name).toBe('S:branches');
    expect(withBranches.at(-1)?.rows[0]).toEqual(['Thamel', 'NPR', 1000, 0, '', 2, 565, '']);
    expect(withBranches.find((s) => s.name === 'S:days')?.columns).toEqual([
      'day',
      'orders',
      'netSales',
    ]);
  });
});
