/*
 * Master values for discounts and offers: how much comes off, and who and what an offer is
 * for. Promo codes and automatic offers (GET /branches/:id/promotions) are built from these.
 * Words: common › masters.discountTypes and common › masters.eligibility.
 */

/**
 * How a discount is worked out: a percentage off, a fixed amount off, or (automatic offers) a
 * set price per item.
 */
export const DISCOUNT_TYPES = ['percent', 'flat', 'priceOverride'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

/** Promo codes take a percentage or a fixed amount; automatic offers can also set the price. */
export const PROMO_CODE_DISCOUNT_TYPES = [
  'percent',
  'flat',
] as const satisfies readonly DiscountType[];
export const AUTO_OFFER_DISCOUNT_TYPES = DISCOUNT_TYPES;

/** What can decide whether an order gets a discount. */
export const ELIGIBILITY_RULES = [
  /** The item total must reach an amount. */
  'minOrder',
  /** The discount is capped at an amount (percentage codes). */
  'maxDiscount',
  /** Only for some order types. */
  'orderTypes',
  /** Only on some days of the week, between two times. */
  'schedule',
  /** Only between two dates. */
  'validity',
  /** Each guest (verified mobile) can use it this many times. */
  'perGuestLimit',
  /** Only some categories or dishes. */
  'scope',
] as const;
export type EligibilityRule = (typeof ELIGIBILITY_RULES)[number];

/** The rules each kind of discount can use. */
export const ELIGIBILITY_BY_KIND = {
  promoCode: ['minOrder', 'maxDiscount', 'orderTypes', 'validity', 'perGuestLimit'],
  autoOffer: ['schedule', 'scope'],
} as const satisfies Record<'promoCode' | 'autoOffer', readonly EligibilityRule[]>;
