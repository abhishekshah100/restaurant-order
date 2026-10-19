/*
 * Master values for places and time: the countries with a branch and the days of the week.
 * Words: common › countryNames and common › adminSettings.hours.days.
 */

/** Countries with a branch. Region copy in content is keyed by these. */
export const COUNTRY_CODES = ['IN', 'NP'] as const;
export type CountryCodeMaster = (typeof COUNTRY_CODES)[number];

/** Days of the week, Monday first (the order Settings › Opening hours lists them). */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayCode = (typeof WEEKDAYS)[number];

/** Whether a branch is taking orders. */
export const BRANCH_STATUSES = ['open', 'closed', 'paused'] as const;
export type BranchStatusCode = (typeof BRANCH_STATUSES)[number];

/**
 * Locales a branch can format numbers, money and times in. The app's words are English, so
 * these are English locales; `fallback` is used where a runtime has no number data for the
 * locale (en-NP). Words: common › masters.locales.
 */
export const LOCALES = {
  'en-IN': {},
  'en-NP': { fallback: 'en-IN' },
  'en-GB': {},
  'en-US': {},
} as const satisfies Record<string, { fallback?: string }>;
export type LocaleCode = keyof typeof LOCALES;
export const LOCALE_CODES = Object.keys(LOCALES) as LocaleCode[];

/**
 * Currencies a branch can price in: the symbol shown (instead of Intl's), minor units per
 * major unit, and the key of its spoken name (common › currencyNames).
 */
export const CURRENCIES = {
  INR: { symbol: '₹', minorUnit: 100, nameKey: 'inr' },
  NPR: { symbol: 'रू', minorUnit: 100, nameKey: 'npr' },
  USD: { symbol: '$', minorUnit: 100, nameKey: 'usd' },
  EUR: { symbol: '€', minorUnit: 100, nameKey: 'eur' },
  GBP: { symbol: '£', minorUnit: 100, nameKey: 'gbp' },
  AED: { symbol: 'AED', minorUnit: 100, nameKey: 'aed' },
} as const satisfies Record<string, { symbol: string; minorUnit: number; nameKey: string }>;
export type CurrencyCode = keyof typeof CURRENCIES;
export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

/** Each country's usual time zone, locale and currency: what a branch there starts with. */
export const COUNTRY_DEFAULTS = {
  IN: { timezone: 'Asia/Kolkata', locale: 'en-IN', currency: 'INR' },
  NP: { timezone: 'Asia/Kathmandu', locale: 'en-NP', currency: 'NPR' },
} as const satisfies Record<
  CountryCodeMaster,
  { timezone: string; locale: LocaleCode; currency: CurrencyCode }
>;

/** Whether the runtime knows this IANA time zone ("Asia/Kolkata"). */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Every IANA time zone the runtime knows, `first` ones at the top. */
export function timeZonesWith(first: readonly string[]): string[] {
  const all =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return [...new Set([...first, ...all])];
}
