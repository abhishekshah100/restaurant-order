import type { BillLineKey, Branch, TaxConfig } from '@/types/branch';
import type { Price } from '@/types/menu';
import type { OfferLabelKey } from '@/types/promotion';

interface PriceLine {
  unitPrice: Price;
  quantity: number;
}

/** A charge on the bill: the service charge or a tax. Amounts are in minor units (paise). */
export interface BillLine {
  id: string;
  labelKey: BillLineKey;
  /** Fills the label's {rate}: "2.5" for 250 basis points. */
  vars: { rate: string };
  amountMinor: number;
  /** The line as shown on a split bill (CGST and SGST for GST); they add up to `amountMinor`. */
  parts?: BillLine[];
}

/** A discount on the bill, in minor units: an automatic offer (happy hour) or a promo code. */
export type BillDiscount =
  | { kind: 'offer'; id: string; labelKey: OfferLabelKey; amountMinor: number }
  | { kind: 'code'; code: string; amountMinor: number };

/** Bill breakdown, worked out from the branch's tax rules (GET /branches › tax). */
export interface Bill {
  itemCount: number;
  /** Sum of line totals at menu prices (before discounts), in major units. */
  itemTotal: Price;
  itemTotalMinor: number;
  /** Discount lines, shown after the item total: automatic offers first, then a promo code. */
  discounts: BillDiscount[];
  /** Everything the discounts take off (never more than the item total). */
  discountMinor: number;
  /** The service charge (when the branch adds one), then each tax, in the order applied. */
  lines: BillLine[];
  /** The branch adds a service charge (otherwise the cart says "Service charge · Not added"). */
  serviceCharged: boolean;
  /** Delivery orders: the delivery fee in minor units (0 when free); null for other orders. */
  deliveryFeeMinor: number | null;
  /** Signed minor units added to reach the rounding unit, e.g. +20 or −45. */
  roundOffMinor: number;
  showRoundOff: boolean;
  totalMinor: number;
  /** Amount payable, in major units. */
  total: Price;
}

/** "2.5" for 250 basis points, "13" for 1300. */
export const formatRate = (rateBp: number) => String(rateBp / 100);

/** `rateBp` basis points of an amount in minor units, rounded half up to a whole minor unit. */
export function percentOf(amountMinor: number, rateBp: number): number {
  // Integer maths, so 2.5% of 135600 is exact.
  return Math.floor((amountMinor * rateBp + 5000) / 10000);
}

/** Rounds to the nearest multiple of `unit` (half up). */
export function roundTo(amountMinor: number, unit: number): number {
  return Math.floor((amountMinor + unit / 2) / unit) * unit;
}

const lineTotal = (line: PriceLine): Price => line.unitPrice * line.quantity;

export function itemTotal(lines: readonly PriceLine[]): Price {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

export function itemCount(lines: readonly PriceLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * Splits a tax amount by its parts' rates. The first part takes any odd minor unit, so the
 * parts always add up to the whole (₹27.45 GST → CGST ₹13.73 + SGST ₹13.72).
 */
function splitAmount(amountMinor: number, parts: readonly { rateBp: number }[]): number[] {
  const totalBp = parts.reduce((sum, p) => sum + p.rateBp, 0);
  const rest = parts.slice(1).map((p) => Math.floor((amountMinor * p.rateBp) / totalBp));
  return [amountMinor - rest.reduce((sum, n) => sum + n, 0), ...rest];
}

/** What a bill needs from a branch: its tax rules and currency. */
export type BillRules = Pick<Branch, 'tax' | 'currency'>;

/** Charges on a delivery order besides the items. */
export interface DeliveryCharge {
  /** In major units; 0 when delivery is free. */
  fee: Price;
  /** Taxed like the items (GET /branches › modes.delivery.feeTaxable); otherwise added after tax. */
  taxable: boolean;
}

/**
 * The bill for some lines under a branch's tax rules: the discounts off the item total, the
 * service charge on what's left, each tax on its base (computed once, then split into its
 * parts), and the total rounded to the rounding unit with the difference as the round-off line.
 * Prices exclude tax. With `tax.discountBeforeTax` the charges are worked out on the discounted
 * item total; otherwise on the full one, with the discounts taken off the taxed total. A
 * delivery fee is added to the total, and to each tax's base when the branch taxes it (never to
 * the service charge's).
 */
export function calculateBill(
  lines: readonly PriceLine[],
  { tax, currency }: BillRules,
  delivery?: DeliveryCharge,
  discounts: readonly BillDiscount[] = [],
): Bill {
  const { minorUnit } = currency;
  const total = itemTotal(lines);
  const itemTotalMinor = Math.round(total * minorUnit);
  const discountMinor = Math.min(
    itemTotalMinor,
    discounts.reduce((sum, d) => sum + d.amountMinor, 0),
  );
  // What the service charge and taxes are worked out on.
  const chargedMinor = tax.discountBeforeTax ? itemTotalMinor - discountMinor : itemTotalMinor;
  const feeMinor = delivery ? Math.round(delivery.fee * minorUnit) : 0;
  const taxedFeeMinor = delivery?.taxable ? feeMinor : 0;
  const service = tax.serviceCharge;
  const serviceMinor = service ? percentOf(chargedMinor, service.rateBp) : 0;
  const billLines: BillLine[] = service
    ? [
        {
          id: 'serviceCharge',
          labelKey: service.labelKey,
          vars: { rate: formatRate(service.rateBp) },
          amountMinor: serviceMinor,
        },
      ]
    : [];

  for (const line of tax.lines) {
    const items = chargedMinor + taxedFeeMinor;
    const base = line.base === 'items' ? items : items + serviceMinor;
    const amountMinor = percentOf(base, line.rateBp);
    const taxLine: BillLine = {
      id: line.id,
      labelKey: line.labelKey,
      vars: { rate: formatRate(line.rateBp) },
      amountMinor,
    };
    if (line.splitInto) {
      const split = splitAmount(amountMinor, line.splitInto);
      taxLine.parts = line.splitInto.map((p, i) => ({
        id: p.id,
        labelKey: p.labelKey,
        vars: { rate: formatRate(p.rateBp) },
        amountMinor: split[i],
      }));
    }
    billLines.push(taxLine);
  }

  const grossMinor = billLines.reduce(
    (sum, l) => sum + l.amountMinor,
    itemTotalMinor - discountMinor + feeMinor,
  );
  const totalMinor = roundTo(grossMinor, tax.rounding.unit);
  return {
    itemCount: itemCount(lines),
    itemTotal: total,
    itemTotalMinor,
    discounts: [...discounts],
    discountMinor,
    lines: billLines,
    serviceCharged: Boolean(service),
    deliveryFeeMinor: delivery ? feeMinor : null,
    roundOffMinor: totalMinor - grossMinor,
    showRoundOff: tax.rounding.showRoundOff,
    totalMinor,
    total: totalMinor / minorUnit,
  };
}

/**
 * Charges, taxes and round off on top of the discounted items (and delivery fee): the one-line
 * summary.
 */
export const extrasMinor = (bill: Bill) =>
  bill.totalMinor - (bill.itemTotalMinor - bill.discountMinor) - (bill.deliveryFeeMinor ?? 0);

/** Sum of the tax rates (not the service charge), for the "GST {rate}% + round off" label. */
export const totalTaxRate = (tax: TaxConfig) =>
  formatRate(tax.lines.reduce((sum, l) => sum + l.rateBp, 0));
