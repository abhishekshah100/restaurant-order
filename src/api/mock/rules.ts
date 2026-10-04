/*
 * Business rules the backend owns. The mock server applies them; the app only sees their
 * effects in responses (a session's `expiresAt`, an OTP challenge's `resendAt`, a payment's
 * `expiresAt`…), so changing them never touches a component.
 */

/** A guest session (and the table it's at) ends after this long, so a later visit starts afresh. */
export const TABLE_SESSION_HOURS = 6;

/** OTP accepted at checkout. */
export const MOCK_OTP = '123456';

/** Wrong codes allowed before a new code must be requested. */
export const OTP_ATTEMPTS = 3;

/** Seconds before another code can be requested. */
export const OTP_RESEND_SECONDS = 30;

/** Seconds a payment request stays open with the payment partner. */
export const PAYMENT_WINDOW_SECONDS = 272; // 4:32, as drawn

/** Transaction reference the mock payment partner returns for an online payment. */
export const MOCK_TRANSACTION_REF = '•••• 4821';

/** A pending waiter or bill request lapses after this long: the staff will have seen it by then. */
export const SERVICE_REQUEST_TTL_MS = 30 * 60_000;

export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;
