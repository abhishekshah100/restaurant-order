import type { MobileRules } from '@/types/branch';

/** Which rule a mobile number broke; the words live in content (checkout › details.errors). */
export type PhoneError = 'phoneLength' | 'phonePrefix';

/** Only the digits of what was typed, capped at the national number length. */
export const mobileDigits = (typed: string, rules: MobileRules) =>
  typed.replace(/\D/g, '').slice(0, rules.length);

/** "98765 43210" (India), "984-1234567" (Nepal). Partial input is grouped as typed. */
export function formatMobile(digits: string, rules: MobileRules): string {
  const d = mobileDigits(digits, rules);
  const groups: string[] = [];
  let start = 0;
  for (const size of rules.groups) {
    if (start >= d.length) break;
    groups.push(d.slice(start, start + size));
    start += size;
  }
  if (start < d.length) groups.push(d.slice(start));
  return groups.join(rules.separator);
}

/** Longest the formatted number gets: the digits plus a separator between groups. */
export const mobileInputLength = (rules: MobileRules) => rules.length + rules.groups.length - 1;

/** Null when the digits are a valid mobile number for the branch. */
export function mobileError(digits: string, rules: MobileRules): PhoneError | null {
  if (digits.length !== rules.length) return 'phoneLength';
  return new RegExp(rules.pattern).test(digits) ? null : 'phonePrefix';
}
