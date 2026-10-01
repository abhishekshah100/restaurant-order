import type { Rupees } from '@/types/menu';

/** GST on restaurant food: 5%, split equally as CGST 2.5% + SGST 2.5%. */
export const CGST_RATE = 0.025;
export const SGST_RATE = 0.025;
export const GST_RATE = CGST_RATE + SGST_RATE;

export interface PriceLine {
  unitPrice: Rupees;
  quantity: number;
}

/** Bill breakdown. Tax lines are in paise so ₹33.90 shows exactly; `total` is whole rupees. */
export interface Bill {
  itemCount: number;
  /** Sum of line totals, in rupees. */
  itemTotal: Rupees;
  itemTotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  gstPaise: number;
  /** Signed paise added to reach a whole rupee, e.g. +20 or −45. */
  roundOffPaise: number;
  /** Amount payable, rounded to the nearest rupee. */
  total: Rupees;
}

/** Tax on an amount in paise at `rate`, rounded half-up to the nearest paisa. */
export function taxPaise(amountPaise: number, rate: number): number {
  // Work in integer basis points to avoid floating point drift (e.g. 2.5% of 135600).
  const bps = Math.round(rate * 10000);
  return Math.floor((amountPaise * bps + 5000) / 10000);
}

export function lineTotal(line: PriceLine): Rupees {
  return line.unitPrice * line.quantity;
}

export function itemTotal(lines: readonly PriceLine[]): Rupees {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

export function itemCount(lines: readonly PriceLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** Rounds paise to the nearest whole rupee (half up), returning rupees. */
export function roundToRupee(paise: number): Rupees {
  return Math.floor((paise + 50) / 100);
}

export function calculateBill(lines: readonly PriceLine[]): Bill {
  const total = itemTotal(lines);
  const itemTotalPaise = total * 100;
  // GST is computed once at 5% so the combined line is exact (₹549 → ₹27.45),
  // then split; any odd paisa goes to CGST so CGST + SGST always equals GST.
  const gstPaise = taxPaise(itemTotalPaise, GST_RATE);
  const sgstPaise = Math.floor(gstPaise / 2);
  const cgstPaise = gstPaise - sgstPaise;
  const grossPaise = itemTotalPaise + gstPaise;
  const payable = roundToRupee(grossPaise);
  return {
    itemCount: itemCount(lines),
    itemTotal: total,
    itemTotalPaise,
    cgstPaise,
    sgstPaise,
    gstPaise,
    roundOffPaise: payable * 100 - grossPaise,
    total: payable,
  };
}

/** GST plus round-off in paise — the combined "GST 5% + round off" line. */
export function taxesAndRoundOffPaise(bill: Bill): number {
  return bill.gstPaise + bill.roundOffPaise;
}
