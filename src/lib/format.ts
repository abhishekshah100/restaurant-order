/*
 * Formatting that doesn't depend on the branch. Money, times and phone numbers do:
 * see lib/money, lib/clock and lib/phone (components get them from useRegion()).
 */

/** "0:24" countdown. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
