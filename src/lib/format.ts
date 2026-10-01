import type { Rupees } from '@/types/menu';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,424 — whole rupees with Indian digit grouping. */
export function formatINR(amount: Rupees): string {
  const sign = amount < 0 ? '−' : '';
  return `${sign}₹${inr.format(Math.abs(amount))}`;
}

/** ₹1,356.00 — from paise, always two decimals (bill lines). */
export function formatPaise(paise: number): string {
  const sign = paise < 0 ? '−' : '';
  return `${sign}₹${inrPaise.format(Math.abs(paise) / 100)}`;
}

/** +₹0.20 / −₹0.45 — signed, for the round-off line. */
export function formatSignedPaise(paise: number): string {
  const sign = paise < 0 ? '−' : '+';
  return `${sign}₹${inrPaise.format(Math.abs(paise) / 100)}`;
}

/** Add-on price label: "+₹40" or "Free". */
export function formatAddOnPrice(amount: Rupees): string {
  return amount === 0 ? 'Free' : `+${formatINR(amount)}`;
}

/** 9876543210 → "98765 43210" (partial input is formatted as typed). */
export function formatMobile(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
