/*
 * Master values for payments: the kinds of payment (cash, UPI, card, an online provider), every
 * method a branch can offer and how each is settled, and the statuses of an order's payment and
 * of an online payment request. Words: common › paymentMethods and common › masters.
 */

/** What the guest pays with. "Online provider" covers wallets and gateways (eSewa, Khalti…). */
export const PAYMENT_INSTRUMENTS = ['cash', 'upi', 'card', 'onlineProvider'] as const;
export type PaymentInstrument = (typeof PAYMENT_INSTRUMENTS)[number];

/**
 * How an order is settled: in the app now (`online`), or in person later — at the counter, when
 * collecting, or cash to the rider.
 */
export const PAYMENT_SETTLEMENTS = ['online', 'counter', 'pickup', 'cod'] as const;
export type PaymentSettlement = (typeof PAYMENT_SETTLEMENTS)[number];

interface PaymentMethodMaster {
  instrument: PaymentInstrument | 'any';
  settlement: PaymentSettlement;
  /** Online methods: approved in an app, or on a bank page. */
  approval?: 'app' | 'bank';
}

/**
 * Every payment method the app knows; each branch offers some of them (Settings › Payment
 * methods). `online` is a gateway page with UPI, card or netbanking; the in-person ones take
 * whatever the guest pays with.
 */
export const PAYMENT_METHOD_MASTER = {
  online: { instrument: 'onlineProvider', settlement: 'online', approval: 'app' },
  upi: { instrument: 'upi', settlement: 'online', approval: 'app' },
  card: { instrument: 'card', settlement: 'online', approval: 'bank' },
  esewa: { instrument: 'onlineProvider', settlement: 'online', approval: 'app' },
  khalti: { instrument: 'onlineProvider', settlement: 'online', approval: 'app' },
  fonepay: { instrument: 'onlineProvider', settlement: 'online', approval: 'app' },
  counter: { instrument: 'any', settlement: 'counter' },
  pickup: { instrument: 'any', settlement: 'pickup' },
  cod: { instrument: 'any', settlement: 'cod' },
} as const satisfies Record<string, PaymentMethodMaster>;
export type PaymentMethodCode = keyof typeof PAYMENT_METHOD_MASTER;
export const PAYMENT_METHOD_CODES = Object.keys(PAYMENT_METHOD_MASTER) as PaymentMethodCode[];

/**
 * Where an order's payment stands: `unpaid` (pending), `paid`, `refund-started` (refund being
 * processed) or `refunded`. Words: common › adminDashboard.paymentStatus.
 */
export const PAYMENT_STATUSES = ['unpaid', 'paid', 'refund-started', 'refunded'] as const;
export type PaymentStatusCode = (typeof PAYMENT_STATUSES)[number];

/**
 * Where one online payment request stands with the payment partner: `pending` (processing),
 * `succeeded` (paid), `failed`, or `expired` (not completed in time).
 * Words: common › masters.paymentRequestStatuses.
 */
export const PAYMENT_REQUEST_STATUSES = ['pending', 'succeeded', 'failed', 'expired'] as const;
export type PaymentRequestStatus = (typeof PAYMENT_REQUEST_STATUSES)[number];

/** What an online payment request pays for. */
export const PAYMENT_PURPOSES = ['order', 'bill', 'round', 'change'] as const;
export type PaymentPurposeCode = (typeof PAYMENT_PURPOSES)[number];
