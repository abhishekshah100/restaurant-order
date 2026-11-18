import type { DeliveryQuote } from '@/lib/fulfilment';
import type { PaymentMethodId } from '@/types/branch';
import type { Price } from '@/types/menu';
import type { FulfilmentRequest, OrderLineRequest } from './orders';

/* ---------- Delivery ---------- */

/**
 * `POST /delivery/quote` — what delivering an item total to an area costs: its zone, the fee
 * (0 once the total reaches the zone's free-delivery threshold), the minimum order and how far
 * the total is from it, and the ETA. 200 → the quote. Errors: 400 invalid_request (unknown
 * branch, or it doesn't deliver), 422 area_not_served.
 */
export interface DeliveryQuoteRequest {
  branchId: string;
  area: string;
  itemTotal: Price;
}

export type DeliveryQuoteResponse = DeliveryQuote;

/**
 * `POST /orders` — place an order. The branch, mode and table come from the session (never
 * the body), prices from the branch menu and its tax rules, plus the delivery fee of the
 * address's zone. The method must be one the mode offers. An online method needs
 * `paymentId`, a succeeded payment for exactly this order (`POST /payments` with purpose
 * "order"); an in-person one (counter, pickup, cash on delivery) is left unpaid. 201 → the
 * order. Errors: 403 phone_not_verified, 402 payment_required, 409 payment_conflict,
 * 409 mode_unavailable, 422 empty_order, 422 below_minimum (`shortBy`), 422 area_not_served,
 * 422 pickup_unavailable, and a `promoCode`'s errors (see POST /promos/validate). The order
 * number is a new unique id (mock: numbered per device). Discounts (automatic offers, the code) are priced as at the payment's
 * `createdAt` for an online method, so the amount paid still matches.
 */
export interface PlaceOrderRequest {
  sessionId: string;
  customerName: string;
  method: PaymentMethodId;
  kitchenNote: string;
  lines: OrderLineRequest[];
  fulfilment: FulfilmentRequest;
  paymentId?: string;
  /** A promo code the guest applied in the cart (`POST /promos/validate` accepted it). */
  promoCode?: string;
  /**
   * The client's key for this checkout: the same key again (a retried request) returns the order
   * already placed instead of placing another. One per press of "Place order".
   */
  idempotencyKey?: string;
}
