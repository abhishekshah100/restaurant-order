import type { PaymentMethodId } from '@/types/branch';
import type { Price } from '@/types/menu';
import type { Order } from '@/types/order';
import type { OrderLineRequest } from './orders';

/* ---------- After placing: rounds, changes, cancellations ---------- */

/**
 * `POST /orders/:id/rounds` — send another round to the kitchen on the guest's running dine-in
 * order (their tab) without a new checkout: the session must be the one that placed it, at its
 * table, with its number verified. The round is priced from the menu and the tab re-priced as a
 * whole (taxes on every round together, rounded once). How it's paid follows GET /branches ›
 * ordering.dineInPayment: `endOfMeal` — it goes on the bill (paid later with Pay my bill or at
 * the counter; `method` is ignored); `perRound` — `method` is one of the dine-in checkout
 * methods, and an online one needs `paymentId`, a succeeded `round` payment for the round's
 * share of the tab. 201 → the order. Errors: 400 invalid_request, 402 payment_required
 * (`amountDue`), 403 phone_not_verified, 404 not_found / session_not_found, 409 mode_unavailable
 * (not a dine-in order at the session's table), 409 order_closed, 409 payment_conflict,
 * 422 empty_order.
 */
export interface AddRoundRequest {
  sessionId: string;
  lines: OrderLineRequest[];
  kitchenNote: string;
  /** `perRound` branches only: how this round is paid. */
  method?: PaymentMethodId;
  paymentId?: string;
}

/**
 * `PATCH /orders/:id` — change what's in the order: the items (and kitchen note) of its latest
 * round replace what was there, while that round is still `received` and inside the change
 * window (GET /branches › ordering.cancelWindowSeconds; the server is the authority). Re-priced
 * from the menu (a delivery fee re-quoted, a minimum order checked). If the order was paid
 * online and the total rises, `paymentId` must be a succeeded `change` payment for the
 * difference; if it falls, the difference is refunded. 200 → `OrderChangeResponse`. Errors:
 * 400, 402 payment_required (`amountDue`), 404 not_found, 409 window_closed, 409
 * payment_conflict, 422 empty_order, 422 below_minimum (`shortBy`).
 */
export interface ChangeOrderRequest {
  sessionId: string;
  /** The round being changed (the latest one still on the order): a newer round is never overwritten. */
  round: number;
  lines: OrderLineRequest[];
  kitchenNote: string;
  paymentId?: string;
}

/**
 * `POST /orders/:id/cancel` — take back the order's latest round within the change window: the
 * whole order when it's the only round (status `cancelled`, `cancelledBy: 'guest'`; anything
 * paid online is refunded), otherwise just that round (the tab is re-priced and anything paid
 * beyond the new total refunded). 200 → `OrderChangeResponse`. Errors: 400, 404 not_found,
 * 409 window_closed.
 */
export interface CancelOrderRequest {
  sessionId: string;
  /** The round being cancelled (the latest one still on the order). */
  round: number;
}

export interface OrderChangeResponse {
  order: Order;
  /** What was paid online and is now being refunded (0 when nothing). */
  refunded: Price;
}

/**
 * `GET /orders/:id` — one order with its live status, item statuses, ETA and timeline.
 * `live: true` while the kitchen is still moving it (poll every 30 s). 404 not_found.
 */
export type OrderResponse = Order;

/**
 * `GET /sessions/:id/orders` — the guest's orders at the session's branch, newest first:
 * this session's, the earlier sessions linked to the same guest (the mock: every session on
 * this device) and the guest's order history. Live statuses. 404 session_not_found.
 *
 * `GET /tables/:branchId/:table/orders` — this visit's orders at a table (today in the
 * branch's time zone, not cancelled), newest first: every guest's, for the bill.
 */
export interface OrderListResponse {
  orders: Order[];
}
