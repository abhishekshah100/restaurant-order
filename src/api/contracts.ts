import type { PaymentPurposeCode, PaymentRequestStatus } from '@/config/masters';
import type { DeliveryQuote } from '@/lib/fulfilment';
import type {
  AdminBranch,
  AdminBranchService,
  AdminFloorPlan,
  AdminOrders,
  AdminReservations,
  AdminRole,
  AdminServiceRequest,
  AdminSession,
  AdminStaffMember,
  AdminTableDetail,
  AdminTableQrCodes,
  CancelReason,
  FloorPlanLayout,
  Reservation,
  StaffPermission,
  StaffScope,
} from '@/types/admin';
import type { AtTableMethodKey, BranchImage, OrderMode, PaymentMethodId } from '@/types/branch';
import type { BranchDetails, BranchSettings, BranchSettingsChoices } from '@/types/branchSettings';
import type { LineConfig } from '@/types/cart';
import type {
  Allergen,
  Category,
  CategoryId,
  ComboInfo,
  Dish,
  DishAvailability,
  DishImage,
  DishTag,
  Price,
  SpiceLevel,
} from '@/types/menu';
import type {
  DeliveryAddress,
  Order,
  OrderStatus,
  PaymentStatus as OrderPaymentStatus,
  RefundReason,
  WaiveReason,
} from '@/types/order';
import type { AutoOffer, PromoDescriptionKey } from '@/types/promotion';
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
  | 'nothing_to_order'
  /** 403: the restaurant doesn't have this feature (`feature`): the platform switches it on. */
  | 'feature_disabled'
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
}

/** A table the floor plan can't leave out yet: its open orders or bill, or its bookings to come. */
export interface TableInUse {
  number: number;
  reason: 'openOrder' | 'booking';
  /** What the plan would do to it: leave it out, or take it out of service. */
  change: 'removed' | 'disabled';
}

/* ---------- Admin sessions ---------- */

/**
 * `POST /admin/sessions` — a staff member signs in with their email or mobile number
 * (`identity`, as typed: the server decides whether it matches an account) and password.
 * 201 → the session (`token` for admin requests, the admin's profile, `expiresAt`). Errors:
 * 400 invalid_request, 401 invalid_credentials (unknown identity or wrong password; the server
 * doesn't say which).
 */
export interface AdminSignInRequest {
  identity: string;
  password: string;
}

export type AdminSignInResponse = AdminSession;

/**
 * `DELETE /admin/sessions/current` — signs out: the session's token stops working at once, on
 * every device that holds it. No body. 204. Errors: 401 unauthorized.
 */

/**
 * `GET /admin/branches` — the branches the signed-in admin manages (not every branch), with
 * what the branch picker shows. Authorised by the session: `Authorization: Bearer <token>`.
 * 200 → `{ branches }` in the account's order. One branch: the app selects it and opens the
 * dashboard; several: the admin picks one. Errors: 401 unauthorized (no token, an unknown
 * token, or the session has expired).
 */
export interface AdminBranchesResponse {
  branches: AdminBranch[];
}

/* ---------- Admin: branch settings ---------- */

/**
 * `GET /admin/branches/:branchId/settings` — the branch's settings as staff edit them, one
 * section per Settings page (details with the region, services, opening hours, tax & service
 * charge, payment methods, delivery zones, pickup), and what the pages may choose from (the
 * payment methods the branch's country offers on each screen). Authorised like GET
 * /admin/branches. 200 → `BranchSettingsResponse`. Errors: 401, 403.
 *
 * `PATCH /admin/branches/:branchId/settings` — replaces the sections sent (each whole; the
 * others stay), each checked against the branch as the sections before it left it. Everything
 * reads the branch through GET /branches, so guests' screens, prices, checkout and the server's
 * own checks follow at once: the region (another country brings its phone rules, taxes and
 * payment methods: config/regions), which services are on, today's hours and closed days, taxes
 * and the service charge on new bills, the methods offered at checkout and on the bill, delivery
 * zones, fees and minimums, pickup slots. Orders already placed keep what they were priced
 * with. 200 → `BranchSettingsResponse`. Errors: 400 invalid_request (lib/branchSettings ›
 * detailsErrors, servicesErrors, hoursErrors, taxErrors, paymentErrors, deliveryErrors,
 * pickupErrors), 401, 403.
 */
export interface BranchSettingsResponse {
  settings: BranchSettings;
  choices: BranchSettingsChoices;
}

export type UpdateBranchSettingsRequest = Partial<BranchSettings>;

/**
 * `POST /admin/branches` — opens a new branch (Settings › Branches) with these details, including
 * its region (country, time zone, locale, currency). Its opening hours, delivery zones and
 * pickup, menu, promotions and floor plan start as a copy of `copyFrom` (one of the admin's
 * branches), and so do its taxes and payment methods unless `details.country` differs, when it
 * takes that country's (config/regions). Staff change them in Settings afterwards. The admin
 * manages it at once (GET /admin/branches lists it), guests can choose it on the start screen,
 * and it's open. 201 → `AdminBranch`. Errors: 400 invalid_request (details as for PATCH
 * …/settings, or an unknown `copyFrom`), 401, 403 (`copyFrom` isn't the admin's).
 *
 * `DELETE /admin/branches/:branchId` — removes a branch: it leaves GET /branches and GET
 * /admin/branches, so guests can't choose it and staff can't open it. The admin keeps at least
 * one branch, and a branch with orders today still to finish or pay stays until they're done.
 * 204. Errors: 401, 403, 409 last_branch / branch_in_use.
 */
export interface CreateBranchRequest {
  details: BranchDetails;
  copyFrom: string;
}

/* ---------- Admin: floor service ---------- */

/**
 * `GET /admin/branches/:branchId/service` — what the floor staff of one branch need to act on
 * now (the waiter home). Authorised like GET /admin/branches. 200 → `BranchServiceResponse`:
 * the open waiter and bill requests (oldest first, with who's on the way); those dealt with in
 * the last 30 minutes (`doneRequests`, newest first, with who dealt with them); today's orders (branch time zone) that are
 * still active or not paid in full, newest first, each with its rounds ready to serve; the tables
 * with activity today and where each is in its visit; and the counts. Errors: 401 unauthorized,
 * 403 forbidden (not one of the admin's branches, or no such branch). Poll it (the app: every
 * 15 s and on returning to the tab). Mock: from the orders and requests on this device plus the
 * drawn history; takeaway and delivery orders have no table.
 */
export type BranchServiceResponse = AdminBranchService;

/**
 * `GET /admin/branches/:branchId/tables` — the floor plan: every area of the branch (in the
 * order staff walk them) with its tables, each with its seats and where it is now: available,
 * or taken (needs a waiter, wants the bill, waiting for food, eating), with its open orders
 * counted, what's still due and since when the guests are seated. An order stays open until
 * it's both served and paid. Authorised like GET /admin/branches. 200 → `FloorPlanResponse`.
 * Errors: 401 unauthorized, 403 forbidden. Poll it like the service (every 15 s). Mock: the
 * areas from GET /branches/:id/floors (the dummy JSON), the activity as for the service.
 */
export type FloorPlanResponse = AdminFloorPlan;

/**
 * `GET /admin/branches/:branchId/tables/:table` — one table as on the floor plan, with its
 * area, its open orders in full (newest first) and its open requests (oldest first).
 * Authorised like GET /admin/branches. 200 → `TableDetailResponse`. Errors: 401 unauthorized,
 * 403 forbidden, 404 not_found (no area has the table).
 */
export type TableDetailResponse = AdminTableDetail;

/**
 * `GET /admin/branches/:branchId/tables/qr-codes` — the link to print on each table: the guest
 * app's path with the branch, the table and a token the backend signs (so a guest can't change
 * the table number in the link); POST /sessions checks it. The app adds its own address in front
 * and draws the QR code. Authorised like GET /admin/branches. 200 → `TableQrCodesResponse`.
 * Errors: 401, 403. Mock: a token worked out from the branch and table (not a real signature).
 */
export type TableQrCodesResponse = AdminTableQrCodes;

/**
 * `POST /admin/branches/:branchId/tables/:table/free` — the guests have left: the table's
 * `freed` flag is set, so it's available on the floor plan whatever its earlier orders say
 * (those still unpaid stay on GET …/orders to collect). The backend clears the flag with the
 * next order or request at the table. No body. Authorised like GET /admin/branches. 200 →
 * `TableDetailResponse` (the table as now). Errors: 401, 403, 404 not_found (no such table).
 * Mock: the time it was freed is kept per table; GET /branches/:id/floors (the dummy JSON)
 * carries the flag as `freed: false` on every table.
 */
export type FreeTableResponse = TableDetailResponse;

/**
 * `POST /admin/branches/:branchId/tables/:table/orders` — a waiter takes an order at the table
 * for a guest who doesn't order on their phone. Priced like a guest's order (the menu, the
 * offers on now, the branch's taxes), dine-in, paid at the counter; no guest session. Its
 * timeline says who took it. Authorised like GET /admin/branches. 201 → `Order`. Errors: 400
 * invalid_request (no name, a malformed line), 401, 403, 404 not_found (no area has the table),
 * 409 mode_unavailable (no dine-in), 422 empty_order / item_unavailable.
 */
export interface TakeTableOrderRequest {
  /** The guest's name, or what the waiter calls them ("Table 5 guest"). */
  customerName: string;
  kitchenNote?: string;
  lines: OrderLineRequest[];
  /** The pad's key for this order (8–64 of A–Z a–z 0–9 _ -): sent again, it's placed once. */
  idempotencyKey?: string;
}

/* ---------- The branch's status (staff) ---------- */

/**
 * `PATCH /admin/branches/:branchId/status` — staff pause new orders for a while (the kitchen is
 * swamped), close for the rest of the day, or open again. Paused and closed are reported on GET
 * /branches (`status`, `pausedForMinutes`, `reopensTomorrow`), so guests see the paused or closed
 * screen within a minute, and guests' orders and payments for new food are refused (409
 * ordering_unavailable); waiters can still take orders at the table. A pause ends by itself
 * after its minutes; a day closed opens again at the next day's opening time. 200 → the
 * branch as `AdminBranch` (with `statusUntil`). Errors: 400 (another status, or minutes not
 * 15, 30, 45, 60 or 90), 401, 403.
 */
export type SetBranchStatusRequest =
  { status: 'open' } | { status: 'paused'; minutes: 15 | 30 | 45 | 60 | 90 } | { status: 'closed' };

/* ---------- Reservations (staff) ---------- */

/**
 * `GET /admin/branches/:branchId/reservations` — the branch's bookings from the start of today
 * (its time zone) on, every status, by time. Authorised like GET /admin/branches. 200 →
 * `ReservationsResponse`. Errors: 401, 403. Polled like the floor (every 15 s). A booked table
 * shows as `reserved` on the floor plan from an hour before its time until 30 minutes after
 * (`booking` on GET …/tables says for whom); seated guests with nothing ordered yet show as
 * `seated`. Mock: kept on this device (`olive.mock.reservations.v1`); under `npm run dev` each
 * branch starts with sample bookings.
 */
export type ReservationsResponse = AdminReservations;

/**
 * `?from=&to=` on GET …/reservations (Reservations › History): the bookings due on those days of
 * the branch's calendar ("2026-10-01"), every status, by time; one alone means that day. Up to
 * 92 days at once (400 `{ field: 'from' }` past that, or the wrong way round).
 */
export interface ReservationsFilter {
  from?: string;
  to?: string;
}

/**
 * `POST /admin/branches/:branchId/reservations` — a booking taken by phone or at the door — and
 * `PATCH /admin/branches/:branchId/reservations/:id` — a booking changed (only while booked).
 * The table must exist and be free for `minutes` from `at`: a booked or seated booking there
 * overlapping it is refused. Authorised like GET /admin/branches. 201 / 200 → `Reservation`.
 * Errors: 400 invalid_request (no name, party not 1–20, a mobile number the branch's rules
 * refuse, a time in the past or over 60 days ahead, `minutes` not one of 60, 90, 120, 150, 180,
 * a note over 200 characters), 401, 403, 404 not_found (no such table, or booking), 409
 * table_taken (with `reservation`: the booking in the way), 409 reservation_closed (edit only:
 * no longer booked).
 */
export interface ReservationInput {
  /** The main table: the first of `tables` (servers before `tables` read only this). */
  table: number;
  /**
   * Every table, the main one first: all in one area, seating the whole party between them
   * (400 `{ field: 'tables' }` otherwise). Up to 6.
   */
  tables: number[];
  guestName: string;
  /** National mobile digits; optional. */
  phone?: string;
  partySize: number;
  /** ISO. */
  at: string;
  /** Default 90. */
  minutes?: number;
  note?: string;
}

/**
 * `PATCH /admin/branches/:branchId/reservations/:id/status` — the guests arrived (`seated`:
 * booked only, from an hour before its time; the table shows as seated until they order or
 * staff free it), called it off (`cancelled`: booked only), didn't come (`noShow`: booked, once
 * its time has passed), or a cancelled or no-show booking is restored (`booked`: if the table is
 * still free then). Records who and when. Authorised like GET /admin/branches. 200 →
 * `Reservation`. Errors: 400, 401, 403, 404 not_found, 409 reservation_closed (not that change
 * from where it is), 409 table_taken (restoring).
 */
export interface SetReservationStatusRequest {
  status: Reservation['status'];
}

/* ---------- The menu (staff) ---------- */

/**
 * `GET /branches/:id/menu` is the menu everyone reads, staff changes included (the guest app
 * reads it again after a minute and on returning to the tab). Staff change it with these, each
 * authorised like GET /admin/branches; errors 401, 403 and 404 not_found for an unknown dish.
 */

/**
 * `PATCH /admin/branches/:branchId/menu/dishes/:slug/availability` — the most common change:
 * sold out (optionally until a time guests read, "8 PM"), off for the day, or back on; and
 * sizes switched off or on (`variants`: `{ "full": false }`). 200 → `DishResponse`. Errors: 400
 * (an unknown status or size).
 */
export interface SetAvailabilityRequest {
  availability: DishAvailability;
  /** By size id: false to switch a size off, true to put it back. */
  variants?: Record<string, boolean>;
}

/**
 * Everything staff set on a dish: name, short and long description, category, veg or not, tags,
 * spice, prep time and serves; one price or sizes (each named, priced and on or off;
 * the cheapest is the "from" price) with their label ("Portion"); choice groups (each with two or
 * more choices and their extra price, optionally only with some sizes — a meal's slots are choice
 * groups); add-ons (free or priced, optionally per size or only with some sizes) and how many can
 * be picked; ingredients guests can leave out; quick kitchen instructions; a meal's contents and
 * saving; allergens; the picture (POST …/menu/images first); and availability. A new size,
 * group, add-on or ingredient may bring its own id (a-z, 0-9, -) so others can refer to it.
 */
export interface DishInput {
  name: string;
  description: string;
  longDescription?: string;
  categoryId: CategoryId;
  veg: boolean;
  tags: DishTag[];
  spice?: SpiceLevel;
  prepTime?: string;
  serves?: number;
  /** Without sizes. */
  price?: Price;
  /** One or more (one: a named size, "Regular · 350 ml"). */
  variants?: {
    id?: string;
    name: string;
    /** A note under the size, e.g. "Perfect for one". */
    description?: string;
    price: Price;
    available?: boolean;
  }[];
  variantLabel?: string;
  optionGroups?: {
    id?: string;
    name: string;
    showInSummary?: boolean;
    /** Size ids it's offered with (none: every size). */
    availableFor?: string[];
    choices: { name: string; price?: Price; availableFor?: string[] }[];
  }[];
  addOns?: {
    id?: string;
    name: string;
    price: Price;
    availableFor?: string[];
    priceByVariant?: Record<string, Price>;
  }[];
  maxAddOns?: number;
  removables?: { id?: string; name: string }[];
  quickInstructions?: string[];
  combo?: ComboInfo;
  allergens: Allergen[];
  /** Absent: no picture. */
  image?: DishImage;
  /** The small copy uploaded with a new picture (rows, cart, orders); absent: the picture. */
  thumb?: DishImage;
  availability: DishAvailability;
}

/**
 * `POST /admin/branches/:branchId/menu/dishes` — a new dish, last in its category, its slug made
 * from the name. 201 → `DishResponse`. `PATCH /admin/branches/:branchId/menu/dishes/:slug` —
 * the dish as staff left it (moved to another category: last there). 200 → `DishResponse`.
 * Errors: 400 (a missing name, an unknown category, no price, no size, fewer than two choices, a
 * name used twice in a list, an add-on limit above the add-ons, a size id that isn't the dish's).
 * `DELETE /admin/branches/:branchId/menu/dishes/:slug` — off the menu for good (and out of the
 * curated lists). 204.
 */
export type DishResponse = Dish;

/**
 * `PATCH /admin/branches/:branchId/menu/categories/:categoryId/order` — the order guests see a
 * category's dishes in (its "Recommended" order): `slugs`, exactly the category's dishes. 200 →
 * the menu. Errors: 400, 404 (no such category). `PATCH /admin/branches/:branchId/menu/categories`
 * — the categories renamed (name, short name, description) and in their order: exactly the
 * menu's categories (adding or removing one needs the guest pages built again). 200 → the menu.
 */
export interface ReorderDishesRequest {
  slugs: string[];
}

export interface UpdateCategoriesRequest {
  categories: Pick<Category, 'id' | 'name' | 'shortName' | 'description'>[];
}

/**
 * `POST /admin/branches/:branchId/menu/images` — a dish picture, resized by the app (WebP or
 * JPEG, at most 640 px), with its small copy. 201 → `{ image, thumb }` to put on the dish. Errors: 400 (not a JPEG / PNG / WebP data URL,
 * or too large). Mock: the data URL itself is the picture's `src`.
 */
export interface ImageUploadRequest {
  dataUrl: string;
  width: number;
  height: number;
  /** A dish picture's small copy (short side 192 px), kept as its thumbnail. */
  thumb?: { dataUrl: string; width: number; height: number };
}

export interface ImageUploadResponse {
  image: DishImage;
  /** The small copy, when one was sent: saved with the dish as its `thumb`. */
  thumb?: DishImage;
}

/**
 * `POST /admin/branches/:branchId/settings/image` — the branch photo, resized by the app (JPEG,
 * same body as a dish picture). 201 → `{ image }` to save with Settings › Details. Needs
 * `branch.settings.manage`. Mock: the data URL itself is the photo's `src`.
 */
export interface BranchImageUploadResponse {
  image: BranchImage;
}

/**
 * `GET /branches/:branchId/menu/suggestions` — what the search screen shows before the guest
 * types: staff's picks first, then (when auto-fill is on) what was ordered. "Trending tonight":
 * dishes ordered most today, then this week (with a photo); "Popular at…": the names of dishes
 * ordered most in 30 days. Dishes that can't be ordered now are left out. Mock: staff's picks
 * only (it doesn't count orders).
 */
export interface SearchSuggestions {
  /** Dish slugs. */
  trending: string[];
  /** Search words. */
  popular: string[];
}

export type TrendingSource = 'pinned' | 'today' | 'week';
export type PopularSource = 'word' | 'orders';

/**
 * `GET /admin/branches/:branchId/menu/suggestions` (`menu.manage`) — the same, with where each
 * suggestion came from (Admin › Menu › Search suggestions), and staff's pins and words.
 */
export interface AdminSearchSuggestions {
  trending: {
    auto: boolean;
    /** Pinned dishes; `showing: false` while guests can't order it (sold out, off today). */
    pins: { slug: string; name: string; showing: boolean }[];
    showing: { slug: string; name: string; source: TrendingSource; count?: number }[];
  };
  popular: {
    auto: boolean;
    words: string[];
    showing: { term: string; source: PopularSource; slug?: string; count?: number }[];
  };
}

/**
 * `PATCH /admin/branches/:branchId/menu/suggestions` — replaces the pins (up to 4 live dishes),
 * the words (up to 6, 1–40 characters, each once) and the auto-fill switches. 200 →
 * AdminSearchSuggestions. 400 `{ field, reason }` otherwise.
 */
export interface UpdateSearchSuggestionsRequest {
  trending: { auto: boolean; pins: string[] };
  popular: { auto: boolean; words: string[] };
}

/** One payment or refund in Payments › History. */
export interface HistoryTransaction {
  /** "UDY-030-T2". */
  id: string;
  /** The order's code. */
  orderId: string;
  mode: OrderMode;
  table?: number;
  customerName: string;
  kind: 'payment' | 'refund';
  method: string;
  channel: 'online' | 'inPerson';
  amount: number;
  tip?: number;
  waived?: number;
  waiveReason?: string;
  by?: string;
  transactionRef?: string;
  reason?: string;
  status?: 'started' | 'done';
  /** ISO. */
  at: string;
}

/**
 * `GET /admin/branches/:branchId/payments/history?from=&to=&kind=&channel=&method=&q=&cursor=&limit=`
 * (`payments.collect` or `reports.view`) — Payments › History: the days' sums (up to a year at a
 * time, back two years; the last 7 days without any; each payment on the day it was taken),
 * worked out on the server, and a page of the transactions (newest first; `next` for more).
 */
export interface PaymentHistoryResponse {
  from: string;
  to: string;
  summary: {
    collected: number;
    refunds: number;
    refundsPending: number;
    net: number;
    tips: number;
    waived: number;
    payments: number;
    refundCount: number;
    online: number;
    inPerson: number;
    /** Cash taken (with tips) less cash refunds (not the drawer: no float, no paid in or out). */
    cashTaken: number;
    byMethod: {
      method: string;
      channel: 'online' | 'inPerson';
      count: number;
      amount: number;
      refunds: number;
      tips: number;
    }[];
  };
  transactions: HistoryTransaction[];
  matching: number;
  next?: string;
}

export interface PaymentHistoryQuery {
  from: string;
  to: string;
  kind?: 'all' | 'payments' | 'refunds';
  channel?: 'all' | 'online' | 'inPerson';
  method?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

/** One order in Orders › History: what its row shows (opening it reads the whole order). */
export interface HistoryOrder {
  /** The order's code ("BLR-031"). */
  id: string;
  /** The day's token ("#12"), when it has one. */
  token?: number;
  mode: OrderMode;
  table?: number;
  customerName: string;
  status: OrderStatus;
  cancelReason?: CancelReason;
  cancelledBy?: 'guest' | 'restaurant';
  /** Items made (rounds taken back and items the kitchen couldn't make left out). */
  items: number;
  total: number;
  paymentStatus: OrderPaymentStatus;
  /** Still to pay (0 once paid or cancelled). */
  due: number;
  /** The payment method the guest chose. */
  method: string;
  /** The staff member who took it at the table; none when the guest ordered on their phone. */
  takenBy?: string;
  /** ISO. */
  placedAt: string;
}

export type OrderHistoryStatus = 'all' | 'completed' | 'unpaid' | 'cancelled';

/**
 * `GET /admin/branches/:branchId/orders/history?from=&to=&status=&mode=&q=&cursor=&limit=`
 * (READERS.orders) — Orders › History: the days' sums (up to a year at a time, back two years;
 * the last 7 days without any; each order on the day it was placed), worked out on the server,
 * and a page of the orders (newest first, 30 at a time; `next` for more). The filters narrow the
 * list, never the sums.
 */
export interface OrderHistoryResponse {
  from: string;
  to: string;
  summary: {
    orders: number;
    completed: number;
    cancelled: number;
    /** Not handed over and not cancelled. */
    inProgress: number;
    /** Billed on the orders not cancelled. */
    sales: number;
    averageBill: number;
    unpaidOrders: number;
    /** Still to collect on those days' orders. */
    unpaid: number;
    byMode: { mode: OrderMode; orders: number; sales: number }[];
  };
  orders: HistoryOrder[];
  matching: number;
  next?: string;
}

export interface OrderHistoryQuery {
  from: string;
  to: string;
  status?: OrderHistoryStatus;
  mode?: 'all' | OrderMode;
  q?: string;
  cursor?: string;
  limit?: number;
}

/** What became of a request: dealt with, never answered (it lapsed after 30 minutes), or open. */
export type RequestOutcome = 'resolved' | 'lapsed' | 'open';

export type HistoryServiceRequest = AdminServiceRequest & {
  outcome: RequestOutcome;
  /** Minutes from the request to the first answer (on the way, or done); none unanswered. */
  answeredInMinutes?: number;
};

/**
 * `GET /admin/branches/:branchId/service-requests/history?from=&to=&kind=` (whoever sees the
 * service board) — Requests › History: the requests made on those days (the branch's calendar
 * days, up to 31 at a time, back a year; today without any), newest first, with who answered and
 * how fast, and a summary. One a guest took back isn't kept. Mock: every request this device
 * kept, by day.
 */
export interface RequestHistoryResponse {
  from: string;
  to: string;
  requests: HistoryServiceRequest[];
  summary: {
    total: number;
    resolved: number;
    lapsed: number;
    /** Average minutes to the first answer; null when none was answered. */
    averageAnswerMinutes: number | null;
  };
}

/**
 * `GET /sessions/:id/wifi` — the branch's guest Wi-Fi for a guest seated at a table (the
 * password is for them only): null where there's none, or for takeaway and delivery.
 */
export interface SessionWifiResponse {
  wifi: { name: string; password: string } | null;
}

/** Why a dish is suggested in the cart: pinned by staff, ordered together, popular, or the menu. */
export type CartSuggestionSource = 'pinned' | 'together' | 'popular' | 'menu';

export interface CartSuggestion {
  slug: string;
  name: string;
  source: CartSuggestionSource;
  /** "together": the cart dish it's most often ordered with (its name). */
  withName?: string;
  /** "together": orders with both (30 days); "popular": times ordered (30 days). */
  count?: number;
}

/**
 * `GET /branches/:branchId/menu/cart-suggestions?dishes=a,b` — "Goes well with your order": up
 * to 3 dishes, never one in the cart or one that can't be ordered. Staff's pins first, then
 * dishes ordered together with the cart's (in 3+ orders, 30 days), then the most ordered, then
 * the menu, each from the chosen categories. None when switched off. Mock: pins, then the menu.
 */
export interface CartSuggestionsResponse {
  dishes: CartSuggestion[];
}

/**
 * `GET /admin/branches/:branchId/menu/cart-suggestions[?preview=slug]` (`menu.manage`) — the
 * switch, the categories (codes; none: any the cart has nothing from) and the pins (up to 3), and
 * what a guest with `preview` in the cart would see (shown even while switched off).
 */
export interface AdminCartSuggestions {
  enabled: boolean;
  categories: string[];
  pins: { slug: string; name: string; showing: boolean }[];
  preview: { dish: string | null; dishes: CartSuggestion[] };
}

/** `PATCH /admin/branches/:branchId/menu/cart-suggestions[?preview=slug]` → AdminCartSuggestions. */
export interface UpdateCartSuggestionsRequest {
  enabled: boolean;
  categories: string[];
  pins: string[];
}

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
export interface RefundRequest {
  amount: Price;
  reason: RefundReason;
  note?: string;
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
 * `GET /admin/branches/:branchId/floors` — the branch's floor plan as staff set it up (the
 * floors.json shape: areas in the order staff walk them, each with its tables and seats).
 * Authorised like GET /admin/branches. 200 → `FloorPlanLayout`. Errors: 401, 403.
 *
 * `PATCH /admin/branches/:branchId/floors` — replaces it (Settings › Floor plan): areas added,
 * renamed, reordered or removed; tables added, renumbered, moved or removed. Everything that
 * reads the floor plan follows (the Tables page, table pages and QR codes, reservations, the
 * tables guests can scan). A table may be out of service (`disabled: true`): it stays on the
 * plan, but guests, waiters and bookings are refused there (409 table_disabled). A table that's
 * left out (removed, or renumbered) or taken out of service mustn't have an open order or bill
 * today or a booking still to come. 200 → `FloorPlanLayout`. Errors: 400
 * invalid_request (lib/floorLayout › layoutErrors), 401, 403, 409 table_in_use (`tables`).
 */
export type UpdateFloorsRequest = FloorPlanLayout;

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
 * `PATCH /admin/branches/:branchId/orders/:id/rounds/:round/status` — the kitchen moved a round
 * (round 1 for an order of one round) on: `preparing` (started cooking) or `ready` (ready to serve
 * or collect; for delivery, handed to the rider). `ready` may skip `preparing`. Recorded on the
 * round's `kitchen` (`started` / `ready`: when and who); the guest's tracking and the floor follow.
 * Idempotent: a round already there (or further along in the kitchen) answers the same.
 * 200 → the order (`Order`, as GET /orders/:id). Errors: 400 invalid_request (another status),
 * 401 unauthorized, 403 forbidden, 404 not_found (no such order at the branch, or round), 409
 * order_closed (cancelled, or the round already served, picked up or out for delivery).
 */
export interface SetKitchenStatusRequest {
  status: KitchenStep;
  /**
   * An undo or a recall: the round goes back to New (`received`) or to Cooking (`preparing`)
   * from further along (a round already there or behind answers the same). Without it a step
   * only goes forward.
   */
  back?: boolean;
}

/** What the kitchen can mark a round as (`received` only going back). */
export type KitchenStep = 'received' | 'preparing' | 'ready';

/**
 * `POST /admin/branches/:branchId/orders/:id/rounds/:round/dismiss` — the kitchen saw a cancelled
 * ticket and put it away: the round gets `dismissedAt`, and every kitchen screen drops it (a live
 * change). No body. Needs `kitchen.update`. Idempotent. 200 → the order (as the plated tick).
 * Errors: 401, 403, 404 not_found (no such order or round), 409 conflict (not cancelled).
 */

/**
 * `PATCH /admin/branches/:branchId/orders/:id/rounds/:round/items/:position/plated` — the kitchen
 * ticks an item off as plated (or unticks it), so every kitchen screen shows it. `position` is
 * the item's index in the round (0 first). Needs `kitchen.update`. 200 → the order. Errors: 404
 * not_found (no such item), 409 order_closed (cancelled, or the round handed over).
 */
export interface SetPlatedRequest {
  plated: boolean;
}

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

/**
 * `GET /admin/branches/:branchId/roles` — the roles the restaurant gives its staff (built in,
 * read-only; and its own) and every permission there is. Needs `staff.manage`. 200 → this.
 */
export interface RolesResponse {
  roles: AdminRole[];
  /** Every permission, and what each needs: a role with it is saved with those too. */
  permissions: { key: StaffPermission; description: string; needs: StaffPermission[] }[];
}

/**
 * `POST /admin/branches/:branchId/roles` — a role of the restaurant's own (201 → `AdminRole`) —
 * and `PATCH …/roles/:roleId` — one of its own, sent whole (200). `DELETE …/roles/:roleId` →
 * 204. Needs `staff.manage`. Errors: 400 invalid_request, 403 forbidden (a permission the one
 * granting doesn't hold), 404, 409 role_system (built in), 409 role_in_use (`staff`: how many
 * hold it; delete only).
 */
export interface RoleInput {
  name: string;
  description?: string;
  permissions: StaffPermission[];
}

/**
 * `GET /admin/branches/:branchId/staff` — everyone with a role here (the branch's, and the
 * restaurant's admins) and the roles they can be given. Needs `staff.manage`. 200 → this.
 */
export interface StaffResponse {
  staff: AdminStaffMember[];
  roles: { id: string; name: string; scope: StaffScope }[];
}

/**
 * `POST /admin/branches/:branchId/staff` — someone on the staff here: a new account with this
 * password (changed at their first sign-in), or an account the email has, given the role here.
 * 201 → `AdminStaffMember`. Errors: 400 (`field`: phone, roleId), 403 (a role with permissions
 * the one adding doesn't hold), 409 staff_exists (`field`: email — already here; phone —
 * someone else's).
 */
export interface AddStaffRequest {
  name: string;
  email: string;
  /** National digits, by the branch's mobile rules. */
  phone: string;
  roleId: string;
  /** At least 8 characters. */
  password: string;
}

/**
 * `PATCH /admin/branches/:branchId/staff/:staffId` — a new name, a role here, on or off (off
 * signs them out everywhere). 200 → `AdminStaffMember`. Errors: 403, 404, 409 own_account
 * (one's own role or status), 409 last_admin (the restaurant's only active admin).
 */
export interface UpdateStaffRequest {
  name?: string;
  roleId?: string;
  active?: boolean;
}

/**
 * `POST /admin/branches/:branchId/staff/:staffId/password` — a new password for them, changed
 * at their next sign-in; signed out everywhere now. 204. Errors: 403, 404, 409 own_account.
 * `PATCH /admin/sessions/current/password` (`ChangePasswordRequest`) — one's own: 204; 401
 * wrong_password.
 */
export interface ResetStaffPasswordRequest {
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  /** At least 8 characters. */
  newPassword: string;
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

/**
 * `POST /admin/branches/:branchId/orders/:id/messages` — the kitchen tells the waiters about an
 * order: a request of the `kitchen` kind on their board, dealt with like a guest's call. Needs
 * `kitchen.update`. 201 → `{ request }`. Errors: 400 invalid_request, 404 not_found.
 */
export interface KitchenMessageRequest {
  reason: 'runningLate' | 'unavailable' | 'question';
  /** Up to 80 characters. */
  note?: string;
}

/**
 * `GET /admin/branches/:branchId/events` — Server-Sent Events: what changes at the branch, for as
 * long as the screen keeps it open (`orders.view`, `kitchen.update` or `inventory.view`). `event:`
 * orders | service | menu | inventory | resync,
 * `data:` this; the screen reads again through the usual endpoints. A heartbeat comment every
 * 25 s; closed when the session ends. 429 rate_limited past six streams for one sign-in.
 */
export interface BranchEvent {
  kind: 'orders' | 'service' | 'menu' | 'inventory' | 'resync';
  orderId?: string;
  at: string;
}

export type SetKitchenStatusResponse = Order;

/* ---------- Sessions ---------- */

/**
 * `POST /sessions` — open a guest session: dine-in at a branch's table (one per QR scan and
 * device: `{ branchId, mode: 'dineIn', table, qrToken? }`), or takeaway / delivery from an outlet
 * (`{ branchId, mode, deliveryArea? }`). A table scan must carry the table's signed `qrToken`
 * (GET /admin/branches/:id/tables/qr-codes): editing the table in the link breaks the signature.
 * The server opens the session and decides when it expires. 201 → the session. Errors: 400
 * invalid_request (unknown branch, table outside its range, a mode the branch doesn't offer),
 * 403 qr_invalid (no token, or not this table's), 409 table_disabled, 422 area_not_served.
 */
export type CreateSessionRequest = SessionStart;
export type CreateSessionResponse = GuestSession;

/**
 * `GET /sessions/:id` — the session as it is, while it's live. 200 → `GuestSession`. Errors: 404
 * session_not_found once it ended: it expired, or staff freed its table (`POST
 * /admin/branches/:branchId/tables/:table/free` ends every session open at the table, so the
 * next scan starts a new visit). The app checks a session it kept before going on with it.
 * Backend only.
 */
export type SessionResponse = GuestSession;

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
 * and is refused until the cooldown is over, unless a wrong code was entered (with no code on
 * record, it's a first send). 200 → the challenge. Errors: 404 session_not_found, 409
 * otp_not_sent (`resend` to another number), 429 otp_resend_too_soon (`resendAt`).
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

/* ---------- Payments ---------- */

/** A new order, the guest's bill, a round on a running order, or the difference after a change. */
export type PaymentPurpose = PaymentPurposeCode;

export type PaymentStatus = PaymentRequestStatus;

/**
 * `POST /payments` — open an online payment request with the payment partner. The server
 * works out the amount itself: for an order, from the lines and fulfilment (as POST /orders
 * would price them, delivery fee included); for a bill, from what is still due on the listed
 * orders that are this session's and unpaid; for a round (`perRound` branches), the round's
 * share of the re-priced tab; for a change, the new total less what was paid. 201 → the pending
 * payment, open until `expiresAt`. Errors: 404 session_not_found / not_found, 409
 * nothing_to_pay, 409 mode_unavailable, 409 window_closed, 422 empty_order, 422 below_minimum,
 * 422 area_not_served, 422 pickup_unavailable, and a `promoCode`'s errors (POST /promos/validate).
 * Rounds and changes are priced with the order's own code and the offers on now.
 */
export type CreatePaymentRequest =
  | {
      purpose: 'order';
      sessionId: string;
      method: PaymentMethodId;
      lines: OrderLineRequest[];
      fulfilment: FulfilmentRequest;
      /** As on POST /orders: the amount includes its discount. */
      promoCode?: string;
    }
  | { purpose: 'bill'; sessionId: string; method: PaymentMethodId; orderIds: string[] }
  | {
      purpose: 'round';
      sessionId: string;
      method: PaymentMethodId;
      orderId: string;
      lines: OrderLineRequest[];
    }
  | {
      purpose: 'change';
      sessionId: string;
      method: PaymentMethodId;
      orderId: string;
      round: number;
      lines: OrderLineRequest[];
    };

export interface Payment {
  id: string;
  purpose: PaymentPurpose;
  sessionId: string;
  method: PaymentMethodId;
  amount: Price;
  status: PaymentStatus;
  createdAt: number;
  expiresAt: number;
  /** Bill: the orders it pays. Order, round, change: the order it went on, once used. */
  orderIds: string[];
  /** Round, change: the order it's for. */
  orderId?: string;
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

/* ---------- Settings › Offers ---------- */

/**
 * `GET /admin/branches/:branchId/offers` → `AutoOffer[]`: every automatic offer, paused ones
 * too, in list order (`branch.settings.manage`).
 *
 * `POST /admin/branches/:branchId/offers` (`OfferRequest` → 201 `AutoOffer`: its id comes from its
 * name), `PATCH …/offers/:offerId` (`OfferRequest` → `AutoOffer`, replaced in full) and
 * `DELETE …/offers/:offerId` (204). 400 invalid_request (a percent over 100, ends when it starts,
 * dates the wrong way round, no day, no way of ordering, nothing covered), 404 (no such offer),
 * 422 offer_scope_unknown (`unknown`: categories or dishes the branch's menu lacks).
 */
export interface OfferRequest {
  name: string;
  active: boolean;
  days: AutoOffer['days'];
  from: string;
  to: string;
  startsOn?: string;
  endsOn?: string;
  modes: OrderMode[];
  scope: { categories: string[]; dishes: string[] };
  type: AutoOffer['type'];
  value: number;
}

/* ---------- The cash register ---------- */

/** Notes and coins counted: ₹500 × 4, ₹10 × 7 (they add up to the amount they go with). */
export type DrawerCount = { value: Price; quantity: number }[];

/** Why cash went in or out of the drawer, other than an order's. */
export type CashMovementReason = 'float' | 'supplies' | 'withdrawal' | 'bank' | 'other';

export interface CashMovement {
  id: string;
  kind: 'in' | 'out';
  amount: Price;
  reason: CashMovementReason;
  note?: string;
  at: string;
  by?: string;
}

/** What the drawer took and gave back since it opened, besides the float. */
export interface CashTotals {
  /** Cash payments, tips included. */
  taken: Price;
  tips: Price;
  /** Cash handed back (refunds). */
  refunded: Price;
  paidIn: Price;
  paidOut: Price;
  /** Float + taken - refunded + paid in - paid out. */
  expected: Price;
}

/** A branch's cash drawer from opening (a float) to closing (a count). */
export interface CashSession {
  id: string;
  number: number;
  openedAt: string;
  openedBy?: string;
  float: Price;
  openingCount?: DrawerCount;
  movements: CashMovement[];
  /** While open only for staff who see reports (the close count is blind); always once closed. */
  totals?: CashTotals;
  closedAt?: string;
  closedBy?: string;
  counted?: Price;
  closingCount?: DrawerCount;
  /** Counted - expected (negative: short). */
  difference?: Price;
  /** Closed: card, UPI… taken in person, checked against the machine or statement. */
  methods?: CashMethodCheck[];
  /** Closed: a difference above the branch's limit then: it needs review. */
  overLimit?: boolean;
  note?: string;
}

/** A way taken in person during a session, and what was counted (when checked). */
export interface CashMethodCheck {
  method: string;
  expected: Price;
  counted?: Price;
  difference?: Price;
}

export interface CashSessionSummary {
  id: string;
  number: number;
  openedAt: string;
  openedBy?: string;
  closedAt?: string;
  closedBy?: string;
  float: Price;
  expected?: Price;
  counted?: Price;
  difference?: Price;
  overLimit?: boolean;
}

/**
 * `GET /admin/branches/:branchId/cash-register` — the drawer now (`current`, null when closed),
 * the count at the last close (`lastCounted`: the next float) and recent sessions (for staff
 * with `cash.manage` or `reports.view`). Read by those who collect payments too (cash needs an
 * open drawer). `GET …/cash-register/sessions/:id` → one `CashSession`. Backend only.
 */
export interface CashRegisterResponse {
  current: CashSession | null;
  lastCounted?: Price;
  recent: CashSessionSummary[];
  /** How big a difference can be before it needs review (0: any). */
  differenceLimit: Price;
}

/**
 * `GET …/cash-register/days/:day` — the branch's day at the register (sessions opened that
 * calendar day): its cash, card and UPI, what needs review and the sign-off. `POST
 * …/days/:day/sign-off` (`{ note? }`, needs `cash.review`) → the same, signed off; 409 day_open
 * while a session that day is open, 409 day_signed_off.
 */
export interface CashDaySummary {
  day: string;
  sessions: CashSessionSummary[];
  open: boolean;
  cash: {
    float: Price;
    taken: Price;
    refunded: Price;
    paidIn: Price;
    paidOut: Price;
    expected: Price;
    counted: Price;
    difference: Price;
  };
  methods: CashMethodCheck[];
  needsReview: number;
  signOff?: { at: string; by?: string; note?: string };
}

/**
 * `GET …/cash-register/report?from=&to=` — closed sessions day by day (the last 30 days by
 * default, at most 92), and each closer's record. `PATCH …/cash-register/limit` (`{
 * differenceLimit }`, needs `cash.review`) sets how big a difference can be before review.
 */
export interface CashReport {
  from: string;
  to: string;
  days: {
    day: string;
    sessions: number;
    expected: Price;
    counted: Price;
    difference: Price;
    needsReview: number;
    signedOff: boolean;
  }[];
  staff: { name: string; sessions: number; short: Price; over: Price }[];
}

/**
 * `POST …/cash-register/open` (201 → `CashSession`; 409 register_open), `POST …/movements`
 * (→ `CashSession`; 409 register_closed) and `POST …/close` (→ the closed `CashSession`; 409
 * count_differs with `expected` and `difference` until a differing count comes with `note`;
 * 409 register_closed). Need `cash.manage`. A `count` must add up to its amount (400 `count`).
 */
export interface OpenRegisterRequest {
  float: Price;
  count?: DrawerCount;
}
export interface CashMovementRequest {
  kind: 'in' | 'out';
  amount: Price;
  reason: CashMovementReason;
  note?: string;
}
export interface CloseRegisterRequest {
  counted: Price;
  count?: DrawerCount;
  /** Card, UPI…: the machine's batch total or the statement's, as counted (optional). */
  methods?: { method: string; counted: Price }[];
  note?: string;
}

/* ---------- Inventory (backend only) ---------- */

/*
 * `/admin/branches/:branchId/inventory` (types/inventory.ts). Costs and values only with
 * `inventory.manage` or `reports.view`.
 * - `GET /stock` → StockResponse; `GET /stock/:ingredientId?before=` → StockItemResponse;
 *   `GET /movements?from=&to=&kind=&ingredient=&before=` → MovementsResponse (`inventory.view`).
 * - `GET /ingredients` → IngredientsResponse; `GET /alerts` → StockAlertsResponse (any inventory
 *   permission: the kitchen's wastage too).
 * - `PATCH /stock/:ingredientId` (tracked, levels, cost) → StockItem; `POST /opening` → 409
 *   opening_done; ingredients `POST`, `PATCH`/`DELETE /ingredients/:id` (409 name_taken,
 *   ingredient_in_use); categories `POST`, `PATCH`/`DELETE /categories/:id` (`inventory.manage`).
 * - `POST /adjustments` (`inventory.adjust`), `POST /wastage` (`inventory.wastage`) →
 *   StockEntryResponse; 409 not_tracked (`ingredients`: names).
 */
export type * from '@/types/inventory';

/*
 * `/admin/branches/:branchId/purchasing` (types/purchasing.ts): suppliers and their items, purchase
 * orders (approve above the branch's limit, send, cancel, close, suggest), deliveries (receive,
 * confirm prices, price changes) and returns. `purchasing/proofs` keeps invoice photos.
 */
export type * from '@/types/purchasing';

/* ---------- Reservations: deposits, reminders, rules ---------- */

/**
 * `POST /admin/branches/:branchId/reservations/:id/deposit` — the guest paid an advance (one per
 * booking, while booked): cash goes into the open cash register (409 register_closed); proof
 * photos only for other ways. → the `Reservation`. 409 deposit_exists, reservation_closed. A
 * held deposit is kept for a no-show; cancelled `depositCancelHours` or more ahead it's
 * refunded (cash from the drawer), later it's kept; a seated party's is put towards their bill
 * (`deposit` on POST …/payment). `POST …/:id/reminded` → the `Reservation` (staff reminded the
 * guest). `GET …/reservations/guests/:phone` → `GuestHistory`. `PATCH …/reservations/rules`
 * (`ReservationRules`, needs `branch.settings.manage`) → the rules. Backend only.
 */
export interface DepositRequest {
  amount: Price;
  method: string;
  proofs?: string[];
}
