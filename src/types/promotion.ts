import type cart from '../../public/api/content/cart.json';
import type { DiscountType, PROMO_CODE_DISCOUNT_TYPES, WeekdayCode } from '@/config/masters';
import type { OrderMode } from './branch';
import type { Price } from './menu';

/** A day of the week, as offers list them. */
export type Weekday = WeekdayCode;

/** Content key of a promo code's description (cart › promo.codes). */
export type PromoDescriptionKey = keyof (typeof cart)['promo']['codes'];

/**
 * Content key of an automatic offer's own wording (cart › priceSummary.offers): what its bill
 * line said before offers had names, kept for orders from then.
 */
export type OfferLabelKey = keyof (typeof cart)['priceSummary']['offers'];

/** A code the guest types (or picks) in the cart. */
export interface PromoCode {
  /** Upper case, e.g. "WELCOME10"; matched without regard to case or surrounding spaces. */
  code: string;
  /** `percent`: `value` per cent of the item total (after automatic offers); `flat`: `value` off. */
  type: (typeof PROMO_CODE_DISCOUNT_TYPES)[number];
  /** Per cent (10 = 10%), or an amount in major units. */
  value: number;
  /** The smallest item total (before discounts) it applies to; 0: none. */
  minOrder: Price;
  /** The most it takes off (percent codes), in major units. */
  maxDiscount?: Price;
  /** The order modes it can be used for. */
  modes: OrderMode[];
  /** ISO timestamps: usable from / until (inclusive). */
  validFrom?: string;
  validTo?: string;
  /** How many orders one guest (their verified mobile number) can use it on. */
  perGuestLimit?: number;
  descriptionKey: PromoDescriptionKey;
}

/**
 * A discount the guest doesn't have to ask for, e.g. happy hour: dishes in its scope cost less
 * on its days between `from` and `to` (branch time), inside its dates, for its ways of ordering.
 * Staff manage them in Settings › Offers.
 */
export interface AutoOffer {
  id: string;
  /** What guests and staff see: "Happy hour". */
  name: string;
  /** Paused (false): only staff see it; it never applies. Guests only get offers switched on. */
  active: boolean;
  days: Weekday[];
  /** 24-hour "HH:MM" in the branch's time zone; a `to` at or before `from` ends the next day. */
  from: string;
  to: string;
  /** The dishes it covers: whole categories and / or single dishes. */
  scope: { categories?: string[]; dishes?: string[] };
  /**
   * `percent`: `value` per cent off each item (rounded to a whole currency unit); `flat`:
   * `value` off each item; `priceOverride`: each item costs `value`.
   */
  type: DiscountType;
  value: number;
  /** "offer" for offers staff add; "happyHour" for the demo's. */
  labelKey: string;
  /** The ways of ordering it applies to. */
  modes: OrderMode[];
  /** Calendar days (branch time, "2026-11-01") it runs between, both included. */
  startsOn?: string;
  endsOn?: string;
}

/** GET /branches/:id/promotions. */
export interface BranchPromotions {
  codes: PromoCode[];
  offers: AutoOffer[];
}

/** An automatic offer as applied to a cart line or order item: what it took off the whole line. */
export interface AppliedOffer {
  id: string;
  labelKey: string;
  /** The offer's name when applied ("Happy hour"); orders keep it as it was. */
  name?: string;
  /** Off the line (every unit), in major units. */
  discount: Price;
}

/** A discount on a placed order, in major units (shown as a bill line). */
export type OrderDiscount =
  | { kind: 'offer'; id: string; labelKey: string; name?: string; amount: Price }
  | { kind: 'code'; code: string; amount: Price };
