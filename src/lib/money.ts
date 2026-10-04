import type { Branch } from '@/types/branch';
import type { Price } from '@/types/menu';

/** What money formatting needs from a branch. */
export type MoneyRegion = Pick<Branch, 'locale' | 'localeFallback' | 'currency'>;

/** Formats amounts in one branch's currency. Build one with createMoney (or useRegion().money). */
export interface Money {
  /** Minor units per major unit (100 paise to the rupee). */
  readonly minorUnit: number;
  /** "₹1,424", "रू 2,280": a price or total in major units, without decimals. */
  format(amount: Price): string;
  /** "₹33.90": from minor units, always with the currency's decimals (bill lines). */
  formatMinor(minor: number): string;
  /** "+₹0.20" / "−₹0.45": signed, for the round-off line. */
  formatSignedMinor(minor: number): string;
  /** "+₹40", or `freeLabel` (content: common › price.free) for a free add-on. */
  addOnPrice(amount: Price, freeLabel: string): string;
  /** A major-unit amount in minor units: 549 → 54900. */
  toMinor(amount: Price): number;
}

/** A real minus sign, as drawn ("−₹0.45"). */
const MINUS = '−';

/**
 * The locale numbers are formatted in. A runtime without data for the branch locale resolves
 * it to a parent ("en-NP" → "en", western digit grouping); `localeFallback` is used then.
 */
export function numberLocale({ locale, localeFallback }: MoneyRegion): string {
  if (!localeFallback) return locale;
  return new Intl.NumberFormat(locale).resolvedOptions().locale === locale
    ? locale
    : localeFallback;
}

/** Intl's currency formatting with the branch's own symbol in place of Intl's ("NPR" → "रू"). */
function currencyFormatter(region: MoneyRegion, fractionDigits: number) {
  const intl = new Intl.NumberFormat(numberLocale(region), {
    style: 'currency',
    currency: region.currency.code,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return (amount: number) =>
    intl
      .formatToParts(Math.abs(amount))
      .map((part) => (part.type === 'currency' ? region.currency.symbol : part.value))
      .join('');
}

const cache = new WeakMap<MoneyRegion, Money>();

/** The formatter for a branch. Built once per branch object. */
export function createMoney(region: MoneyRegion): Money {
  const cached = cache.get(region);
  if (cached) return cached;
  const { minorUnit } = region.currency;
  const whole = currencyFormatter(region, 0);
  const decimals = currencyFormatter(region, Math.round(Math.log10(minorUnit)));
  const sign = (n: number) => (n < 0 ? MINUS : '');

  const money: Money = {
    minorUnit,
    format: (amount) => `${sign(amount)}${whole(amount)}`,
    formatMinor: (minor) => `${sign(minor)}${decimals(minor / minorUnit)}`,
    formatSignedMinor: (minor) => `${minor < 0 ? MINUS : '+'}${decimals(minor / minorUnit)}`,
    addOnPrice: (amount, freeLabel) => (amount === 0 ? freeLabel : `+${whole(amount)}`),
    toMinor: (amount) => Math.round(amount * minorUnit),
  };
  cache.set(region, money);
  return money;
}
