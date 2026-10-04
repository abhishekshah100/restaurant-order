import { mobileError } from '@/lib/phone';
import type { OtpChallenge, VerifyOtpResponse } from '../../contracts';
import { fail, liveSession, objectBody, ok, stringField, type Handler } from '../context';
import type { OtpRecord } from '../db';
import { MOCK_OTP, OTP_ATTEMPTS, OTP_RESEND_SECONDS } from '../rules';

/**
 * A new code can be requested once OTP_RESEND_SECONDS have passed since the last one, or
 * straight away after a wrong code.
 */
export function canResendOtp(record: Pick<OtpRecord, 'sentAt' | 'attemptsLeft'>, now: number) {
  return record.attemptsLeft < OTP_ATTEMPTS || now - record.sentAt >= OTP_RESEND_SECONDS * 1000;
}

/** When the next code can be requested. */
const resendAt = (record: OtpRecord) =>
  record.attemptsLeft < OTP_ATTEMPTS ? record.sentAt : record.sentAt + OTP_RESEND_SECONDS * 1000;

const challenge = (record: OtpRecord): OtpChallenge => ({
  phone: record.phone,
  sentAt: record.sentAt,
  resendAt: resendAt(record),
  attemptsLeft: record.attemptsLeft,
  maxAttempts: OTP_ATTEMPTS,
  verified: record.verified,
});

/** POST /otp */
export const sendOtp: Handler = async (ctx, { body: raw }) => {
  const body = objectBody(raw);
  const phone = stringField(body, 'phone');
  const { session, branch } = await liveSession(ctx, stringField(body, 'sessionId'));
  if (
    mobileError(phone, branch.mobile) ||
    (body.resend !== undefined && typeof body.resend !== 'boolean')
  ) {
    fail(400, 'invalid_request');
  }
  const now = ctx.now();
  const table = ctx.db.otp.read();
  const previous = table[session.id];
  let record: OtpRecord;
  if (body.resend) {
    if (previous?.phone !== phone) fail(409, 'otp_not_sent');
    if (!canResendOtp(previous, now))
      fail(429, 'otp_resend_too_soon', { resendAt: resendAt(previous) });
    record = { ...previous, sentAt: now, attemptsLeft: OTP_ATTEMPTS };
  } else {
    // A number already verified in this session stays verified when it's sent again.
    const verified = previous?.phone === phone && previous.verified;
    record = { phone, sentAt: now, attemptsLeft: OTP_ATTEMPTS, verified };
  }
  ctx.db.otp.write({ ...table, [session.id]: record });
  return ok(challenge(record));
};

/** POST /otp/verify */
export const verifyOtp: Handler = async (ctx, { body: raw }) => {
  const body = objectBody(raw);
  const phone = stringField(body, 'phone');
  const code = stringField(body, 'code');
  const { session } = await liveSession(ctx, stringField(body, 'sessionId'));
  if (!/^\d{6}$/.test(code)) fail(400, 'invalid_request');
  const table = ctx.db.otp.read();
  const record = table[session.id];
  if (record?.phone !== phone) fail(409, 'otp_not_sent');
  if (record.attemptsLeft <= 0) fail(423, 'otp_locked', { attemptsLeft: 0 });
  if (code !== MOCK_OTP) {
    const wrong = { ...record, attemptsLeft: record.attemptsLeft - 1 };
    ctx.db.otp.write({ ...table, [session.id]: wrong });
    fail(422, 'otp_wrong_code', { attemptsLeft: wrong.attemptsLeft, resendAt: resendAt(wrong) });
  }
  ctx.db.otp.write({ ...table, [session.id]: { ...record, verified: true } });
  const response: VerifyOtpResponse = { verified: true };
  return ok(response);
};
