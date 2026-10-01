import { describe, expect, it } from 'vitest';
import {
  calculateBill,
  itemCount,
  itemTotal,
  roundToRupee,
  taxPaise,
  taxesAndRoundOffPaise,
} from '@/lib/pricing';

describe('taxPaise', () => {
  it('computes 2.5% and 5% exactly in paise', () => {
    expect(taxPaise(135600, 0.025)).toBe(3390);
    expect(taxPaise(54900, 0.05)).toBe(2745);
  });

  it('rounds half a paisa up', () => {
    // 2.5% of ₹549 = 1372.5 paise
    expect(taxPaise(54900, 0.025)).toBe(1373);
  });

  it('is zero for zero', () => {
    expect(taxPaise(0, 0.05)).toBe(0);
  });
});

describe('roundToRupee', () => {
  it('rounds to the nearest rupee, half up', () => {
    expect(roundToRupee(142380)).toBe(1424);
    expect(roundToRupee(57645)).toBe(576);
    expect(roundToRupee(100590)).toBe(1006);
    expect(roundToRupee(150)).toBe(2);
    expect(roundToRupee(149)).toBe(1);
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

describe('calculateBill — matches the design files', () => {
  it('3-item cart: ₹1,356 → CGST ₹33.90, SGST ₹33.90, round off +₹0.20, pay ₹1,424', () => {
    const bill = calculateBill([
      { unitPrice: 549, quantity: 1 },
      { unitPrice: 409, quantity: 1 },
      { unitPrice: 199, quantity: 2 },
    ]);
    expect(bill).toEqual({
      itemCount: 4,
      itemTotal: 1356,
      itemTotalPaise: 135600,
      cgstPaise: 3390,
      sgstPaise: 3390,
      gstPaise: 6780,
      roundOffPaise: 20,
      total: 1424,
    });
    // "GST 5% + round off ₹68.00"
    expect(taxesAndRoundOffPaise(bill)).toBe(6800);
  });

  it('₹549 → CGST + SGST ₹27.45, round off −₹0.45, pay ₹576', () => {
    const bill = calculateBill([{ unitPrice: 549, quantity: 1 }]);
    expect(bill.gstPaise).toBe(2745);
    expect(bill.cgstPaise + bill.sgstPaise).toBe(2745);
    expect(bill.roundOffPaise).toBe(-45);
    expect(bill.total).toBe(576);
  });

  it('₹958 → CGST + SGST ₹47.90, round off +₹0.10, pay ₹1,006', () => {
    const bill = calculateBill([
      { unitPrice: 549, quantity: 1 },
      { unitPrice: 409, quantity: 1 },
    ]);
    expect(bill.gstPaise).toBe(4790);
    expect(bill.roundOffPaise).toBe(10);
    expect(bill.total).toBe(1006);
  });

  it('splits an odd paisa so CGST + SGST always equals GST', () => {
    const bill = calculateBill([{ unitPrice: 549, quantity: 1 }]);
    expect(bill.cgstPaise).toBe(1373);
    expect(bill.sgstPaise).toBe(1372);
  });

  it('round off is always within ±50 paise and lands on a whole rupee', () => {
    for (let total = 1; total <= 3000; total += 7) {
      const bill = calculateBill([{ unitPrice: total, quantity: 1 }]);
      expect(Math.abs(bill.roundOffPaise)).toBeLessThanOrEqual(50);
      expect(bill.itemTotalPaise + bill.gstPaise + bill.roundOffPaise).toBe(bill.total * 100);
    }
  });

  it('returns zeros for an empty cart', () => {
    const bill = calculateBill([]);
    expect(bill.total).toBe(0);
    expect(bill.roundOffPaise).toBe(0);
  });
});
