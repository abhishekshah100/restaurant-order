import { describe, expect, it } from 'vitest';
import {
  calculateBill,
  extrasMinor,
  itemCount,
  itemTotal,
  percentOf,
  roundTo,
  totalTaxRate,
  type Bill,
} from '@/lib/pricing';
import { testBranch } from '../apiState';

const india = testBranch();
const nepal = testBranch('ktm-thamel');

/** A line's amount by id, including split parts (CGST, SGST). */
function amount(bill: Bill, id: string): number | undefined {
  const all = bill.lines.flatMap((l) => [l, ...(l.parts ?? [])]);
  return all.find((l) => l.id === id)?.amountMinor;
}

describe('percentOf', () => {
  it('computes 2.5% and 5% exactly in paise', () => {
    expect(percentOf(135600, 250)).toBe(3390);
    expect(percentOf(54900, 500)).toBe(2745);
  });

  it('rounds half a paisa up', () => {
    // 2.5% of ₹549 = 1372.5 paise
    expect(percentOf(54900, 250)).toBe(1373);
  });

  it('is zero for zero', () => {
    expect(percentOf(0, 500)).toBe(0);
  });
});

describe('roundTo', () => {
  it('rounds to the nearest whole rupee, half up', () => {
    expect(roundTo(142380, 100)).toBe(142400);
    expect(roundTo(57645, 100)).toBe(57600);
    expect(roundTo(100590, 100)).toBe(100600);
    expect(roundTo(150, 100)).toBe(200);
    expect(roundTo(149, 100)).toBe(100);
  });
});

describe('itemTotal / itemCount', () => {
  const lines = [
    { unitPrice: 549, quantity: 1 },
    { unitPrice: 409, quantity: 1 },
    { unitPrice: 199, quantity: 2 },
  ];
  it('sums line totals', () => expect(itemTotal(lines)).toBe(1356));
  it('sums quantities', () => expect(itemCount(lines)).toBe(4));
  it('handles an empty cart', () => {
    expect(itemTotal([])).toBe(0);
    expect(itemCount([])).toBe(0);
  });
});

describe('calculateBill: India (GST 5% as CGST + SGST) matches the design files', () => {
  it('3-item cart: ₹1,356 → CGST ₹33.90, SGST ₹33.90, round off +₹0.20, pay ₹1,424', () => {
    const bill = calculateBill(
      [
        { unitPrice: 549, quantity: 1 },
        { unitPrice: 409, quantity: 1 },
        { unitPrice: 199, quantity: 2 },
      ],
      india,
    );
    expect(bill).toMatchObject({
      itemCount: 4,
      itemTotal: 1356,
      itemTotalMinor: 135600,
      serviceCharged: false,
      roundOffMinor: 20,
      showRoundOff: true,
      totalMinor: 142400,
      total: 1424,
    });
    expect(bill.lines).toEqual([
      {
        id: 'gst',
        labelKey: 'gst',
        vars: { rate: '5' },
        amountMinor: 6780,
        parts: [
          { id: 'cgst', labelKey: 'cgst', vars: { rate: '2.5' }, amountMinor: 3390 },
          { id: 'sgst', labelKey: 'sgst', vars: { rate: '2.5' }, amountMinor: 3390 },
        ],
      },
    ]);
    // "GST 5% + round off ₹68.00"
    expect(extrasMinor(bill)).toBe(6800);
    expect(totalTaxRate(india.tax)).toBe('5');
  });

  it('₹549 → CGST + SGST ₹27.45, round off −₹0.45, pay ₹576', () => {
    const bill = calculateBill([{ unitPrice: 549, quantity: 1 }], india);
    expect(amount(bill, 'gst')).toBe(2745);
    expect(bill.roundOffMinor).toBe(-45);
    expect(bill.total).toBe(576);
  });

  it('₹958 → CGST + SGST ₹47.90, round off +₹0.10, pay ₹1,006', () => {
    const bill = calculateBill(
      [
        { unitPrice: 549, quantity: 1 },
        { unitPrice: 409, quantity: 1 },
      ],
      india,
    );
    expect(amount(bill, 'gst')).toBe(4790);
    expect(bill.roundOffMinor).toBe(10);
    expect(bill.total).toBe(1006);
  });

  it('splits an odd paisa so CGST + SGST always equals GST', () => {
    const bill = calculateBill([{ unitPrice: 549, quantity: 1 }], india);
    expect(amount(bill, 'cgst')).toBe(1373);
    expect(amount(bill, 'sgst')).toBe(1372);
  });

  it('round off is always within ±50 paise and lands on a whole rupee', () => {
    for (let total = 1; total <= 3000; total += 7) {
      const bill = calculateBill([{ unitPrice: total, quantity: 1 }], india);
      expect(Math.abs(bill.roundOffMinor)).toBeLessThanOrEqual(50);
      expect(bill.itemTotalMinor + (amount(bill, 'gst') ?? 0) + bill.roundOffMinor).toBe(
        bill.total * 100,
      );
    }
  });

  it('returns zeros for an empty cart', () => {
    const bill = calculateBill([], india);
    expect(bill.total).toBe(0);
    expect(bill.roundOffMinor).toBe(0);
  });
});

describe('calculateBill: Nepal (10% service charge, then 13% VAT on items + service)', () => {
  it('रू 2,280 → service रू 228, VAT रू 326.04, round off −रू 0.04, pay रू 2,834', () => {
    const bill = calculateBill(
      [
        { unitPrice: 880, quantity: 1 },
        { unitPrice: 655, quantity: 1 },
        { unitPrice: 745, quantity: 1 },
      ],
      nepal,
    );
    expect(bill).toMatchObject({
      itemTotal: 2280,
      itemTotalMinor: 228000,
      serviceCharged: true,
      roundOffMinor: -4,
      totalMinor: 283400,
      total: 2834,
    });
    expect(bill.lines).toEqual([
      { id: 'serviceCharge', labelKey: 'serviceCharge', vars: { rate: '10' }, amountMinor: 22800 },
      { id: 'vat', labelKey: 'vat', vars: { rate: '13' }, amountMinor: 32604 },
    ]);
    expect(extrasMinor(bill)).toBe(55400);
  });

  it('charges VAT on the service charge too, and rounds half up', () => {
    // 460 → service 46.00 → VAT 13% of 506 = 65.78 → 571.78 → 572
    const bill = calculateBill([{ unitPrice: 460, quantity: 1 }], nepal);
    expect(amount(bill, 'serviceCharge')).toBe(4600);
    expect(amount(bill, 'vat')).toBe(6578);
    expect(bill.roundOffMinor).toBe(22);
    expect(bill.total).toBe(572);
  });

  it('has no GST lines', () => {
    const bill = calculateBill([{ unitPrice: 525, quantity: 2 }], nepal);
    expect(bill.lines.map((l) => l.id)).toEqual(['serviceCharge', 'vat']);
  });
});
