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

/**
 * Add-on price label: "+₹40", or `freeLabel` for a free add-on (the word comes from content:
 * `formatAddOnPrice(a.price, useContent('common')('price.free'))`).
 */
export function formatAddOnPrice(amount: Rupees, freeLabel: string): string {
  return amount === 0 ? freeLabel : `+${formatINR(amount)}`;
}

/** 9876543210 → "98765 43210" (partial input is formatted as typed). */
export function formatMobile(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
}

const timeFmt = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
});

/** "7:42 PM" (restaurant time, IST). */
export function formatTime(iso: string | Date): string {
  return timeFmt.format(typeof iso === 'string' ? new Date(iso) : iso);
}

/** "0:24" countdown. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
