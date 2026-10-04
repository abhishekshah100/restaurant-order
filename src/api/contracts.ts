import type { DeliveryQuote } from '@/lib/fulfilment';
import type { OrderMode, PaymentMethodId } from '@/types/branch';
import type { LineConfig } from '@/types/cart';
import type { Price } from '@/types/menu';
import type { DeliveryAddress, Order } from '@/types/order';
import type { BillScope, ServiceRequest, WaiterReason } from '@/types/service';
import type { GuestSession, SessionStart } from '@/types/session';

/*
 * The backend contract: every write and every server-owned read, with its request and
 * response. The app calls these through `api/endpoints` (typed functions) and the TanStack
 * hooks in `api/hooks` and `api/mutations`. Until the backend exists, `api/mock` implements
 * them in the browser and returns exactly these shapes, so switching is an env change.
 *
 * Conventions: JSON bodies; paths are relative to NEXT_PUBLIC_API_BASE_URL; times are epoch
 * milliseconds unless named `…At` on an Order (ISO); amounts are in major units of the branch
 * currency (`Price`). A failed request answers with a non-2xx status and an `ApiErrorBody`.
 */

/** Why a request failed (the `error` of an `ApiErrorBody`). */
export type ApiErrorCode =
  /** 400: the body is malformed. */
  | 'invalid_request'
  /** 404: no such order, payment, session or request. */
  | 'not_found'
  /** 404 / 410: the guest session is unknown or has expired; scan the QR code again. */
  | 'session_not_found'
  /** 409: no OTP was sent to this number in this session. */
  | 'otp_not_sent'
  /** 429: a new code can't be sent yet (`resendAt` says when). */
  | 'otp_resend_too_soon'
  /** 422: the code is wrong (`attemptsLeft` says how many tries remain). */
  | 'otp_wrong_code'
  /** 423: no attempts left; request a new code. */
  | 'otp_locked'
  /** 403: the session's mobile number hasn't been verified. */
  | 'phone_not_verified'
  /** 422: nothing orderable in the order (empty, or no dish on the menu). */
  | 'empty_order'
  /** 503: no order number is free (mock: the pre-rendered id pool is used up). */
  | 'order_ids_exhausted'
  /** 402: an online method needs a succeeded payment for this order. */
  | 'payment_required'
  /** 409: the payment isn't pending any more, was already used, or doesn't match. */
  | 'payment_conflict'
  /** 409: none of the orders can be paid (already paid, or not this session's). */
  | 'nothing_to_pay'
  /** 409: the order's mode isn't the session's, or the session can't order that way (dine-in needs a table). */
  | 'mode_unavailable'
  /** 409: waiter and bill requests are for guests at a table (dine-in). */
  | 'dine_in_only'
  /** 422: the branch doesn't deliver to this area. */
  | 'area_not_served'
  /** 422: the item total is below the mode's minimum order (`shortBy` says how far). */
  | 'below_minimum'
  /** 422: the pickup time isn't one of the slots on offer any more. */
  | 'pickup_unavailable';

/** Body of every non-2xx response. */
export interface ApiErrorBody {
  error: ApiErrorCode;
  /** otp_wrong_code / otp_locked: tries left on the current code. */
  attemptsLeft?: number;
  /** otp_resend_too_soon: epoch ms when a new code can be sent. */
  resendAt?: number;
  /** below_minimum: how much more the items must add up to (major units). */
  shortBy?: Price;
}

/* ---------- Sessions ---------- */

/**
 * `POST /sessions` — open a guest session: dine-in at a branch's table (one per QR scan and
 * device: `{ branchId, mode: 'dineIn', table, qrToken? }`), or takeaway / delivery from an outlet
 * (`{ branchId, mode, deliveryArea? }`). The server checks the signed `qrToken` (when sent),
 * opens the session and decides when it expires. 201 → the session. Errors: 400
 * invalid_request (unknown branch, table outside its range, a mode the branch doesn't offer,
 * an area it doesn't deliver to).
 */
export type CreateSessionRequest = SessionStart;
export type CreateSessionResponse = GuestSession;

/**
 * `PATCH /sessions/:id` — order another way, or to another delivery area, in the same session
 * (the cart, checkout and orders stay with it). 200 → the session. Errors: 400
 * invalid_request, 404 session_not_found, 409 mode_unavailable (dine-in without a table, or a
 * mode the branch doesn't offer), 422 area_not_served.
 */
export interface UpdateSessionRequest {
  mode?: OrderMode;
  deliveryArea?: string;
}

/* ---------- OTP ---------- */

/**
 * `POST /otp` — text a one-time code to the guest's mobile number for this session.
 * A first send (or a new number) always goes out; `resend: true` re-sends to the same number
 * and is refused until the cooldown is over, unless a wrong code was entered.
 * 200 → the challenge. Errors: 404 session_not_found, 429 otp_resend_too_soon (`resendAt`).
 */
export interface SendOtpRequest {
  sessionId: string;
  /** National digits, already valid for the branch (GET /branches › mobile). */
  phone: string;
  resend?: boolean;
}

export interface OtpChallenge {
  phone: string;
  /** When this code was sent. */
  sentAt: number;
  /** When another code can be requested (sooner after a wrong code). */
  resendAt: number;
  attemptsLeft: number;
  /** Tries each code allows. */
  maxAttempts: number;
  /** True when this number is already verified in this session (re-sending keeps it verified). */
  verified: boolean;
}

/**
 * `POST /otp/verify` — check the code. 200 → `{ verified: true }`. Errors: 409 otp_not_sent,
 * 422 otp_wrong_code (`attemptsLeft`), 423 otp_locked (`attemptsLeft: 0`).
 */
export interface VerifyOtpRequest {
  sessionId: string;
  phone: string;
  code: string;
}

export interface VerifyOtpResponse {
  verified: true;
}

/* ---------- Orders ---------- */

/** One cart line as ordered: what was chosen and how many. The server prices it from its menu. */
export type OrderLineRequest = LineConfig & { quantity: number };

/**
 * How the order reaches the guest; its mode must be the session's. Takeaway: a pickup slot
 * (ISO), or null for as soon as possible. Delivery: the address (its area picks the zone).
 */
export type FulfilmentRequest =
  | { mode: 'dineIn' }
  | { mode: 'takeaway'; pickupAt: string | null }
  | { mode: 'delivery'; address: DeliveryAddress };

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
 * 422 pickup_unavailable, 503 order_ids_exhausted.
 */
export interface PlaceOrderRequest {
  sessionId: string;
  customerName: string;
  method: PaymentMethodId;
  kitchenNote: string;
  lines: OrderLineRequest[];
  fulfilment: FulfilmentRequest;
  paymentId?: string;
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

/* ---------- Payments ---------- */

export type PaymentPurpose = 'order' | 'bill';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'expired';

/**
 * `POST /payments` — open an online payment request with the payment partner. The server
 * works out the amount itself: for an order, from the lines and fulfilment (as POST /orders
 * would price them, delivery fee included); for a bill, from the listed orders that are this
 * session's and still unpaid. 201 → the pending payment, open until `expiresAt`. Errors: 404
 * session_not_found, 409 nothing_to_pay, 409 mode_unavailable, 422 empty_order,
 * 422 below_minimum, 422 area_not_served, 422 pickup_unavailable.
 */
export type CreatePaymentRequest =
  | {
      purpose: 'order';
      sessionId: string;
      method: PaymentMethodId;
      lines: OrderLineRequest[];
      fulfilment: FulfilmentRequest;
    }
  | { purpose: 'bill'; sessionId: string; method: PaymentMethodId; orderIds: string[] };

export interface Payment {
  id: string;
  purpose: PaymentPurpose;
  sessionId: string;
  method: PaymentMethodId;
  amount: Price;
  status: PaymentStatus;
  createdAt: number;
  expiresAt: number;
  /** Bill: the orders it pays. Order: the order placed with it, once placed. */
  orderIds: string[];
  /** The partner's reference, once succeeded. */
  transactionRef?: string;
}

/**
 * `POST /payments/:id/simulate` — MOCK ONLY: stands in for the payment partner's result (the
 * prototype's "success" / "failure" links). With a real backend the partner's webhook settles
 * the payment and the app polls `GET /payments/:id` instead. A succeeded bill payment marks
 * its orders paid (only those still unpaid) and settles the session's pending "Just my
 * orders" bill request. 200 → the payment and the orders it paid. Errors: 404 not_found,
 * 409 payment_conflict (not pending, or expired).
 */
export interface SimulatePaymentRequest {
  outcome: 'succeeded' | 'failed';
}

export interface SettledPaymentResponse {
  payment: Payment;
  /** Bill payments: the orders now marked paid (empty if all were paid meanwhile). */
  orders: Order[];
}

/* ---------- Service requests ---------- */

/**
 * `POST /service-requests` — call a waiter or ask for the bill at the session's table. One of
 * each kind is pending at a time: asking again returns the pending one (`created: false`).
 * The bill's balance is worked out by the server. Requests lapse after 30 minutes.
 * 201 / 200 → the request. Errors: 404 session_not_found, 409 dine_in_only (a takeaway or
 * delivery session).
 *
 * `DELETE /service-requests/:id` — cancel it. 204. Errors: 404 not_found.
 *
 * `GET /sessions/:id/service-requests` — the session's pending requests (other guests at the
 * table don't see them).
 */
export type CreateServiceRequestRequest =
  | { sessionId: string; kind: 'waiter'; reason: WaiterReason; note?: string }
  | { sessionId: string; kind: 'bill'; scope: BillScope };

export interface CreateServiceRequestResponse {
  request: ServiceRequest;
  /** False when a request of that kind was already pending (it is returned unchanged). */
  created: boolean;
}

export interface ServiceRequestListResponse {
  requests: ServiceRequest[];
}
