import type { AdminOrders, AdminServiceRequest, CancelReason } from '@/types/admin';
import type { AtTableMethodKey } from '@/types/branch';
import type { Price } from '@/types/menu';
import type { Order, RefundReason, WaiveReason } from '@/types/order';
import type { OrderLineRequest } from './orders';

/* ---------- Staff orders: payments, refunds, rounds ---------- */

/**
 * `GET /admin/branches/:branchId/orders` — today's orders at the branch (its time zone), every
 * mode and state, in full (items, rounds, payment, timeline, pickup or delivery details), newest
 * first. With `?from=YYYY-MM-DD&to=YYYY-MM-DD` (branch calendar days, up to 365 days back and 31
 * long), that range's instead; with `&table=N`, one table's only. A range up to today also has
 * yesterday's orders still to pay; with `&due=all`, every order still to pay from the year
 * before (the Payments board: an unpaid bill stays to collect until it's taken). Authorised like GET /admin/branches. 200 →
 * `AdminOrdersResponse`. Errors: 400 invalid_request (details: field from | to | table), 401,
 * 403. Poll it like the service (every 15 s). Mock: this device's orders, the drawn history
 * and, in dev, the demo floor; today only.
 */
export type AdminOrdersResponse = AdminOrders;

/** The days (branch calendar, "2026-10-25") and table GET /admin/branches/:branchId/orders reads. */
export interface AdminOrdersFilter {
  from?: string;
  to?: string;
  table?: number;
  /** Up to today: also every older order still to pay (the Payments board). */
  due?: 'all';
}

/**
 * `POST /admin/branches/:branchId/orders/:id/payment` — staff took the payment in person, at any
 * time (before the food, during the meal or after)
 * (cash, a card machine, a QR wallet): the order is paid in full, `payment.detail` names how.
 * `method` is one of GET /branches › payments.atTable. 200 → `Order`. Errors: 400 (another
 * method), 401, 403, 404 not_found, 409 order_closed (cancelled) / nothing_to_pay (paid).
 */
/**
 * One way part of a bill was paid in person (₹1,500 cash, then ₹1,526 UPI), with any proof
 * photos of it (keys from POST …/payment-proofs; up to 5, not for cash).
 */
export interface PaymentPart {
  method: AtTableMethodKey;
  /** Major units, more than 0. */
  amount: Price;
  proofs?: string[];
}

/** Proof photos on one part of a payment, and ways a bill can be paid in at most. */
export const MAX_PROOFS = 5;

export const MAX_PARTS = 5;

/**
 * `POST /admin/branches/:branchId/payment-proofs` — a photo taken as proof of a payment in
 * person, kept privately (a data URL: JPEG, PNG or WebP, at most 1 MB; the app sends a JPEG of
 * at most 1600 px). Needs `payments.collect`. 201 → `{ key }`, sent with the payment's part.
 * `GET …/payment-proofs/:key` answers the photo itself (not JSON) to staff with
 * `payments.collect` or `reports.view`, once it's on a payment at the branch; 404 otherwise.
 * Backend only.
 */
export interface PaymentProofRequest {
  dataUrl: string;
}

export interface PaymentProofResponse {
  key: string;
}

/**
 * Taken in one way (`method`) or several (`parts`, which add up to what's taken; then no
 * `amount`): one of the two.
 */
export interface CollectPaymentRequest {
  method?: AtTableMethodKey;
  parts?: PaymentPart[];
  /** A seated booking ("R1004") whose held deposit pays part first; the rest as sent. */
  deposit?: string;
  /**
   * Part of what's due, for a split bill (major units, more than 0, at most what's due): the
   * rest stays due. Missing: everything due.
   */
  amount?: Price;
  /** A tip on top, recorded with the payment (not part of the bill). */
  tip?: Price;
  /**
   * Part of the bill left (₹1 of ₹401), with why: what's taken is then the rest of what's due
   * (`amount`, if sent, must be exactly that), and the bill is settled. 400 when it's more than
   * what's due.
   */
  waive?: Waiver;
}

/**
 * `POST /admin/branches/:branchId/orders/:id/refund` — staff give money back on an order that
 * stands (a complaint, a wrong item, overcharged, goodwill): `amount` up to what's been paid
 * and not refunded yet. It goes back the way it was paid: online payments through the payment
 * partner (status `started`, the guest gets it in a few days), in-person ones in cash at once
 * (`done`). The order stays paid; `payment.refundAmount` and a refund transaction record it.
 * 200 → `Order`. Errors: 400 (amount or reason), 401, 403, 404 not_found, 409 nothing_to_refund.
 */
/** A dish named on a refund: a line of a round (its position, from 0) and how many of it. */
export interface RefundPick {
  round: number;
  position: number;
  quantity: number;
}

export interface RefundRequest {
  amount: Price;
  reason: RefundReason;
  note?: string;
  /**
   * The dishes it's for: a line of a round (its position, from 0) and how many of it. Needed
   * for a complaint or a wrong item (400 `items` without); the amount can't be more than they
   * came to on the bill (400 `amount`).
   */
  items?: RefundPick[];
}

/**
 * `PATCH /admin/branches/:branchId/orders/:id/rounds/:round` — a waiter changes what's on one
 * round of an order (the guest asked at the table): its lines replace the round's items, the
 * tab is priced again, and anything paid beyond the new total goes back to the guest. Only
 * while the kitchen hasn't finished the round (received or preparing). To take everything off,
 * cancel the order. 200 → `OrderChangeResponse`. Errors: 400, 401, 403, 404 not_found (no such
 * order or round), 409 order_closed (cancelled) / window_closed (the round is ready or served),
 * 422 empty_order / item_unavailable.
 */
export interface EditRoundRequest {
  kitchenNote?: string;
  lines: OrderLineRequest[];
}

/**
 * `POST /admin/branches/:branchId/tables/:table/payment` — staff took the whole table's payment
 * in person: every order at the table today with something still to pay is paid in full,
 * named by `method` (one of GET /branches › payments.atTable). 200 → `TablePaymentResponse`
 * (the orders it paid). Errors: 400, 401, 403, 409 nothing_to_pay.
 */
export interface CollectTableRequest {
  /** One way, or several (`parts`, adding up to the whole bill less what's left). */
  method?: AtTableMethodKey;
  parts?: PaymentPart[];
  /** A seated booking at the table whose held deposit pays part first. */
  deposit?: string;
  /** A tip on top, recorded with the payment (not part of the bill). */
  tip?: Price;
  /** Part of the table's bill left, with why: it comes off its latest orders first. */
  waive?: Waiver;
}

/** Part of a bill staff leave when they take the rest in person, and why. */
export interface Waiver {
  /** Major units, more than 0, at most what's due. */
  amount: Price;
  reason: WaiveReason;
}

export interface TablePaymentResponse {
  orders: Order[];
}

/**
 * `POST /admin/branches/:branchId/orders/:id/cancel` — the restaurant cancels an order it can't
 * complete: every round still on it is cancelled, `cancelledBy: 'restaurant'`, `cancelReason`
 * is the reason in the guest's words (their order page shows it), and anything already paid
 * starts a refund. Not after it's served, picked up or delivered. 200 → `Order`. Errors: 400
 * (unknown reason), 401, 403, 404 not_found, 409 order_closed (finished or already cancelled).
 */
export interface CancelByStaffRequest {
  reason: CancelReason;
}

/**
 * `POST /admin/branches/:branchId/orders/:id/rounds` — a waiter adds items to an open dine-in
 * order at the table: a new round, priced like the guest's own, on the same bill (what's been
 * paid stays paid). Authorised like GET /admin/branches. 201 → `Order`. Errors: 400, 401, 403,
 * 404 not_found (no such order at the branch), 409 mode_unavailable (not dine-in) /
 * order_closed (cancelled), 422 empty_order / item_unavailable.
 */
export interface StaffRoundRequest {
  kitchenNote?: string;
  lines: OrderLineRequest[];
}

/**
 * `POST /admin/service-requests/:id/resolve` — a waiter dealt with the request: it leaves the
 * queue and the guest's pending requests (their "Waiter requested" / "Bill requested" page
 * clears) and is listed in the service's `doneRequests` for 30 minutes. Idempotent: resolving it
 * again answers the same. No body. 200 → `{ request }` with `resolvedAt` and `resolvedBy` (the
 * staff member's name). Errors: 401 unauthorized, 403 forbidden (another branch's), 404 not_found
 * (unknown, or lapsed after 30 minutes).
 */
/**
 * `POST /admin/service-requests/:id/acknowledge` — "On my way": a member of staff is heading to
 * the table. The request stays open (in the queue and the guest's pending requests) with
 * `acknowledgedAt` and `acknowledgedBy` (their name), and the guest's page says who's coming.
 * Whoever said it first stays. No body. 200 → `{ request }`. Errors: 401, 403 forbidden
 * (another branch's), 404 not_found (unknown or lapsed), 409 request_closed (already done).
 */
export type AcknowledgeRequestResponse = ResolveRequestResponse;

export interface ResolveRequestResponse {
  request: AdminServiceRequest;
}

/**
 * `POST /admin/orders/:id/served` — the food is at the table (dine-in), or handed over at the
 * counter (takeaway). `round` names one round of a running order; without it every round ready
 * now is marked. The guest's tracking moves to Served (Picked up). Idempotent: an order or
 * round already served answers the same. 200 → the order (`Order`, as GET /orders/:id).
 * Errors: 400 invalid_request (no such round), 401 unauthorized, 403 forbidden (another
 * branch's), 404 not_found, 409 not_ready (still being made, or a delivery), 409 order_closed
 * (cancelled).
 */
export interface MarkServedRequest {
  round?: number;
}

export type MarkServedResponse = Order;

/**
 * `POST /admin/branches/:branchId/orders/:id/rounds/:round/items/:position/unavailable` — the
 * kitchen can't make `quantity` more of an item (sold out). They come off the bill (taxes and
 * offers worked out again; anything paid beyond it refunded the way it came); a round left with
 * nothing is cancelled, an order left with nothing cancelled as out of stock. The waiters get a
 * kitchen message (`note`, worded by the kitchen app). Needs `kitchen.update`. 200 →
 * `OrderChangeResponse`. Errors: 400 (more than is left), 404, 409 order_closed (cancelled,
 * handed over, or the item already plated).
 */
/**
 * `POST /admin/branches/:branchId/orders/:id/rounds/:round/cancel` — a waiter takes back one
 * round the kitchen hasn't started and that isn't paid (the order still owes money; the round
 * wasn't paid online as it was sent). The rest of the tab is priced again, anything paid beyond
 * it refunded; the order's only round cancels the order (for `reason`, else "other"). Needs
 * `orders.take`. 200 → `OrderChangeResponse`. Errors: 404, 409 window_closed (started or
 * paid), 409 order_closed (cancelled).
 */
export interface CancelRoundRequest {
  reason?: CancelReason;
}

export interface ItemUnavailableRequest {
  quantity: number;
  note?: string;
}

/**
 * `POST /admin/branches/:branchId/orders/:id/unavailable` — the kitchen can't make the order at
 * all: cancelled as out of stock, anything paid refunded, the waiters told. Needs
 * `kitchen.update`. 200 → `OrderChangeResponse`. Errors: 404, 409 order_closed.
 */
export interface OrderUnavailableRequest {
  note?: string;
}

/**
 * `PATCH /admin/branches/:branchId/orders/:id/rush` — a waiter marks the order rush (first in the
 * kitchen's lanes) or not. Needs `orders.take`. 200 → the order (`rush: true` while it is). Errors:
 * 404 not_found, 409 order_closed (cancelled).
 */
export interface SetRushRequest {
  rush: boolean;
}
