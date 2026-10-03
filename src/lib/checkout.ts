import { MOCK_OTP, OTP_ATTEMPTS, OTP_RESEND_SECONDS } from './constants';
import { formatMobile } from './format';

/** Which rule a field broke; the words live in content (checkout › details.errors). */
export type NameError = 'nameRequired' | 'nameTooShort';
export type PhoneError = 'phoneLength' | 'phonePrefix';

export interface DetailsErrors {
  name?: NameError;
  phone?: PhoneError;
}

/** Name is required; mobile must be a 10-digit Indian number (starts 6–9). */
export function validateDetails(name: string, phone: string): DetailsErrors {
  const errors: DetailsErrors = {};
  const trimmed = name.trim();
  if (!trimmed) errors.name = 'nameRequired';
  else if (trimmed.length < 2 || !/\p{L}/u.test(trimmed)) errors.name = 'nameTooShort';
  if (phone.length !== 10) errors.phone = 'phoneLength';
  else if (!/^[6-9]/.test(phone)) errors.phone = 'phonePrefix';
  return errors;
}

export const hasErrors = (e: DetailsErrors) => Boolean(e.name || e.phone);

/** "98765 43210" (country code hidden for now). */
export const displayPhone = (digits: string) => formatMobile(digits);

type OtpCheck = 'ok' | 'incomplete' | 'wrong';

export function checkOtp(code: string): OtpCheck {
  if (code.length < 6) return 'incomplete';
  return code === MOCK_OTP ? 'ok' : 'wrong';
}

/**
 * The error to show after a wrong code: 'wrong' (with attempts left to count) or 'locked'
 * once none are left. Words: checkout › verify.errors.
 */
export function wrongCodeError(attemptsLeft: number): 'wrong' | 'locked' {
  return attemptsLeft <= 0 ? 'locked' : 'wrong';
}

/**
 * A new code can be requested once OTP_RESEND_SECONDS have passed since the last
 * one, or straight away after a wrong code.
 */
export function canResendOtp(
  session: { otpSentAt: number | null; attemptsLeft: number },
  now: number,
): boolean {
  return (
    session.otpSentAt === null ||
    session.attemptsLeft < OTP_ATTEMPTS ||
    now - session.otpSentAt >= OTP_RESEND_SECONDS * 1000
  );
}
