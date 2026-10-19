import type { CountryCodeMaster } from './regions';

/*
 * Master values for tax: every tax and charge the app knows, where it applies, what it's
 * charged on, and its rate over time (effective dates). A branch's bill uses the lines in its
 * own tax settings (GET /branches › tax, Settings › Tax & service charge); this is the catalogue
 * those come from. Words: cart › priceSummary.lines (the bill line) and common › masters.taxTypes.
 */

/** What a tax or charge is worked out on. */
export const TAX_BASES = ['items', 'itemsPlusService', 'deliveryFee'] as const;
export type TaxBase = (typeof TAX_BASES)[number];

export interface TaxRatePeriod {
  /** Basis points: 500 = 5%. */
  rateBp: number;
  /** First day it applies, "YYYY-MM-DD" (branch's calendar). */
  from: string;
  /** Last day it applies; open-ended when absent. */
  to?: string;
}

export interface TaxTypeMaster {
  /** A tax the law sets, or a charge the restaurant chooses. */
  kind: 'tax' | 'charge';
  /** Countries it applies in (empty: anywhere). */
  countries: readonly CountryCodeMaster[];
  /** What it may be charged on. */
  appliesTo: readonly TaxBase[];
  /** Shown on the bill as these parts (GST → CGST + SGST), each an equal share. */
  parts?: readonly string[];
  /** Its rate over time, oldest first (dummy dates: when the app's configuration starts). */
  rates: readonly TaxRatePeriod[];
}

export const TAX_TYPES = {
  gst: {
    kind: 'tax',
    countries: ['IN'],
    appliesTo: ['items', 'deliveryFee'],
    parts: ['cgst', 'sgst'],
    rates: [{ rateBp: 500, from: '2024-04-01' }],
  },
  vat: {
    kind: 'tax',
    countries: ['NP'],
    appliesTo: ['items', 'itemsPlusService', 'deliveryFee'],
    rates: [{ rateBp: 1300, from: '2024-04-01' }],
  },
  serviceCharge: {
    kind: 'charge',
    countries: [],
    appliesTo: ['items'],
    rates: [{ rateBp: 1000, from: '2024-04-01' }],
  },
} as const satisfies Record<string, TaxTypeMaster>;
export type TaxTypeCode = keyof typeof TAX_TYPES;
export const TAX_TYPE_CODES = Object.keys(TAX_TYPES) as TaxTypeCode[];

/** The rate (basis points) of a tax on a day ("YYYY-MM-DD"), or null when none applies then. */
export function taxRateOn(type: TaxTypeCode, day: string): number | null {
  const periods: readonly TaxRatePeriod[] = TAX_TYPES[type].rates;
  const period = periods.findLast((p) => p.from <= day && (p.to === undefined || day <= p.to));
  return period?.rateBp ?? null;
}

/** The taxes and charges that can apply in a country. */
export const taxTypesFor = (country: CountryCodeMaster): TaxTypeCode[] =>
  TAX_TYPE_CODES.filter((code) => {
    const countries: readonly string[] = TAX_TYPES[code].countries;
    return countries.length === 0 || countries.includes(country);
  });
