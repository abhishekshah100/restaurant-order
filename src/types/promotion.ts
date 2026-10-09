import type cart from '../../public/api/content/cart.json';
import type menu from '../../public/api/content/menu.json';
import type { OrderMode } from './branch';
import type { Price } from './menu';

/** A day of the week, as offers list them. */
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** Content key of a promo code's description (cart › promo.codes). */
export type PromoDescriptionKey = keyof (typeof cart)['promo']['codes'];

/**
 * Content key of an automatic offer: its bill line (cart › priceSummary.offers) and its menu
 * badge and banner (menu › offers).
 */
export type OfferLabelKey = keyof (typeof cart)['priceSummary']['offers'] &
  keyof (typeof menu)['offers'];

/** A code the guest types (or picks) in the cart. */
export interface PromoCode {
  /** Upper case, e.g. "WELCOME10"; matched without regard to case or surrounding spaces. */
  code: string;
  /** `percent`: `value` per cent of the item total (after automatic offers); `flat`: `value` off. */
  type: 'percent' | 'flat';
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
 * on its days between `from` and `to` (branch time).
 */
export interface AutoOffer {
  id: string;
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
  type: 'percent' | 'flat' | 'priceOverride';
  value: number;
  labelKey: OfferLabelKey;
}

/** GET /branches/:id/promotions. */
export interface BranchPromotions {
  codes: PromoCode[];
  offers: AutoOffer[];
}

/** An automatic offer as applied to a cart line or order item: what it took off the whole line. */
export interface AppliedOffer {
  id: string;
  labelKey: OfferLabelKey;
  /** Off the line (every unit), in major units. */
  discount: Price;
}

/** A discount on a placed order, in major units (shown as a bill line). */
export type OrderDiscount =
  | { kind: 'offer'; id: string; labelKey: OfferLabelKey; amount: Price }
  | { kind: 'code'; code: string; amount: Price };
