# Backend API contract

The HTTP contract the real backend must implement for The Olive Table. The in-browser mock server
implements exactly this today, so a backend that follows it can replace the mock with a
configuration change. [`src/api/contracts.ts`](../src/api/contracts.ts) is the authoritative
source: its types define every body and its JSDoc every rule; this document organises it by
endpoint.

## Contents

- [Endpoint index](#endpoint-index)
- [Conventions](#conventions)
- [Error codes](#error-codes)
- [Guest session and OTP](#guest-session-and-otp)
- [Menu and reference data](#menu-and-reference-data)
- [Orders and rounds](#orders-and-rounds)
- [Payments](#payments)
- [Service requests](#service-requests)
- [Promotions and delivery quote](#promotions-and-delivery-quote)
- [Admin auth and branches](#admin-auth-and-branches)
- [Admin settings](#admin-settings)
- [Admin floor, tables and QR codes](#admin-floor-tables-and-qr-codes)
- [Admin orders and payments](#admin-orders-and-payments)
- [Admin menu](#admin-menu)
- [Reservations](#reservations)
- [Kitchen](#kitchen)
- [Related](#related)

## Endpoint index

63 endpoints. Paths are relative to the API base URL.

| Method | Path                                                                                                                       | Area                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| POST   | [`/sessions`](#post-sessions)                                                                                              | Guest session and OTP            |
| PATCH  | [`/sessions/:id`](#patch-sessionsid)                                                                                       | Guest session and OTP            |
| POST   | [`/otp`](#post-otp)                                                                                                        | Guest session and OTP            |
| POST   | [`/otp/verify`](#post-otpverify)                                                                                           | Guest session and OTP            |
| GET    | [`/restaurant`](#get-restaurant)                                                                                           | Menu and reference data          |
| GET    | [`/branches`](#get-branches)                                                                                               | Menu and reference data          |
| GET    | [`/branches/:id/status`](#get-branchesidstatus)                                                                            | Menu and reference data          |
| GET    | [`/branches/:id/menu`](#get-branchesidmenu)                                                                                | Menu and reference data          |
| GET    | [`/branches/:id/promotions`](#get-branchesidpromotions)                                                                    | Menu and reference data          |
| GET    | [`/branches/:id/floors`](#get-branchesidfloors)                                                                            | Menu and reference data          |
| GET    | [`/help`](#get-help)                                                                                                       | Menu and reference data          |
| GET    | [`/content/:namespace`](#get-contentnamespace)                                                                             | Menu and reference data          |
| GET    | [`/orders`](#get-orders)                                                                                                   | Menu and reference data          |
| POST   | [`/orders`](#post-orders)                                                                                                  | Orders and rounds                |
| GET    | [`/orders/:id`](#get-ordersid)                                                                                             | Orders and rounds                |
| GET    | [`/sessions/:id/orders`](#get-sessionsidorders)                                                                            | Orders and rounds                |
| GET    | [`/tables/:branchId/:table/orders`](#get-tablesbranchidtableorders)                                                        | Orders and rounds                |
| POST   | [`/orders/:id/rounds`](#post-ordersidrounds)                                                                               | Orders and rounds                |
| PATCH  | [`/orders/:id`](#patch-ordersid)                                                                                           | Orders and rounds                |
| POST   | [`/orders/:id/cancel`](#post-ordersidcancel)                                                                               | Orders and rounds                |
| POST   | [`/payments`](#post-payments)                                                                                              | Payments                         |
| POST   | [`/payments/:id/simulate`](#post-paymentsidsimulate)                                                                       | Payments                         |
| POST   | [`/service-requests`](#post-service-requests)                                                                              | Service requests                 |
| DELETE | [`/service-requests/:id`](#delete-service-requestsid)                                                                      | Service requests                 |
| GET    | [`/sessions/:id/service-requests`](#get-sessionsidservice-requests)                                                        | Service requests                 |
| POST   | [`/promos/validate`](#post-promosvalidate)                                                                                 | Promotions and delivery quote    |
| POST   | [`/delivery/quote`](#post-deliveryquote)                                                                                   | Promotions and delivery quote    |
| POST   | [`/admin/sessions`](#post-adminsessions)                                                                                   | Admin auth and branches          |
| GET    | [`/admin/branches`](#get-adminbranches)                                                                                    | Admin auth and branches          |
| POST   | [`/admin/branches`](#post-adminbranches)                                                                                   | Admin auth and branches          |
| DELETE | [`/admin/branches/:branchId`](#delete-adminbranchesbranchid)                                                               | Admin auth and branches          |
| PATCH  | [`/admin/branches/:branchId/status`](#patch-adminbranchesbranchidstatus)                                                   | Admin auth and branches          |
| GET    | [`/admin/branches/:branchId/settings`](#get-adminbranchesbranchidsettings)                                                 | Admin settings                   |
| PATCH  | [`/admin/branches/:branchId/settings`](#patch-adminbranchesbranchidsettings)                                               | Admin settings                   |
| GET    | [`/admin/branches/:branchId/service`](#get-adminbranchesbranchidservice)                                                   | Admin floor, tables and QR codes |
| GET    | [`/admin/branches/:branchId/tables`](#get-adminbranchesbranchidtables)                                                     | Admin floor, tables and QR codes |
| GET    | [`/admin/branches/:branchId/tables/qr-codes`](#get-adminbranchesbranchidtablesqr-codes)                                    | Admin floor, tables and QR codes |
| GET    | [`/admin/branches/:branchId/tables/:table`](#get-adminbranchesbranchidtablestable)                                         | Admin floor, tables and QR codes |
| POST   | [`/admin/branches/:branchId/tables/:table/free`](#post-adminbranchesbranchidtablestablefree)                               | Admin floor, tables and QR codes |
| GET    | [`/admin/branches/:branchId/floors`](#get-adminbranchesbranchidfloors)                                                     | Admin floor, tables and QR codes |
| PATCH  | [`/admin/branches/:branchId/floors`](#patch-adminbranchesbranchidfloors)                                                   | Admin floor, tables and QR codes |
| GET    | [`/admin/branches/:branchId/orders`](#get-adminbranchesbranchidorders)                                                     | Admin orders and payments        |
| POST   | [`/admin/branches/:branchId/tables/:table/orders`](#post-adminbranchesbranchidtablestableorders)                           | Admin orders and payments        |
| POST   | [`/admin/branches/:branchId/orders/:id/rounds`](#post-adminbranchesbranchidordersidrounds)                                 | Admin orders and payments        |
| PATCH  | [`/admin/branches/:branchId/orders/:id/rounds/:round`](#patch-adminbranchesbranchidordersidroundsround)                    | Admin orders and payments        |
| POST   | [`/admin/branches/:branchId/orders/:id/payment`](#post-adminbranchesbranchidordersidpayment)                               | Admin orders and payments        |
| POST   | [`/admin/branches/:branchId/tables/:table/payment`](#post-adminbranchesbranchidtablestablepayment)                         | Admin orders and payments        |
| POST   | [`/admin/branches/:branchId/orders/:id/refund`](#post-adminbranchesbranchidordersidrefund)                                 | Admin orders and payments        |
| POST   | [`/admin/branches/:branchId/orders/:id/cancel`](#post-adminbranchesbranchidordersidcancel)                                 | Admin orders and payments        |
| POST   | [`/admin/orders/:id/served`](#post-adminordersidserved)                                                                    | Admin orders and payments        |
| POST   | [`/admin/service-requests/:id/acknowledge`](#post-adminservice-requestsidacknowledge)                                      | Admin orders and payments        |
| POST   | [`/admin/service-requests/:id/resolve`](#post-adminservice-requestsidresolve)                                              | Admin orders and payments        |
| PATCH  | [`/admin/branches/:branchId/menu/dishes/:slug/availability`](#patch-adminbranchesbranchidmenudishesslugavailability)       | Admin menu                       |
| POST   | [`/admin/branches/:branchId/menu/dishes`](#post-adminbranchesbranchidmenudishes)                                           | Admin menu                       |
| PATCH  | [`/admin/branches/:branchId/menu/dishes/:slug`](#patch-adminbranchesbranchidmenudishesslug)                                | Admin menu                       |
| DELETE | [`/admin/branches/:branchId/menu/dishes/:slug`](#delete-adminbranchesbranchidmenudishesslug)                               | Admin menu                       |
| PATCH  | [`/admin/branches/:branchId/menu/categories/:categoryId/order`](#patch-adminbranchesbranchidmenucategoriescategoryidorder) | Admin menu                       |
| PATCH  | [`/admin/branches/:branchId/menu/categories`](#patch-adminbranchesbranchidmenucategories)                                  | Admin menu                       |
| POST   | [`/admin/branches/:branchId/menu/images`](#post-adminbranchesbranchidmenuimages)                                           | Admin menu                       |
| GET    | [`/admin/branches/:branchId/reservations`](#get-adminbranchesbranchidreservations)                                         | Reservations                     |
| POST   | [`/admin/branches/:branchId/reservations`](#post-adminbranchesbranchidreservations)                                        | Reservations                     |
| PATCH  | [`/admin/branches/:branchId/reservations/:id`](#patch-adminbranchesbranchidreservationsid)                                 | Reservations                     |
| PATCH  | [`/admin/branches/:branchId/reservations/:id/status`](#patch-adminbranchesbranchidreservationsidstatus)                    | Reservations                     |
| PATCH  | [`/admin/branches/:branchId/orders/:id/rounds/:round/status`](#patch-adminbranchesbranchidordersidroundsroundstatus)       | Kitchen                          |

## Conventions

- **Base URL.** Paths are relative to `NEXT_PUBLIC_API_BASE_URL` (for example
  `https://api.example.com/orders`). The app sends no suffix when `NEXT_PUBLIC_API_SUFFIX` is `""`.
- **JSON.** Request and response bodies are JSON (`Content-Type: application/json`). A `204`
  response has no body. Path segments are URL-encoded by the client.
- **Guest identity.** Guest endpoints are unauthenticated; they carry a `sessionId` (from
  `POST /sessions`) in the body or path. The server derives branch, mode and table from the session,
  never from the body.
- **Staff auth.** Every `/admin/*` endpoint except `POST /admin/sessions` requires
  `Authorization: Bearer <token>` with the token from `POST /admin/sessions`. A missing, unknown or
  expired token is `401 unauthorized`; a branch (or an order or request of a branch) the admin
  does not manage is `403 forbidden`.
- **Errors.** Any failure is a non-2xx status with an [`ApiErrorBody`](../src/api/contracts.ts):
  `{ error, ...extras }`. See [Error codes](#error-codes).
- **Money.** Amounts are numbers in major units of the branch currency (`Price`), for example
  `1424.5`. The server computes every price; client-sent amounts are only `amount` and `tip` on
  staff payments and refunds.
- **Times.** Epoch milliseconds on sessions, OTP challenges, payments and admin sessions
  (`expiresAt`, `sentAt`, `resendAt`, `createdAt`). ISO 8601 strings on orders, rounds,
  reservations and pickup slots (`placedAt`, `at`, `pickupAt`). "Today" is always the branch's day
  in its own time zone.
- **Order lines.** Clients send what was chosen ([`OrderLineRequest`](../src/api/contracts.ts):
  the dish, size, choices, add-ons and quantity); the server prices each line from its menu.

```json
{ "error": "otp_wrong_code", "attemptsLeft": 2, "resendAt": 1760870400000 }
```

## Error codes

`ApiErrorCode` in [`contracts.ts`](../src/api/contracts.ts). Extra fields appear on the error body
where listed.

### General and auth

| Code                  | Status | Meaning                                               |
| --------------------- | ------ | ----------------------------------------------------- |
| `invalid_request`     | 400    | Malformed body or a value the rules refuse            |
| `not_found`           | 404    | No such order, payment, request, table or dish        |
| `invalid_credentials` | 401    | No staff account matches identity and password        |
| `unauthorized`        | 401    | No admin token, an unknown one, or an expired session |
| `forbidden`           | 403    | The admin does not manage this branch                 |

### Guest session and OTP

| Code                  | Status    | Meaning                                                 |
| --------------------- | --------- | ------------------------------------------------------- |
| `session_not_found`   | 404 / 410 | Guest session unknown or expired; scan again            |
| `otp_not_sent`        | 409       | No OTP was sent to this number in this session          |
| `otp_resend_too_soon` | 429       | Cooldown not over; extra `resendAt`                     |
| `otp_wrong_code`      | 422       | Wrong code; extra `attemptsLeft` (mock also `resendAt`) |
| `otp_locked`          | 423       | No attempts left; extra `attemptsLeft: 0`               |
| `phone_not_verified`  | 403       | The session's mobile number is not verified             |

### Ordering

| Code                   | Status | Meaning                                                |
| ---------------------- | ------ | ------------------------------------------------------ |
| `empty_order`          | 422    | Nothing orderable in the order                         |
| `item_unavailable`     | 422    | A dish or size is sold out or off; extra `items`       |
| `mode_unavailable`     | 409    | Mode not the session's or not offered here             |
| `area_not_served`      | 422    | The branch does not deliver to this area               |
| `below_minimum`        | 422    | Below the mode's or code's minimum; extra `shortBy`    |
| `pickup_unavailable`   | 422    | The pickup slot is no longer on offer                  |
| `window_closed`        | 409    | Too late to change or cancel the order or round        |
| `order_closed`         | 409    | The order is cancelled (or finished, for some actions) |
| `ordering_unavailable` | 409    | The branch is paused or closed for guest orders        |
| `table_disabled`       | 409    | The table is out of service                            |
| `not_ready`            | 409    | The order or round is not ready to serve               |

### Payments

| Code                | Status | Meaning                                                       |
| ------------------- | ------ | ------------------------------------------------------------- |
| `payment_required`  | 402    | An online method needs a succeeded payment; extra `amountDue` |
| `payment_conflict`  | 409    | Payment not pending, already used, or does not match          |
| `nothing_to_pay`    | 409    | None of the orders can be paid                                |
| `nothing_to_refund` | 409    | Nothing paid on the order is left to refund                   |

### Promotions

| Code                      | Status | Meaning                                           |
| ------------------------- | ------ | ------------------------------------------------- |
| `promo_invalid`           | 422    | No such code at the branch, or not usable yet     |
| `promo_expired`           | 422    | The code's `validTo` has passed                   |
| `promo_mode_not_eligible` | 422    | The code is not for the session's order mode      |
| `promo_limit_reached`     | 422    | The guest has used the code `perGuestLimit` times |

### Service, floor and branches

| Code                 | Status | Meaning                                                |
| -------------------- | ------ | ------------------------------------------------------ |
| `dine_in_only`       | 409    | Waiter and bill requests need a dine-in session        |
| `request_closed`     | 409    | The waiter call or bill request was already dealt with |
| `table_taken`        | 409    | Another booking holds the table; extra `reservation`   |
| `reservation_closed` | 409    | The booking cannot change that way any more            |
| `table_in_use`       | 409    | A table the plan drops is in use; extra `tables`       |
| `last_branch`        | 409    | The admin's only branch cannot be removed              |
| `branch_in_use`      | 409    | The branch has unfinished or unpaid orders today       |

Extras: `attemptsLeft` (number), `resendAt` (epoch ms), `shortBy` and `amountDue` (`Price`),
`items` (dish names), `reservation` (`{ id, guestName, at }`), `tables`
([`TableInUse[]`](../src/api/contracts.ts): `{ number, reason, change }`).

## Guest session and OTP

### POST /sessions

Opens a guest session: dine-in at a table (one per QR scan and device), or takeaway or delivery
from an outlet.

- **Auth:** none.
- **Request:** [`CreateSessionRequest`](../src/api/contracts.ts) (`SessionStart`):
  `{ branchId, mode: 'dineIn', table, qrToken? }` or `{ branchId, mode, deliveryArea? }`.
- **Response:** `201` [`CreateSessionResponse`](../src/api/contracts.ts) (`GuestSession`:
  `{ id, branchId, mode, table?, floor?, deliveryArea?, startedAt, expiresAt, qrToken? }`;
  `floor` is the floor plan's area the table is in, shown on the welcome screen).
- **Errors:** `400 invalid_request`, `409 table_disabled`, `422 area_not_served`.
- **Rules:**
  - Verify the signed `qrToken` when sent (issued by `GET /admin/branches/:branchId/tables/qr-codes`).
  - Unknown branch, a table outside the branch's range, a table on a non-dine-in session, or a mode
    the branch does not offer is `400`.
  - The server sets `expiresAt` (mock: 6 hours).

### PATCH /sessions/:id

Orders another way, or to another delivery area, within the same session (cart, checkout and
orders stay with it).

- **Auth:** none.
- **Request:** [`UpdateSessionRequest`](../src/api/contracts.ts) `{ mode?, deliveryArea? }`.
- **Response:** `200` `GuestSession`.
- **Errors:** `400 invalid_request`, `404 session_not_found`, `409 mode_unavailable`,
  `422 area_not_served`.
- **Rules:**
  - Dine-in only for a session that has a scanned table; only modes the branch offers.

### POST /otp

Texts a one-time code to the guest's mobile number for this session.

- **Auth:** none.
- **Request:** [`SendOtpRequest`](../src/api/contracts.ts) `{ sessionId, phone, resend? }`.
- **Response:** `200` [`OtpChallenge`](../src/api/contracts.ts)
  `{ phone, sentAt, resendAt, attemptsLeft, maxAttempts, verified }`.
- **Errors:** `400 invalid_request`, `404 session_not_found`, `409 otp_not_sent`,
  `429 otp_resend_too_soon` (`resendAt`).
- **Rules:**
  - `phone` is national digits valid for the branch's `mobile` rules; otherwise `400`.
  - A first send, or a new number, always goes out.
  - `resend: true` re-sends to the same number (`409 otp_not_sent` for a different one) and is
    refused until the cooldown ends (mock: 30 s), except straight after a wrong code.
  - A number already verified in this session stays verified when sent again.

### POST /otp/verify

Checks the code.

- **Auth:** none.
- **Request:** [`VerifyOtpRequest`](../src/api/contracts.ts) `{ sessionId, phone, code }`.
- **Response:** `200` [`VerifyOtpResponse`](../src/api/contracts.ts) `{ verified: true }`.
- **Errors:** `400 invalid_request`, `404 session_not_found`, `409 otp_not_sent`,
  `422 otp_wrong_code` (`attemptsLeft`), `423 otp_locked` (`attemptsLeft: 0`).
- **Rules:**
  - A fixed number of attempts per code (mock: 3); then a new code must be requested.
  - Verification is per session and number; it gates `POST /orders` and `POST /orders/:id/rounds`.

## Menu and reference data

Reference endpoints are read-only and unauthenticated. Today they are static files in
`public/api`; the mock server answers the three marked "mock-owned" so staff changes apply. See
[data-and-api.md](data-and-api.md#reference-data) for file contents.

### GET /restaurant

The brand: name, tagline, `defaultBranchId` and social links.

- **Auth:** none.
- **Request:** none.
- **Response:** `200` `Restaurant` ([`src/types/restaurant.ts`](../src/types/restaurant.ts)).
- **Errors:** none specified.
- **Rules:**
  - Static reference data; changes only with a deploy.

### GET /branches

Every branch with its hours, live status and region rules (mock-owned).

- **Auth:** none.
- **Request:** none.
- **Response:** `200` `Branch[]` ([`src/types/branch.ts`](../src/types/branch.ts)).
- **Errors:** none specified.
- **Rules:**
  - Reflects staff settings at once: details, today's hours and closed days from the weekly
    schedule, taxes, payment methods, delivery zones, pickup, added and removed branches.
  - Reports the status staff set (`status`, `pausedForMinutes`, `reopensTomorrow`).
  - `tables` covers every table on the saved floor plan and lists `outOfService` tables.
  - The app reads it once per visit, again after 10 minutes or on window focus; the status
    alone is polled with `GET /branches/:id/status`.

### GET /branches/:id/status

Just a branch's status now: what changes during service, without its settings.

- **Auth:** none.
- **Request:** none.
- **Response:** `200` `BranchLiveStatus` ([`src/types/branch.ts`](../src/types/branch.ts)):
  `{ id, status, opensAt, opensIn, pausedForMinutes, reopensTomorrow?, reopensOn? }`.
- **Errors:** `404 not_found` (unknown or removed branch).
- **Rules:**
  - The same values as the branch in `GET /branches` at that moment.
  - Polled every 60 s only on pages where guests order (menu, dish, search, cart, checkout:
    `BranchStatusWatch`), so a pause or close reaches them within a minute. The newer of this and
    the branch list wins (`withLiveStatus`).

### GET /branches/:id/menu

One branch's categories, dishes and curated lists, staff changes included (mock-owned).

- **Auth:** none.
- **Request:** none.
- **Response:** `200` `MenuData` ([`src/types/menu.ts`](../src/types/menu.ts)).
- **Errors:** `404 not_found` (unknown branch).
- **Rules:**
  - Includes availability (sold out, off today, sizes off) so guests, the order pad and pricing
    agree; the app re-reads it after 60 s and on window focus.
  - A branch created by `POST /admin/branches` starts with its source branch's menu.

### GET /branches/:id/promotions

The branch's promo codes and automatic offers (mock-owned).

- **Auth:** none.
- **Request:** none.
- **Response:** `200` `BranchPromotions` ([`src/types/promotion.ts`](../src/types/promotion.ts)).
- **Errors:** `404 not_found` (unknown branch).
- **Rules:**
  - Offers apply by themselves to dishes in scope on their days and hours (branch time).
  - Every server price applies offers first (per item, at pricing time, recorded as
    `OrderItem.offer`), then the code (on the item total after offers); both before service charge
    and tax when the branch's `tax.discountBeforeTax` is true.
  - A branch created by `POST /admin/branches` starts with its source branch's promotions.

### GET /branches/:id/floors

The branch's areas and tables (the `floors.json` shape).

- **Auth:** none.
- **Request:** none.
- **Response:** `200` `FloorPlanLayout` ([`src/types/admin.ts`](../src/types/admin.ts)).
- **Errors:** none specified.
- **Rules:**
  - Today only the mock server's seed; staff read `GET /admin/branches/:branchId/floors`.
  - Each table carries `freed` (see `POST …/tables/:table/free`).

### GET /help

The Help dialogs (Payment help, Allergens and FAQs).

- **Auth:** none.
- **Request:** none.
- **Response:** `200` `HelpTopics` ([`src/types/help.ts`](../src/types/help.ts)).
- **Errors:** none specified.
- **Rules:**
  - Static reference data.

### GET /content/:namespace

Screen copy for one area: `common`, `home`, `menu`, `cart`, `checkout`, `orders`, `service`,
`status`, `kitchen`.

- **Auth:** none.
- **Request:** none.
- **Response:** `200` the namespace's JSON (`ContentMap[ns]` in
  [`src/api/queries.ts`](../src/api/queries.ts)).
- **Errors:** none specified.
- **Rules:**
  - Keys must match `public/api/content/<namespace>.json` exactly; the app type-checks them.

### GET /orders

The drawn order history and the delivery riders.

- **Auth:** none.
- **Request:** none.
- **Response:** `200` `OrdersResponse` ([`src/types/order.ts`](../src/types/order.ts)).
- **Errors:** none specified.
- **Rules:**
  - Mock seed only; screens read orders through the endpoints below. A real backend does not need
    to serve it.

## Orders and rounds

### POST /orders

Places an order.

- **Auth:** none (session in body).
- **Request:** [`PlaceOrderRequest`](../src/api/contracts.ts)
  `{ sessionId, customerName, method, kitchenNote, lines, fulfilment, paymentId?, promoCode? }`;
  `fulfilment` is [`FulfilmentRequest`](../src/api/contracts.ts).
- **Response:** `201` `Order` ([`src/types/order.ts`](../src/types/order.ts)), with `live`.
- **Errors:** `400 invalid_request`, `402 payment_required`, `403 phone_not_verified`,
  `404 session_not_found`, `409 payment_conflict`, `409 mode_unavailable`,
  `409 ordering_unavailable`, `409 table_disabled`, `422 empty_order`, `422 item_unavailable`
  (`items`), `422 below_minimum` (`shortBy`), `422 area_not_served`, `422 pickup_unavailable`, and
  the promo errors of [`POST /promos/validate`](#post-promosvalidate).
- **Rules:**
  - Branch, mode and table come from the session, never the body; `fulfilment.mode` must be the
    session's.
  - Prices come from the branch menu, its tax rules and the delivery fee of the address's zone.
  - `method` must be one the mode offers. An online method needs `paymentId`: a succeeded,
    unused `order` payment of this session, same method, for exactly this total. An in-person
    method (counter, pickup, cash on delivery) leaves the order unpaid.
  - With an online payment, discounts are priced as at the payment's `createdAt`, so the amount
    still matches.
  - The session's mobile number must be verified.
  - Takeaway: `pickupAt` is one of the slots on offer, or `null` for as soon as possible.
  - Issue a new, globally unique order id (the mock numbers per device).
  - Record `promoCode` and `discounts` on the order.

### GET /orders/:id

One order with its live status, item statuses, ETA and timeline.

- **Auth:** none.
- **Request:** none.
- **Response:** `200` [`OrderResponse`](../src/api/contracts.ts) (`Order`).
- **Errors:** `404 not_found`.
- **Rules:**
  - `live: true` while the kitchen is still moving it; the app polls every 30 s while live.

### GET /sessions/:id/orders

The guest's orders at the session's branch, newest first.

- **Auth:** none.
- **Request:** none.
- **Response:** `200` [`OrderListResponse`](../src/api/contracts.ts) `{ orders }`.
- **Errors:** `404 session_not_found`.
- **Rules:**
  - This session's orders, earlier sessions linked to the same guest (mock: every session on the
    device) and the guest's order history, with live statuses.

### GET /tables/:branchId/:table/orders

This visit's orders at a table, every guest's, for the bill.

- **Auth:** none.
- **Request:** none.
- **Response:** `200` [`OrderListResponse`](../src/api/contracts.ts) `{ orders }`, newest first.
- **Errors:** `404 not_found` (unknown branch or table).
- **Rules:**
  - Today in the branch's time zone; cancelled orders excluded.

### POST /orders/:id/rounds

Sends another round to the kitchen on the guest's running dine-in order (their tab).

- **Auth:** none (session in body).
- **Request:** [`AddRoundRequest`](../src/api/contracts.ts)
  `{ sessionId, lines, kitchenNote, method?, paymentId? }`.
- **Response:** `201` `Order` (the new round last in `rounds`).
- **Errors:** `400 invalid_request`, `402 payment_required` (`amountDue`),
  `403 phone_not_verified`, `404 not_found`, `404 session_not_found`, `409 mode_unavailable`,
  `409 order_closed`, `409 payment_conflict`, `409 ordering_unavailable`, `409 table_disabled`,
  `422 empty_order`, `422 item_unavailable`.
- **Rules:**
  - Only the session that placed the order, at its table, with its number verified.
  - The round is priced from the menu and the tab re-priced as one bill (taxes over every round,
    rounded once); the order's promo code is re-priced over every round.
  - Payment follows the branch's `ordering.dineInPayment`: `endOfMeal` puts it on the bill and
    ignores `method`; `perRound` requires a dine-in checkout `method`, and an online one needs
    `paymentId` for a succeeded `round` payment of the round's share.

### PATCH /orders/:id

Changes the items of the order's latest round within the change window.

- **Auth:** none (session in body).
- **Request:** [`ChangeOrderRequest`](../src/api/contracts.ts)
  `{ sessionId, round, lines, kitchenNote, paymentId? }`.
- **Response:** `200` [`OrderChangeResponse`](../src/api/contracts.ts) `{ order, refunded }`.
- **Errors:** `400 invalid_request`, `402 payment_required` (`amountDue`), `404 not_found`,
  `409 window_closed`, `409 payment_conflict`, `422 empty_order`, `422 item_unavailable`,
  `422 below_minimum` (`shortBy`), `422 area_not_served`.
- **Rules:**
  - Only the latest round, while `received` and within `ordering.cancelWindowSeconds`; the server
    is the authority on the window. `round` must name that round.
  - Re-priced from the menu; a delivery fee re-quoted; the minimum order checked.
  - Paid online and the total rises: `paymentId` must be a succeeded `change` payment for the
    difference. The total falls: the difference is refunded (`refunded`).

### POST /orders/:id/cancel

Takes back the order's latest round within the change window.

- **Auth:** none (session in body).
- **Request:** [`CancelOrderRequest`](../src/api/contracts.ts) `{ sessionId, round }`.
- **Response:** `200` [`OrderChangeResponse`](../src/api/contracts.ts) `{ order, refunded }`.
- **Errors:** `400 invalid_request`, `404 not_found`, `409 window_closed`.
- **Rules:**
  - The only round: the whole order is cancelled (`cancelledBy: 'guest'`) and an online payment
    refunded.
  - A later round: only that round is cancelled, the tab re-priced and any overpayment refunded.

## Payments

### POST /payments

Opens an online payment request with the payment partner.

- **Auth:** none (session in body).
- **Request:** [`CreatePaymentRequest`](../src/api/contracts.ts), by `purpose`: `order`
  (`lines`, `fulfilment`, `promoCode?`), `bill` (`orderIds`), `round` (`orderId`, `lines`) or
  `change` (`orderId`, `round`, `lines`); always `sessionId` and `method`.
- **Response:** `201` [`Payment`](../src/api/contracts.ts), `status: 'pending'`, open until
  `expiresAt`.
- **Errors:** `400 invalid_request`, `404 session_not_found`, `404 not_found`,
  `409 nothing_to_pay`, `409 mode_unavailable`, `409 window_closed`, `409 ordering_unavailable`,
  `409 table_disabled`, `422 empty_order`, `422 item_unavailable`, `422 below_minimum`,
  `422 area_not_served`, `422 pickup_unavailable`, and the promo errors of
  [`POST /promos/validate`](#post-promosvalidate).
- **Rules:**
  - The server computes the amount: `order` as `POST /orders` would price it (delivery fee
    included); `bill` from what is still due on the listed orders that are this session's and
    unpaid; `round` the round's share of the re-priced tab; `change` the new total less what was
    paid.
  - `method` must be an online method the branch offers for that screen; `round` only on
    `perRound` branches.
  - `order` and `round` payments are refused while the branch is paused or closed; `bill` is not.
  - Rounds and changes are priced with the order's own code and the offers on now.
  - The payment window is set by the server (mock: 272 s).

### POST /payments/:id/simulate

Mock only. Stands in for the payment partner's result; a real backend settles payments by the
partner's webhook instead.

- **Auth:** none.
- **Request:** [`SimulatePaymentRequest`](../src/api/contracts.ts)
  `{ outcome: 'succeeded' | 'failed' }`.
- **Response:** `200` [`SettledPaymentResponse`](../src/api/contracts.ts) `{ payment, orders }`.
- **Errors:** `400 invalid_request`, `404 not_found`, `409 payment_conflict` (not pending, or
  expired).
- **Rules:**
  - A succeeded `bill` payment marks its still-unpaid orders paid (`orders`) and settles the
    session's pending "Just my orders" bill request.
  - Not part of the production contract: the backend's replacement is a webhook plus a way for the
    app to read the payment's status (the JSDoc names `GET /payments/:id`, which is not yet
    specified or routed).

## Service requests

### POST /service-requests

Calls a waiter or asks for the bill at the session's table.

- **Auth:** none (session in body).
- **Request:** [`CreateServiceRequestRequest`](../src/api/contracts.ts):
  `{ sessionId, kind: 'waiter', reason, note? }` or `{ sessionId, kind: 'bill', scope }`.
- **Response:** `201` [`CreateServiceRequestResponse`](../src/api/contracts.ts)
  `{ request, created: true }`, or `200` with the pending one and `created: false`.
- **Errors:** `400 invalid_request`, `404 session_not_found`, `409 dine_in_only`.
- **Rules:**
  - One pending request of each kind per session; asking again returns it unchanged.
  - The table comes from the session; the bill's balance is computed by the server.
  - Requests lapse after 30 minutes.

### DELETE /service-requests/:id

Cancels a pending request.

- **Auth:** none.
- **Request:** none.
- **Response:** `204`.
- **Errors:** `404 not_found`.
- **Rules:**
  - None beyond existence.

### GET /sessions/:id/service-requests

The session's pending requests.

- **Auth:** none.
- **Request:** none.
- **Response:** `200` [`ServiceRequestListResponse`](../src/api/contracts.ts) `{ requests }`.
- **Errors:** none specified.
- **Rules:**
  - Only this session's pending requests; other guests at the table do not see them.
  - Includes `acknowledgedBy` once staff are on the way; the app polls every 15 s.

## Promotions and delivery quote

### POST /promos/validate

Quotes what a promo code takes off these lines for the session, now.

- **Auth:** none (session in body).
- **Request:** [`ValidatePromoRequest`](../src/api/contracts.ts) `{ sessionId, code, lines }`.
- **Response:** `200` [`PromoQuote`](../src/api/contracts.ts)
  `{ code, descriptionKey, discount, offerDiscount }`.
- **Errors:** `400 invalid_request`, `404 session_not_found`, `422 promo_invalid`,
  `422 promo_expired`, `422 promo_mode_not_eligible`, `422 promo_limit_reached`,
  `422 below_minimum` (`shortBy`).
- **Rules:**
  - Match `code` ignoring case and surrounding spaces; return it as the branch lists it.
  - Check the session's mode, validity dates, the per-guest limit (orders with the code across the
    sessions of the guest's verified number) and `minOrder` on the item total before discounts.
  - The code applies after automatic offers and is capped by its own rules.
  - `POST /orders` and `POST /payments` (`order`) check a `promoCode` the same way.

### POST /delivery/quote

What delivering an item total to an area costs.

- **Auth:** none.
- **Request:** [`DeliveryQuoteRequest`](../src/api/contracts.ts) `{ branchId, area, itemTotal }`.
- **Response:** `200` [`DeliveryQuoteResponse`](../src/api/contracts.ts) (`DeliveryQuote` in
  [`src/lib/fulfilment.ts`](../src/lib/fulfilment.ts)).
- **Errors:** `400 invalid_request` (unknown branch, or it does not deliver),
  `422 area_not_served`.
- **Rules:**
  - The area's zone, its fee (0 once the total reaches the free-delivery threshold), the minimum
    order with `shortBy`, and the ETA.

## Admin auth and branches

### POST /admin/sessions

A staff member signs in.

- **Auth:** none.
- **Request:** [`AdminSignInRequest`](../src/api/contracts.ts) `{ identity, password }`.
- **Response:** `201` [`AdminSignInResponse`](../src/api/contracts.ts) (`AdminSession`:
  `{ token, admin, expiresAt }`).
- **Errors:** `400 invalid_request`, `401 invalid_credentials`.
- **Rules:**
  - `identity` is an email or mobile number as typed; the server decides whether it matches an
    account and never says which part was wrong.
  - The server sets `expiresAt` (mock: 12 hours).

### GET /admin/branches

The branches the signed-in admin manages.

- **Auth:** bearer token.
- **Request:** none.
- **Response:** `200` [`AdminBranchesResponse`](../src/api/contracts.ts) `{ branches }`
  (`AdminBranch[]`).
- **Errors:** `401 unauthorized`.
- **Rules:**
  - Only the account's branches, in the account's order. One branch: the app opens it directly.

### POST /admin/branches

Opens a new branch (Settings › Branches).

- **Auth:** bearer token.
- **Request:** [`CreateBranchRequest`](../src/api/contracts.ts) `{ details, copyFrom }`.
- **Response:** `201` `AdminBranch`.
- **Errors:** `400 invalid_request` (details, or unknown `copyFrom`), `401 unauthorized`,
  `403 forbidden` (`copyFrom` is not the admin's).
- **Rules:**
  - Hours, delivery zones, pickup, menu, promotions and floor plan start as a copy of `copyFrom`.
  - The region (country, time zone, locale, currency) comes from `details`. Taxes and payment
    methods are the copy's, or the new country's presets (`config/regions`) when it differs.
  - The phone must start with the country code of `details.country`.
  - The creator manages it at once; guests can choose it; it starts open. Never reuse an id.

### DELETE /admin/branches/:branchId

Removes a branch.

- **Auth:** bearer token.
- **Request:** none.
- **Response:** `204`.
- **Errors:** `401 unauthorized`, `403 forbidden`, `409 last_branch`, `409 branch_in_use`.
- **Rules:**
  - The branch leaves `GET /branches` and `GET /admin/branches`.
  - The admin always keeps at least one branch; a branch with orders today still to finish or pay
    stays until they are done.

### PATCH /admin/branches/:branchId/status

Pauses new guest orders, closes for the rest of the day, or opens again.

- **Auth:** bearer token.
- **Request:** [`SetBranchStatusRequest`](../src/api/contracts.ts): `{ status: 'open' }`,
  `{ status: 'paused', minutes }` or `{ status: 'closed' }`.
- **Response:** `200` `AdminBranch` with `statusUntil`.
- **Errors:** `400 invalid_request` (another status, or `minutes` not 15, 30, 45, 60 or 90),
  `401 unauthorized`, `403 forbidden`.
- **Rules:**
  - Reported on `GET /branches`; meanwhile guests' orders, rounds and payments for new food are
    `409 ordering_unavailable`. Waiters can still take orders.
  - A pause ends by itself; a closed day reopens at the next day's opening time.

## Admin settings

### GET /admin/branches/:branchId/settings

The branch's settings as the Settings pages edit them, and what they may choose from.

- **Auth:** bearer token.
- **Request:** none.
- **Response:** `200` [`BranchSettingsResponse`](../src/api/contracts.ts) `{ settings, choices }`
  (types in [`src/types/branchSettings.ts`](../src/types/branchSettings.ts)).
- **Errors:** `401 unauthorized`, `403 forbidden`.
- **Rules:**
  - One section per page (details, hours, tax, payments, delivery, pickup, …); `choices` lists the
    payment methods the branch's region offers on each screen.

### PATCH /admin/branches/:branchId/settings

Replaces the sections sent, each whole; the others stay.

- **Auth:** bearer token.
- **Request:** [`UpdateBranchSettingsRequest`](../src/api/contracts.ts)
  (`Partial<BranchSettings>`).
- **Response:** `200` `BranchSettingsResponse`.
- **Errors:** `400 invalid_request`, `401 unauthorized`, `403 forbidden`.
- **Rules:**
  - Validate each section as [`src/lib/branchSettings.ts`](../src/lib/branchSettings.ts) does
    (`detailsErrors`, `hoursErrors`, `taxErrors`, `paymentErrors`, `deliveryErrors`,
    `pickupErrors`); an empty body or unknown section is `400`.
  - `GET /branches` and the server's own checks follow at once: hours and closed days, taxes and
    service charge on new bills, payment methods, delivery zones, fees and minimums, pickup slots.
  - Orders already placed keep what they were priced with.

## Admin floor, tables and QR codes

### GET /admin/branches/:branchId/service

What the floor staff need to act on now (the waiter home).

- **Auth:** bearer token.
- **Request:** none.
- **Response:** `200` [`BranchServiceResponse`](../src/api/contracts.ts) (`AdminBranchService`).
- **Errors:** `401 unauthorized`, `403 forbidden`.
- **Rules:**
  - Open waiter and bill requests, oldest first, with who is on the way.
  - `doneRequests`: those dealt with in the last 30 minutes, newest first, with who did it.
  - Today's orders still active or not paid in full, newest first, each with its rounds ready to
    serve; takeaway and delivery orders have no table.
  - Tables with activity today and their stage; the counts. The app polls every 15 s.

### GET /admin/branches/:branchId/tables

The floor plan with every table's live state.

- **Auth:** bearer token.
- **Request:** none.
- **Response:** `200` [`FloorPlanResponse`](../src/api/contracts.ts) (`AdminFloorPlan`).
- **Errors:** `401 unauthorized`, `403 forbidden`.
- **Rules:**
  - Areas in walking order; each table with seats, status, open order count, amount due, seated
    time and booking.
  - An order stays open until it is both served and paid.
  - A booked table shows `reserved` from an hour before its time until 30 minutes after; a seated
    booking with nothing ordered shows `seated`.

### GET /admin/branches/:branchId/tables/qr-codes

The link to print on each table.

- **Auth:** bearer token.
- **Request:** none.
- **Response:** `200` [`TableQrCodesResponse`](../src/api/contracts.ts) (`AdminTableQrCodes`).
- **Errors:** `401 unauthorized`, `403 forbidden`.
- **Rules:**
  - Each link is the guest app's path with the branch, the table and a token the backend signs, so
    a guest cannot change the table number; `POST /sessions` verifies it.
  - The app prefixes its own origin and draws the QR code. The mock's token is not a real
    signature.
  - Route it before `…/tables/:table`.

### GET /admin/branches/:branchId/tables/:table

One table as on the floor plan, with its open orders and requests.

- **Auth:** bearer token.
- **Request:** none.
- **Response:** `200` [`TableDetailResponse`](../src/api/contracts.ts) (`AdminTableDetail`).
- **Errors:** `401 unauthorized`, `403 forbidden`, `404 not_found` (no area has the table).
- **Rules:**
  - Its area, open orders in full (newest first), open requests (oldest first) and today's
    bookings still to come or seated.

### POST /admin/branches/:branchId/tables/:table/free

The guests have left: the table becomes available.

- **Auth:** bearer token.
- **Request:** none (no body).
- **Response:** `200` [`FreeTableResponse`](../src/api/contracts.ts) (the table as now).
- **Errors:** `401 unauthorized`, `403 forbidden`, `404 not_found`.
- **Rules:**
  - Set the table's `freed` flag; it is available whatever its earlier orders say. Clear the flag
    with the next order or request at the table.
  - Unpaid earlier orders stay on `GET …/orders` to collect.

### GET /admin/branches/:branchId/floors

The floor plan as staff set it up, for editing.

- **Auth:** bearer token.
- **Request:** none.
- **Response:** `200` `FloorPlanLayout`.
- **Errors:** `401 unauthorized`, `403 forbidden`.
- **Rules:**
  - The saved plan, else the branch's published floors.

### PATCH /admin/branches/:branchId/floors

Replaces the floor plan (Settings › Floor plan).

- **Auth:** bearer token.
- **Request:** [`UpdateFloorsRequest`](../src/api/contracts.ts) (`FloorPlanLayout`).
- **Response:** `200` `FloorPlanLayout`.
- **Errors:** `400 invalid_request`, `401 unauthorized`, `403 forbidden`, `409 table_in_use`
  (`tables`).
- **Rules:**
  - Validate as [`src/lib/floorLayout.ts`](../src/lib/floorLayout.ts) `layoutErrors` does.
  - Areas and tables may be added, renamed, renumbered, moved or removed. A table may be
    `disabled: true` (out of service): it stays on the plan, but guests, waiters and bookings get
    `409 table_disabled`.
  - A table left out or taken out of service must not have an open order or bill today or a
    booking still to come.
  - Everything that reads the floor plan follows: tables, table pages, QR codes, reservations and
    the tables guests can scan (`GET /branches`).

## Admin orders and payments

### GET /admin/branches/:branchId/orders

Today's orders at the branch, every mode and state, in full.

- **Auth:** bearer token.
- **Request:** none.
- **Response:** `200` [`AdminOrdersResponse`](../src/api/contracts.ts) (`AdminOrders`).
- **Errors:** `401 unauthorized`, `403 forbidden`.
- **Rules:**
  - Branch time zone; newest first; items, rounds, payment, timeline, pickup or delivery details.
  - Feeds both the Orders page and the kitchen board; polled every 15 s.

### POST /admin/branches/:branchId/tables/:table/orders

A waiter takes an order at the table for a guest not using their phone.

- **Auth:** bearer token.
- **Request:** [`TakeTableOrderRequest`](../src/api/contracts.ts)
  `{ customerName, kitchenNote?, lines }`.
- **Response:** `201` `Order`.
- **Errors:** `400 invalid_request`, `401 unauthorized`, `403 forbidden`, `404 not_found`,
  `409 mode_unavailable`, `409 table_disabled`, `422 empty_order`, `422 item_unavailable`.
- **Rules:**
  - Priced like a guest's order (menu, offers on now, branch taxes); dine-in, paid at the counter,
    no guest session.
  - Allowed while the branch is paused or closed. The timeline records who took it.

### POST /admin/branches/:branchId/orders/:id/rounds

A waiter adds a round to an open dine-in order.

- **Auth:** bearer token.
- **Request:** [`StaffRoundRequest`](../src/api/contracts.ts) `{ kitchenNote?, lines }`.
- **Response:** `201` `Order`.
- **Errors:** `400 invalid_request`, `401 unauthorized`, `403 forbidden`, `404 not_found`,
  `409 mode_unavailable`, `409 order_closed`, `422 empty_order`, `422 item_unavailable`.
- **Rules:**
  - Priced like the guest's own round, on the same bill; what has been paid stays paid.

### PATCH /admin/branches/:branchId/orders/:id/rounds/:round

A waiter changes what is on one round.

- **Auth:** bearer token.
- **Request:** [`EditRoundRequest`](../src/api/contracts.ts) `{ kitchenNote?, lines }`.
- **Response:** `200` [`OrderChangeResponse`](../src/api/contracts.ts) `{ order, refunded }`.
- **Errors:** `400 invalid_request`, `401 unauthorized`, `403 forbidden`, `404 not_found`,
  `409 order_closed`, `409 window_closed`, `422 empty_order`, `422 item_unavailable`.
- **Rules:**
  - Only while the kitchen has not finished the round (`received` or `preparing`).
  - The lines replace the round's items; the tab is re-priced; anything paid beyond the new total
    is refunded. To remove everything, cancel the order.

### POST /admin/branches/:branchId/orders/:id/payment

Staff took the payment in person (cash, card machine, QR wallet), at any point of the meal.

- **Auth:** bearer token.
- **Request:** [`CollectPaymentRequest`](../src/api/contracts.ts) `{ method, amount?, tip? }`.
- **Response:** `200` `Order`.
- **Errors:** `400 invalid_request`, `401 unauthorized`, `403 forbidden`, `404 not_found`,
  `409 order_closed`, `409 nothing_to_pay`.
- **Rules:**
  - `method` is one of the branch's `payments.atTable`.
  - `amount` (more than 0, at most what is due) records a split-bill part; the rest stays due.
    Without it, the whole amount due is paid and `payment.detail` names the method.
  - `tip` is recorded with the payment and is not part of the bill.

### POST /admin/branches/:branchId/tables/:table/payment

Staff took the whole table's payment in person.

- **Auth:** bearer token.
- **Request:** [`CollectTableRequest`](../src/api/contracts.ts) `{ method, tip? }`.
- **Response:** `200` [`TablePaymentResponse`](../src/api/contracts.ts) `{ orders }` (the orders it
  paid).
- **Errors:** `400 invalid_request`, `401 unauthorized`, `403 forbidden`, `409 nothing_to_pay`.
- **Rules:**
  - Every order at the table today with something to pay is paid in full with `method` (one of
    `payments.atTable`).

### POST /admin/branches/:branchId/orders/:id/refund

Staff give money back on an order that stands.

- **Auth:** bearer token.
- **Request:** [`RefundRequest`](../src/api/contracts.ts) `{ amount, reason, note? }`.
- **Response:** `200` `Order`.
- **Errors:** `400 invalid_request` (amount or reason), `401 unauthorized`, `403 forbidden`,
  `404 not_found`, `409 nothing_to_refund`.
- **Rules:**
  - `amount` is at most what has been paid and not yet refunded.
  - Refund the way it was paid: online through the partner (status `started`), in person in cash
    (`done`). The order stays paid; record `payment.refundAmount` and a refund transaction.

### POST /admin/branches/:branchId/orders/:id/cancel

The restaurant cancels an order it cannot complete.

- **Auth:** bearer token.
- **Request:** [`CancelByStaffRequest`](../src/api/contracts.ts) `{ reason }`.
- **Response:** `200` `Order`.
- **Errors:** `400 invalid_request` (unknown reason), `401 unauthorized`, `403 forbidden`,
  `404 not_found`, `409 order_closed` (finished or already cancelled).
- **Rules:**
  - Every round still on it is cancelled; `cancelledBy: 'restaurant'`; `cancelReason` in the
    guest's words, shown on their order page.
  - Anything already paid starts a refund. Not allowed after served, picked up or delivered.

### POST /admin/orders/:id/served

The food is at the table, or handed over at the counter.

- **Auth:** bearer token.
- **Request:** [`MarkServedRequest`](../src/api/contracts.ts) `{ round? }`.
- **Response:** `200` [`MarkServedResponse`](../src/api/contracts.ts) (`Order`).
- **Errors:** `400 invalid_request` (no such round), `401 unauthorized`, `403 forbidden`,
  `404 not_found`, `409 not_ready`, `409 order_closed`.
- **Rules:**
  - `round` names one round of a running order; without it every round ready now is marked.
  - Delivery orders cannot be marked served (`409 not_ready`).
  - Idempotent. The guest's tracking moves to Served or Picked up.

### POST /admin/service-requests/:id/acknowledge

"On my way": a member of staff is heading to the table.

- **Auth:** bearer token.
- **Request:** none (no body).
- **Response:** `200` [`AcknowledgeRequestResponse`](../src/api/contracts.ts) `{ request }`.
- **Errors:** `401 unauthorized`, `403 forbidden`, `404 not_found` (unknown or lapsed),
  `409 request_closed`.
- **Rules:**
  - The request stays open with `acknowledgedAt` and `acknowledgedBy`; whoever said it first
    stays. The guest's page says who is coming.

### POST /admin/service-requests/:id/resolve

A waiter dealt with the request.

- **Auth:** bearer token.
- **Request:** none (no body).
- **Response:** `200` [`ResolveRequestResponse`](../src/api/contracts.ts) `{ request }` with
  `resolvedAt` and `resolvedBy`.
- **Errors:** `401 unauthorized`, `403 forbidden`, `404 not_found` (unknown or lapsed).
- **Rules:**
  - It leaves the queue and the guest's pending requests, and is listed in `doneRequests` for 30
    minutes.
  - Idempotent: resolving again answers the same.

## Admin menu

All menu writes are reflected in `GET /branches/:id/menu` at once. Each answers `404 not_found` for
an unknown dish.

### PATCH /admin/branches/:branchId/menu/dishes/:slug/availability

Sold out, off for the day, back on; sizes switched off or on.

- **Auth:** bearer token.
- **Request:** [`SetAvailabilityRequest`](../src/api/contracts.ts) `{ availability, variants? }`.
- **Response:** `200` [`DishResponse`](../src/api/contracts.ts) (`Dish`).
- **Errors:** `400 invalid_request` (unknown status or size), `401 unauthorized`,
  `403 forbidden`, `404 not_found`.
- **Rules:**
  - Sold out may carry a time guests read ("8 PM") and a future moment it comes back by itself.
  - `variants` maps size id to `false` (off) or `true` (back on).
  - Guest orders containing an unavailable dish or size are refused with `422 item_unavailable`.

### POST /admin/branches/:branchId/menu/dishes

Adds a dish.

- **Auth:** bearer token.
- **Request:** [`DishInput`](../src/api/contracts.ts).
- **Response:** `201` `DishResponse`.
- **Errors:** `400 invalid_request`, `401 unauthorized`, `403 forbidden`.
- **Rules:**
  - Slug derived from the name; placed last in its category.
  - `400` for a missing name, unknown category, no price and no size, a choice group with fewer
    than two choices, a name repeated in a list, an add-on limit above the add-ons, or a size id
    that is not the dish's.
  - A new size, group, add-on or ingredient may bring its own id (`a-z`, `0-9`, `-`).

### PATCH /admin/branches/:branchId/menu/dishes/:slug

Saves a dish as staff left it.

- **Auth:** bearer token.
- **Request:** [`DishInput`](../src/api/contracts.ts).
- **Response:** `200` `DishResponse`.
- **Errors:** `400 invalid_request`, `401 unauthorized`, `403 forbidden`, `404 not_found`.
- **Rules:**
  - Same validation as create. Moved to another category: last there.

### DELETE /admin/branches/:branchId/menu/dishes/:slug

Takes a dish off the menu for good.

- **Auth:** bearer token.
- **Request:** none.
- **Response:** `204`.
- **Errors:** `401 unauthorized`, `403 forbidden`, `404 not_found`.
- **Rules:**
  - Also removed from the curated lists (chef's picks, trending, cart suggestions).

### PATCH /admin/branches/:branchId/menu/categories/:categoryId/order

The order guests see a category's dishes in (its "Recommended" order).

- **Auth:** bearer token.
- **Request:** [`ReorderDishesRequest`](../src/api/contracts.ts) `{ slugs }`.
- **Response:** `200` `MenuData`.
- **Errors:** `400 invalid_request`, `401 unauthorized`, `403 forbidden`, `404 not_found` (no
  such category).
- **Rules:**
  - `slugs` is exactly the category's dishes, each once.

### PATCH /admin/branches/:branchId/menu/categories

Renames and reorders the categories.

- **Auth:** bearer token.
- **Request:** [`UpdateCategoriesRequest`](../src/api/contracts.ts)
  `{ categories: [{ id, name, shortName, description }] }`.
- **Response:** `200` `MenuData`.
- **Errors:** `400 invalid_request`, `401 unauthorized`, `403 forbidden`.
- **Rules:**
  - Exactly the menu's existing categories, in the new order. Adding or removing a category needs
    the static guest pages rebuilt, so it is out of scope.

### POST /admin/branches/:branchId/menu/images

Uploads a dish picture.

- **Auth:** bearer token.
- **Request:** [`ImageUploadRequest`](../src/api/contracts.ts) `{ dataUrl, width, height }`.
- **Response:** `201` [`ImageUploadResponse`](../src/api/contracts.ts) `{ image }`.
- **Errors:** `400 invalid_request`, `401 unauthorized`, `403 forbidden`.
- **Rules:**
  - Accept JPEG, PNG or WebP data URLs (the app resizes to at most 640 px); refuse oversized ones.
  - The returned `image` is then saved on the dish. The mock uses the data URL itself as `src`.

## Reservations

### GET /admin/branches/:branchId/reservations

The branch's bookings from the start of today on.

- **Auth:** bearer token.
- **Request:** none.
- **Response:** `200` [`ReservationsResponse`](../src/api/contracts.ts) (`AdminReservations`).
- **Errors:** `401 unauthorized`, `403 forbidden`.
- **Rules:**
  - Every status, ordered by time, in the branch's time zone. Polled every 15 s.

### POST /admin/branches/:branchId/reservations

A booking taken by phone or at the door.

- **Auth:** bearer token.
- **Request:** [`ReservationInput`](../src/api/contracts.ts)
  `{ table, guestName, phone?, partySize, at, minutes?, note? }`.
- **Response:** `201` `Reservation` ([`src/types/admin.ts`](../src/types/admin.ts)), `booked`.
- **Errors:** `400 invalid_request`, `401 unauthorized`, `403 forbidden`, `404 not_found` (no
  such table), `409 table_disabled`, `409 table_taken` (`reservation`).
- **Rules:**
  - `400` for no name, party not 1 to 20, a phone the branch's rules refuse, a time in the past or
    more than 60 days ahead, `minutes` not 60, 90, 120, 150 or 180 (default 90), a note over 200
    characters.
  - The table must be free for `minutes` from `at`: an overlapping booked or seated booking
    refuses it. Back to back is allowed.
  - Records who created it.

### PATCH /admin/branches/:branchId/reservations/:id

Changes a booking.

- **Auth:** bearer token.
- **Request:** [`ReservationInput`](../src/api/contracts.ts).
- **Response:** `200` `Reservation`.
- **Errors:** as `POST`, plus `404 not_found` (no such booking) and `409 reservation_closed`.
- **Rules:**
  - Only while `booked`. The body is the whole booking: an omitted optional field is cleared.

### PATCH /admin/branches/:branchId/reservations/:id/status

Seats, cancels, marks a no-show, or restores a booking.

- **Auth:** bearer token.
- **Request:** [`SetReservationStatusRequest`](../src/api/contracts.ts) `{ status }`.
- **Response:** `200` `Reservation`.
- **Errors:** `400 invalid_request`, `401 unauthorized`, `403 forbidden`, `404 not_found`,
  `409 reservation_closed`, `409 table_taken` (restoring).
- **Rules:**
  - `seated`: from `booked`, from an hour before its time; the table shows seated until the guests
    order or staff free it.
  - `cancelled`: from `booked`. `noShow`: from `booked`, once its time has passed.
  - `booked`: restores a cancelled or no-show booking if the table is still free.
  - Records who changed it and when.

## Kitchen

The kitchen board reads [`GET /admin/branches/:branchId/orders`](#get-adminbranchesbranchidorders).

### PATCH /admin/branches/:branchId/orders/:id/rounds/:round/status

The kitchen moves a round on: started cooking, or ready.

- **Auth:** bearer token.
- **Request:** [`SetKitchenStatusRequest`](../src/api/contracts.ts)
  `{ status: 'preparing' | 'ready' }`.
- **Response:** `200` [`SetKitchenStatusResponse`](../src/api/contracts.ts) (`Order`).
- **Errors:** `400 invalid_request`, `401 unauthorized`, `403 forbidden`, `404 not_found` (no
  such order at the branch, or round), `409 order_closed`.
- **Rules:**
  - Round 1 for an order with a single round. `ready` may skip `preparing`; for delivery, ready
    means handed to the rider.
  - Record on the round's `kitchen` (`started`, `ready`: when and by whom); the guest's tracking
    and the floor follow.
  - Idempotent: a round already at that step or further answers the same and keeps the first
    marker.
  - `409 order_closed` when the order is cancelled or the round already served, picked up or out
    for delivery.

## Related

- [README](README.md)
- [Architecture](architecture.md)
- [Conventions](conventions.md)
- [Testing](testing.md)
- [Guest app](guest-app.md)
- [Staff app](staff-app.md)
- [Settings](settings.md)
- [Data and API](data-and-api.md)
- [API contract](api-contract.md)
- [Masters and config](masters-and-config.md)
- [How-to guides](how-to.md)
- [Roadmap](roadmap.md)
