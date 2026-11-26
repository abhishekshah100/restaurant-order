import type { Reservation } from '@/types/admin';
import type { Price } from '@/types/menu';
import type { SetupIssue } from './dev-setup';

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
  /** 409: the request conflicts with the current state (`reason` says how). */
  | 'conflict'
  /** 409: another waiter covers the table (table sections: taking one for oneself). */
  | 'table_taken'
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
  /** 422: a dish (or its size) in the order is sold out or off today; `items` names them. */
  | 'item_unavailable'
  /** 402: an online method needs a succeeded payment for this order. */
  | 'payment_required'
  /** 409: the payment isn't pending any more, was already used, or doesn't match. */
  | 'payment_conflict'
  /** 409: nothing paid on the order is left to refund. */
  | 'nothing_to_refund'
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
  | 'pickup_unavailable'
  /**
   * 409: too late to change or cancel the order (round): the kitchen has started on it, the
   * window (GET /branches › ordering.cancelWindowSeconds) has passed, or it isn't the latest round.
   */
  | 'window_closed'
  /** 409: the order was cancelled, so nothing more can go on it. */
  | 'order_closed'
  /** 409: the waiter call or bill request was already dealt with. */
  | 'request_closed'
  /** 409: the branch is paused or closed, so guests can't order on their phones now. */
  | 'ordering_unavailable'
  /** 422: no such promo code at the branch (or it can't be used yet). */
  | 'promo_invalid'
  /** 422: the promo code's `validTo` has passed. */
  | 'promo_expired'
  /** 422: the promo code isn't for the session's order mode. */
  | 'promo_mode_not_eligible'
  /** 422: the guest has used the promo code as often as it allows (`perGuestLimit`). */
  | 'promo_limit_reached'
  /** 401: no admin account matches this email or mobile number and password. */
  | 'invalid_credentials'
  /** 429: too many requests from this device (sign-in: too many wrong passwords); try later. */
  | 'rate_limited'
  /** 401: an admin request without a session token, or its session has expired; sign in again. */
  | 'unauthorized'
  /** 403: the signed-in admin doesn't manage this branch (or the order or request's branch). */
  | 'forbidden'
  /** 409: the order (or round) isn't ready to serve yet. */
  | 'not_ready'
  /** 409: another booking holds the table then (`reservation` says which). */
  | 'table_taken'
  /** 422: an offer names categories or dishes the branch's menu lacks (`unknown`). */
  | 'offer_scope_unknown'
  /** 409: the booking can't change that way any more (seated, cancelled, or not due yet). */
  | 'reservation_closed'
  /** 409: a table the new floor plan leaves out has an open bill, food on the way or a booking. */
  | 'table_in_use'
  /** 409: the table still owes money (`due`): collect it before freeing the table. */
  | 'bill_open'
  /** 409: no cash register is open at the branch: open it before taking or giving cash. */
  | 'register_closed'
  /** 409: the branch's cash register is already open (one drawer per branch). */
  | 'register_open'
  /**
   * 409: the count at close differs from what's expected (`expected`, `difference` for the cash,
   * `methods` for card and UPI): say why.
   */
  | 'count_differs'
  /** 409: a register session that day is still open: close it before signing the day off. */
  | 'day_open'
  /** 409: the day was already signed off. */
  | 'day_signed_off'
  /** The order's tax invoice is issued: its buyer can't change. */
  | 'invoice_issued'
  /** 409: the table to move to has guests (`status`): free or settle it first. */
  | 'table_occupied'
  /** 409: nobody is at the table to move. */
  | 'nothing_to_move'
  /** 409: the bill is paid in full: money back is a refund, not a discount. */
  | 'bill_paid'
  /** 403: more off than the giver's discount limit (`limit`, a percentage). */
  | 'discount_limit'
  /** 409: the booking already has a deposit (one at most). */
  | 'deposit_exists'
  /** 409: another ingredient or category has that name (`field`). */
  | 'name_taken'
  /** 409: opening stock was already entered for these (`ingredients`): adjust instead. */
  | 'opening_done'
  /** 409: the branch doesn't track these (`ingredients`). */
  | 'not_tracked'
  /** 409: a branch still holds some (`branches`), or its measure can't change now (`field`). */
  | 'ingredient_in_use'
  /** 409: the purchase order can't change that way now (`status`). */
  | 'po_not_editable'
  /** 409: the purchase order needs approval before it's sent. */
  | 'po_not_approved'
  /** 409: nothing more can be received on the order (`status`). */
  | 'po_closed'
  /** 409: more would go back than came in (`lines`: what each can take). */
  | 'return_exceeds'
  /** 409: the supplier has open purchase orders (`orders`: their numbers). */
  | 'supplier_in_use'
  /** 409: nothing the supplier sells is low. */
  /** 403: the restaurant doesn't have this feature (`feature`): the platform switches it on. */
  | 'feature_disabled'
  /**
   * 403: the client's package allows no more of these (`limit`: staff, branches, floors,
   * tables, dishes or reportDays; `max`; `used`).
   */
  | 'plan_limit'
  /** 403: the client's plan ended (past grace) or is suspended (`status`). */
  | 'plan_locked'
  /** 409: some items are in another open count (`count`: its number). */
  | 'count_open'
  /** 409: the count can't change that way now (`status`). */
  | 'count_closed'
  /** 409: big differences need a note before applying (`ingredients`). */
  | 'count_needs_notes'
  /** 409: the transfer can't change that way now (`status`). */
  | 'transfer_closed'
  /** 400: these items track expiry and have no shelf life: give the date (`ingredients`). */
  | 'expiry_required'
  | 'role_system'
  | 'role_in_use'
  | 'staff_exists'
  | 'shift_type_exists'
  | 'colleague_busy'
  | 'swap_open'
  /** 409: those times overlap another shift of the person's. */
  | 'shift_overlap'
  /** 409: leave is already asked for or given on some of those days. */
  | 'time_off_overlap'
  | 'own_account'
  | 'last_admin'
  | 'wrong_password'
  | 'password_change_required'
  /** 403: a table scan's QR token is missing, forged or for another table: scan the code again. */
  | 'qr_invalid'
  /** 409: the table is out of service (Settings › Floor plan): nobody can order at it or book it. */
  | 'table_disabled'
  /** 409: the admin's only branch can't be removed: there must always be at least one. */
  | 'last_branch'
  /** 409: the branch has orders today that aren't finished or paid, so it can't be removed yet. */
  | 'branch_in_use';

/** Body of every non-2xx response. */
export interface ApiErrorBody {
  error: ApiErrorCode;
  /** conflict: why (`restaurant_exists`: the developer setup made it before). */
  reason?: string;
  /** invalid_request from the developer setup: where its JSON is wrong. */
  issues?: SetupIssue[];
  /** invalid_request from the developer setup: what will look odd. */
  warnings?: string[];
  /** otp_wrong_code / otp_locked: tries left on the current code. */
  attemptsLeft?: number;
  /** otp_resend_too_soon: epoch ms when a new code can be sent. */
  resendAt?: number;
  /** below_minimum (an order's mode, or a promo code's minimum): how much more the items must add up to (major units). */
  shortBy?: Price;
  /** payment_required on a change or round: the amount a payment must cover (major units). */
  amountDue?: Price;
  /** item_unavailable: the dishes that can't be ordered now, by name. */
  items?: string[];
  /** table_taken: the booking holding the table then. */
  reservation?: Pick<Reservation, 'id' | 'guestName' | 'at'>;
  /** table_taken: which of the booking's tables it holds. */
  table?: number;
  /** staff_exists, and a 400's: the field at fault. */
  field?: string;
  /** role_in_use: how many staff hold the role. */
  staff?: number;
  /** table_in_use: the tables that can't go yet, and why. */
  tables?: TableInUse[];
  /** bill_open: what the table still owes. */
  due?: Price;
  /** count_differs: what the drawer should hold, and counted - expected (negative: short). */
  expected?: Price;
  difference?: Price;
  /** count_differs: the card and UPI totals checked, against what was taken that way. */
  methods?: { method: string; expected: Price; difference: Price }[];
  /** opening_done, not_tracked: the ingredients, by name. */
  ingredients?: string[];
  /** ingredient_in_use: the branches still holding some. */
  branches?: string[];
  /** po_not_editable, po_closed: where the order stands. */
  status?: string;
  /** supplier_in_use: its open orders' numbers. */
  orders?: number[];
  /** count_open: the open count's number. */
  count?: number;
  /** return_exceeds: how much each line can still take back. */
  lines?: { receiptLineId: string; available: number }[];
  /** plan_limit: which of the package's limits, what it allows, and how many there are now. */
  limit?: 'staff' | 'branches' | 'floors' | 'tables' | 'dishes' | 'reportDays';
  max?: number;
  used?: number;
}

/** A table the floor plan can't leave out yet: its open orders or bill, or its bookings to come. */
export interface TableInUse {
  number: number;
  reason: 'openOrder' | 'booking';
  /** What the plan would do to it: leave it out, or take it out of service. */
  change: 'removed' | 'disabled';
}
