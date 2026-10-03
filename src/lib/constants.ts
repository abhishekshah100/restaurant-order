/** Highest quantity a single cart line or stepper allows. */
export const MAX_QUANTITY = 20;

/** Debounce for search-as-you-type. */
export const SEARCH_DEBOUNCE_MS = 250;

/** How long toasts stay up. */
export const TOAST_MS = 5000;

/** Longest free-text note on a single dish. */
export const ITEM_NOTE_MAX = 140;

/** Longest kitchen note for the whole order. */
export const KITCHEN_NOTE_MAX = 120;

/** Highest table number a QR link can carry (three digits). */
export const MAX_TABLE = 999;

/** A guest session (and the table it's at) ends after this long, so a later visit starts afresh. */
export const TABLE_SESSION_HOURS = 6;

/*
 * Mock checkout rules. There's no backend yet, so the browser checks the OTP and times the
 * payment request itself. With a real backend these move server-side: the server verifies
 * the code, counts attempts, rate-limits resends and owns the payment window.
 */

/** OTP accepted at checkout. */
export const MOCK_OTP = '123456';

/** Wrong codes allowed before a new code must be requested. */
export const OTP_ATTEMPTS = 3;

/** Seconds before another code can be requested. */
export const OTP_RESEND_SECONDS = 30;

/** Seconds the mock UPI request stays open on the processing screen. */
export const PAYMENT_WINDOW_SECONDS = 272; // 4:32, as drawn

/** Transaction reference the mock payment partner returns for an online payment. */
export const MOCK_TRANSACTION_REF = '•••• 4821';
