import { AUTO_OFFER_DISCOUNT_TYPES, DISCOUNT_TYPES, ELIGIBILITY_RULES } from './discounts';
import { NOTIFICATION_TYPE_CODES } from './notifications';
import {
  CANCELLATION_REASONS,
  ITEM_STATUSES,
  ORDER_STATUSES,
  ORDER_TYPES,
  REFUND_REASONS,
  REJECTION_REASONS,
  SERVICE_TYPES,
} from './orders';
import {
  PAYMENT_INSTRUMENTS,
  PAYMENT_METHOD_CODES,
  PAYMENT_REQUEST_STATUSES,
  PAYMENT_STATUSES,
} from './payments';
import { BRANCH_STATUSES, COUNTRY_CODES, CURRENCY_CODES, LOCALE_CODES, WEEKDAYS } from './regions';
import { BILL_SCOPES, CUSTOMER_REQUEST_TYPES, RESERVATION_STATUSES } from './service';
import { TAX_BASES, TAX_TYPE_CODES } from './tax';
import { UNIT_CODES } from './units';

/*
 * The app's master values, in one place: every fixed list a screen, the mock server or a
 * backend checks against (order types and statuses, payment methods and statuses, taxes,
 * reasons, units, notification types…). Types across the app are derived from these lists, so
 * a value is added here once. Codes only: the words for each are in the content JSON (each
 * file names where). Import from '@/config/masters'.
 *
 * A backend can later serve the same lists (e.g. GET /masters → `MASTERS`) and the app read
 * them from there; the codes stay as they are.
 */

export * from './discounts';
export * from './notifications';
export * from './orders';
export * from './payments';
export * from './regions';
export * from './service';
export * from './tax';
export * from './units';

/** Every master list by name: what a GET /masters endpoint would answer. */
export const MASTERS = {
  orderTypes: ORDER_TYPES,
  serviceTypes: SERVICE_TYPES,
  orderStatuses: ORDER_STATUSES,
  itemStatuses: ITEM_STATUSES,
  paymentInstruments: PAYMENT_INSTRUMENTS,
  paymentMethods: PAYMENT_METHOD_CODES,
  paymentStatuses: PAYMENT_STATUSES,
  paymentRequestStatuses: PAYMENT_REQUEST_STATUSES,
  taxTypes: TAX_TYPE_CODES,
  taxBases: TAX_BASES,
  cancellationReasons: CANCELLATION_REASONS,
  rejectionReasons: REJECTION_REASONS,
  refundReasons: REFUND_REASONS,
  units: UNIT_CODES,
  reservationStatuses: RESERVATION_STATUSES,
  discountTypes: DISCOUNT_TYPES,
  autoOfferDiscountTypes: AUTO_OFFER_DISCOUNT_TYPES,
  eligibilityRules: ELIGIBILITY_RULES,
  customerRequestTypes: CUSTOMER_REQUEST_TYPES.map((t) => t.id),
  billScopes: BILL_SCOPES,
  notificationTypes: NOTIFICATION_TYPE_CODES,
  branchStatuses: BRANCH_STATUSES,
  countries: COUNTRY_CODES,
  locales: LOCALE_CODES,
  currencies: CURRENCY_CODES,
  weekdays: WEEKDAYS,
} as const;

export type MasterName = keyof typeof MASTERS;

/** Whether `value` is one of a master list's codes (for checking what an API or form sent). */
export function isMasterValue<N extends MasterName>(
  name: N,
  value: unknown,
): value is (typeof MASTERS)[N][number] {
  return (MASTERS[name] as readonly unknown[]).includes(value);
}
