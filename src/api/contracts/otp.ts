/* ---------- OTP ---------- */

/**
 * `POST /otp` — text a one-time code to the guest's mobile number for this session.
 * A first send (or a new number) always goes out; `resend: true` re-sends to the same number
 * and is refused until the cooldown is over, unless a wrong code was entered (with no code on
 * record, it's a first send). 200 → the challenge. Errors: 404 session_not_found, 409
 * otp_not_sent (`resend` to another number), 429 otp_resend_too_soon (`resendAt`).
 */
export interface SendOtpRequest {
  sessionId: string;
  /** National digits, already valid for the branch (GET /branches › mobile). */
  phone: string;
  resend?: boolean;
}

export interface OtpChallenge {
  phone: string;
  /** When this code was sent. */
  sentAt: number;
  /** When another code can be requested (sooner after a wrong code). */
  resendAt: number;
  attemptsLeft: number;
  /** Tries each code allows. */
  maxAttempts: number;
  /** True when this number is already verified in this session (re-sending keeps it verified). */
  verified: boolean;
}

/**
 * `POST /otp/verify` — check the code. 200 → `{ verified: true }`. Errors: 409 otp_not_sent,
 * 422 otp_wrong_code (`attemptsLeft`), 423 otp_locked (`attemptsLeft: 0`).
 */
export interface VerifyOtpRequest {
  sessionId: string;
  phone: string;
  code: string;
}

export interface VerifyOtpResponse {
  verified: true;
}
