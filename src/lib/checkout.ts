import type { MobileRules } from '@/types/branch';
import { mobileError, type PhoneError } from './phone';

/** Which rule a field broke; the words live in content (checkout › details.errors). */
export type NameError = 'nameRequired' | 'nameTooShort';

export interface DetailsErrors {
  name?: NameError;
  phone?: PhoneError;
}

/** Name is required; the mobile number must be valid for the branch (GET /branches › mobile). */
export function validateDetails(name: string, phone: string, rules: MobileRules): DetailsErrors {
  const errors: DetailsErrors = {};
  const trimmed = name.trim();
  if (!trimmed) errors.name = 'nameRequired';
  else if (trimmed.length < 2 || !/\p{L}/u.test(trimmed)) errors.name = 'nameTooShort';
  const phoneError = mobileError(phone, rules);
  if (phoneError) errors.phone = phoneError;
  return errors;
}

export const hasErrors = (e: DetailsErrors) => Boolean(e.name || e.phone);

/** Digits in a one-time code. */
export const OTP_LENGTH = 6;

/** Whether every digit of the code has been entered (the server checks the code itself). */
export const isCompleteOtp = (code: string) => code.length >= OTP_LENGTH;

/**
 * The error to show after a wrong code: 'wrong' (with attempts left to count) or 'locked'
 * once none are left. Words: checkout › verify.errors.
 */
export function wrongCodeError(attemptsLeft: number): 'wrong' | 'locked' {
  return attemptsLeft <= 0 ? 'locked' : 'wrong';
}
