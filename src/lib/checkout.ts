import { MOCK_OTP } from '@/data/restaurant';
import { formatMobile } from './format';

export interface DetailsErrors {
  name?: string;
  phone?: string;
}

/** Name is required; mobile must be a 10-digit Indian number (starts 6–9). */
export function validateDetails(name: string, phone: string): DetailsErrors {
  const errors: DetailsErrors = {};
  const trimmed = name.trim();
  if (!trimmed) errors.name = 'Please enter your name';
  else if (trimmed.length < 2 || !/\p{L}/u.test(trimmed)) errors.name = 'Enter your full name';
  if (phone.length !== 10) errors.phone = 'Enter a 10-digit mobile number';
  else if (!/^[6-9]/.test(phone)) errors.phone = 'Indian mobile numbers start with 6, 7, 8 or 9';
  return errors;
}

export const hasErrors = (e: DetailsErrors) => Boolean(e.name || e.phone);

/** "+91 98765 43210". */
export const displayPhone = (digits: string) => `+91 ${formatMobile(digits)}`;

export type OtpCheck = 'ok' | 'incomplete' | 'wrong';

export function checkOtp(code: string): OtpCheck {
  if (code.length < 6) return 'incomplete';
  return code === MOCK_OTP ? 'ok' : 'wrong';
}

export function wrongCodeMessage(attemptsLeft: number): string {
  if (attemptsLeft <= 0)
    return "That code doesn't match and there are no attempts left. Request a new code.";
  return `That code doesn't match. Check the SMS and try again — ${attemptsLeft} ${
    attemptsLeft === 1 ? 'attempt' : 'attempts'
  } left.`;
}
