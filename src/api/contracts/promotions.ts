import type { Price } from '@/types/menu';
import type { PromoDescriptionKey } from '@/types/promotion';
import type { OrderLineRequest } from './orders';

/* ---------- Promotions ---------- */

/*
 * `GET /branches/:id/promotions` — reference data, served like the menu
 * (public/api/branches/<id>/promotions.json): the branch's promo codes and automatic offers
 * (`BranchPromotions` in types/promotion). Offers such as happy hour apply by themselves to the
 * dishes in their scope on their days and hours (branch time); a code is applied by the guest.
 *
 * Every price the server works out applies them: offers first (on each item, at the time the
 * order or payment is priced; the item records it as `OrderItem.offer`), then the code (on the
 * item total after offers), both before the service charge and taxes when the branch's
 * `tax.discountBeforeTax` is true. An order records its code (`Order.promoCode`) and its
 * discounts (`Order.discounts`). A running dine-in order keeps its code for the whole tab: each
 * round re-prices the code's discount over every round (its minimum and cap included). Takeaway
 * and delivery orders are one round, so the code is per order.
 */

/**
 * `POST /promos/validate` — what a promo code takes off these lines for the session (its
 * branch and mode), now. 200 → the quote. Errors: 400 invalid_request, 404 session_not_found,
 * 422 promo_invalid, 422 promo_expired, 422 promo_mode_not_eligible, 422 promo_limit_reached
 * (the guest's orders with it, across the sessions of their verified number), 422 below_minimum
 * (`shortBy`: the items, before discounts, are below the code's `minOrder`). `POST /orders` and
 * `POST /payments` (purpose `order`) check a `promoCode` the same way and answer the same errors.
 */
export interface ValidatePromoRequest {
  sessionId: string;
  /** As the guest typed it; matched without regard to case or surrounding spaces. */
  code: string;
  lines: OrderLineRequest[];
}

export interface PromoQuote {
  /** The code as the branch lists it: "WELCOME10". */
  code: string;
  descriptionKey: PromoDescriptionKey;
  /** What the code takes off these lines (major units; after its cap). */
  discount: Price;
  /** What automatic offers take off the same lines now (the code comes off after them). */
  offerDiscount: Price;
}
