import type { OrderMode } from '@/types/branch';
import type { Price } from '@/types/menu';

/*
 * `GET /admin/branches/:branchId/reports/sales?from=&to=` (`reports.view`) — Sales, the manager's
 * report: the days' sales (the branch's calendar, up to a year at a time, back two years; the
 * last 7 days without any) beside the span just before, by day, hour, way of ordering and way of
 * paying. Sales count on the day the order was placed, cancelled orders apart; money (ways of
 * paying, refunds) on the day it moved. 400 (a span that doesn't work), 401, 403, 404.
 */

/** A span's sales (the branch's currency). */
export interface SalesFigures {
  /** Orders placed and not cancelled. */
  orders: number;
  /** The dishes at menu prices. */
  itemSales: Price;
  /** Offers, promo codes and staff discounts. */
  discounts: Price;
  /** itemSales less discounts: before service charge and tax. */
  netSales: Price;
  serviceCharge: Price;
  /** Every tax on the bills (GST, VAT). */
  tax: Price;
  /** What the guests were charged: tax, delivery and the round-off in. */
  billed: Price;
  /** billed ÷ orders. */
  averageBill: Price;
  /** Money staff gave back on these days (complaints, goodwill…). */
  refunds: Price;
}

export interface SalesDay {
  /** "2026-11-19". */
  day: string;
  /** Nepal: the day in the Nepali calendar ("2083-08-03"). */
  bs?: string;
  orders: number;
  netSales: Price;
}

export interface SalesHour {
  /** 0–23, the branch's clock. */
  hour: number;
  orders: number;
  netSales: Price;
}

export interface SalesByMode {
  mode: OrderMode;
  orders: number;
  netSales: Price;
  billed: Price;
}

export interface SalesByMethod {
  method: string;
  channel: 'online' | 'inPerson';
  /** How many payments. */
  count: number;
  amount: Price;
  /** Every refund this way (cancellations too: money that went back). */
  refunds: Price;
}

/** A dish sold in the span: how many and for how much (menu prices, before discounts). */
export interface SalesDish {
  /** The menu's dish; missing for one since removed from the menu for good. */
  slug?: string;
  name: string;
  category: string | null;
  veg: boolean;
  quantity: number;
  sales: Price;
}

/** A dish on the menu that sold least in the span (none at all, perhaps). */
export interface SlowDish {
  slug: string;
  name: string;
  category: string;
  veg: boolean;
  quantity: number;
  /** Added to the menu during the span (it had less time to sell): when, "2026-11-12". */
  addedOn?: string;
}

export interface SalesCategory {
  /** Null: dishes no longer on the menu. */
  name: string | null;
  quantity: number;
  sales: Price;
  /** How many of its dishes sold. */
  dishes: number;
}

/** A tax on the bills, as printed (cart › priceSummary.lines[labelKey] with its rate). */
export interface TaxTotal {
  labelKey: string;
  rate: string;
  amount: Price;
}

/**
 * The money behind the sales, for the accountant: from the dishes to what was billed (the
 * span's orders), then the money that moved on these days.
 */
export interface MoneySummary {
  itemSales: Price;
  /** Automatic offers (happy hour). */
  offers: Price;
  promoCodes: Price;
  /** Discounts staff gave by hand. */
  staffDiscounts: Price;
  netSales: Price;
  serviceCharge: Price;
  taxes: TaxTotal[];
  deliveryFees: Price;
  roundOff: Price;
  /** Whatever else the bills came to (zero when they add up as above). */
  other: Price;
  billed: Price;
  /** Payments taken on these days (tips apart). */
  received: Price;
  /** Money back on these days, by why: staff's reasons, a cancellation, a changed bill. */
  refundsByReason: { reason: string; count: number; amount: Price }[];
  /** Left off bills when they were settled (no change, a regular). */
  waived: Price;
  /** received less every refund. */
  netReceived: Price;
  /** The dishes staff refunds named on these days. */
  refundsByDish: { name: string; quantity: number; amount: Price }[];
}

export interface SalesReport {
  from: string;
  to: string;
  /** The span just before, as long, to compare with. */
  previous: { from: string; to: string };
  totals: SalesFigures;
  before: SalesFigures;
  cancelled: { orders: number; billed: Price };
  /** Every day of the span, quiet ones too, oldest first. */
  days: SalesDay[];
  /** Every hour of the day. */
  hours: SalesHour[];
  byMode: SalesByMode[];
  /** Money that moved on these days, by way of paying, most first. */
  byMethod: SalesByMethod[];
  /** Every dish sold, most sales first. */
  dishes: SalesDish[];
  /** Up to 8 dishes on the menu that sold least, fewest first. */
  slowDishes: SlowDish[];
  /** Menu categories by sales, most first. */
  categories: SalesCategory[];
  money: MoneySummary;
  /** ISO. */
  generatedAt: string;
}

/**
 * `GET /admin/branches/:branchId/reports/sales/branches?from=&to=` (`reports.view` here) — the
 * restaurant's branches side by side, each where the staff member sees reports: its figures in
 * its own calendar and currency (never added to another's), against the span before, and its
 * best seller.
 */
export interface BranchSales {
  id: string;
  name: string;
  shortName: string;
  country: string;
  /** How it writes money: its own currency. */
  money: {
    locale: string;
    localeFallback: string | null;
    code: string;
    symbol: string;
    minorUnit: number;
  };
  totals: SalesFigures;
  before: SalesFigures;
  topDish: { name: string; quantity: number; sales: Price } | null;
}

export interface BranchSalesReport {
  from: string;
  to: string;
  previous: { from: string; to: string };
  /** By name. */
  branches: BranchSales[];
  /** ISO. */
  generatedAt: string;
}
