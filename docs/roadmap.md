# Roadmap and status

Where the project stands: what is built, what comes next, what must change before production, and
the known issues. Read this before planning new work.

## Contents

- [Delivery status](#delivery-status)
- [Next up](#next-up)
- [Planned later](#planned-later)
- [Before production](#before-production)
- [Known issues](#known-issues)
- [Defined but not yet used](#defined-but-not-yet-used)

## Delivery status

The UI phase is complete for the guest app, the staff app, the kitchen and Settings. Everything
runs against the in-browser mock server, which implements the backend contract.

| Area                  | Status      | Documentation                                  |
| --------------------- | ----------- | ---------------------------------------------- |
| Guest app             | Done        | [guest-app.md](guest-app.md)                   |
| Staff app (waiter)    | Done        | [staff-app.md](staff-app.md)                   |
| Kitchen workspace     | Done        | [staff-app.md](staff-app.md#kitchen-workspace) |
| Settings              | Done        | [settings.md](settings.md)                     |
| Master values         | Done        | [masters-and-config.md](masters-and-config.md) |
| Reports               | Not started | [Next up](#next-up)                            |
| Admin dashboard       | Deferred    | [Planned later](#planned-later)                |
| Roles and permissions | Deferred    | [Planned later](#planned-later)                |
| Real backend          | Not started | [Before production](#before-production)        |

Delivery history, by phase:

- **1–5:** tooling and design system; menu, search, food detail; cart and checkout; tracking, My
  orders, Help; restaurant states (closed, paused, offline), responsive and accessibility pass.
- **G1–G4:** branches and regions (per-branch currency, tax, phone and payment rules); the
  backend-ready API layer and mock server; order modes (dine-in, takeaway, delivery); running
  orders with rounds and the change / cancel window; promotions (promo codes, happy hour).
- **A1–A14:** staff sign-in and branch picker, the admin shell, floor plan and table pages, waiter
  ordering, Requests, Orders, Menu and the dish editor, branch status (pause / close), QR codes,
  Reservations, Payments, Settings › Floor plan and out-of-service tables.
- **K1–K2:** the kitchen workspace: ticket board, activity, stock.
- **S1–S2:** Settings: branch details and region, opening hours, tax and service charge, payment
  methods, services, delivery zones, pickup, branches.
- **Masters:** centralised master values in `src/config/masters`.

## Next up

### Reports

The only feature still required in the current phase. Today the Payments page and the kitchen's
Activity page cover **today only**. Reports will add history for managers. The expected scope, to
be confirmed before design:

- Sales over a date range: totals, by day, by order type, by payment method; taxes and refunds.
- Best-selling dishes and categories over a range.
- Comparison across branches for admins who manage several.
- Export (CSV first; the Payments page already exports today's CSV).

Each report needs a read endpoint in the backend contract (aggregation belongs on the server) and a
mock handler that aggregates the mock's orders.

## Planned later

- **Admin dashboard redesign.** The current dashboard home is the waiter home (queue, counters,
  tables). A manager-oriented dashboard will be designed separately.
- **Roles and permissions.** Today every signed-in staff account can open every staff page once
  a branch is selected (`AdminAccess`). The proposal on file: per-branch roles on the account
  (`waiter`, `kitchen`, `manager`), enforced by the server with 403 and reflected in the menus and
  landing pages. What managers may access beyond waiters is still to be decided.
- **Notifications** (sound, push) for new orders and requests: the notification types already
  exist as master values.
- **Kitchen item rejection** with reasons, and **stock by unit of measurement**: master values
  exist, features do not.

## Before production

This is a front-end with a mock backend. Replace these before real guests use it:

| Mock today                                  | Replace with                                        |
| ------------------------------------------- | --------------------------------------------------- |
| The mock server in `src/api/mock`           | The real API behind `src/api/contracts.ts`          |
| OTP is always `123456`                      | An SMS OTP service with server-side rate limiting   |
| Payments via the mock `…/simulate` endpoint | The payment partner's checkout, webhooks            |
| Order ids numbered per device               | Globally unique ids from the order API              |
| The mock kitchen moves orders on by time    | Live status from the kitchen (polling, SSE or WS)   |
| `?table=` trusted; `&qr=` token not checked | Signed, expiring table tokens checked by the server |
| Demo staff account in `demoAdmin.ts`        | Real staff accounts and authentication              |
| Placeholders in `branches.json`             | Real phone, address and payment partner details     |
| `?status=` preview parameter                | Remove, or restrict to staff                        |

Switching the app to a real backend is a build-time change; see
[data-and-api.md](data-and-api.md#switching-to-a-real-backend). Hosting requirements (security
headers, caching) are in the root [README](../README.md#deploying).

## Known issues

- **Stale end-to-end tests (16).** The default branch `blr-indiranagar` was renamed in the data to
  "Udyog Vihar", Gurgaon (commit `4a4499a`), but several specs and the `adminSignIn` helper in
  `tests/e2e/helpers.ts` still look for "Indiranagar" / "Bengaluru". Affected: admin branch status,
  floor plan, branch picker and order modes specs. Fix: update the expected names.
- **One failing unit test.** `tests/unit/reservations.test.ts` › "offers three days in the branch
  calendar…" expects three bookable days late at night and gets two. It predates Settings.
- **Contract comments lag the mock in places.** The JSDoc in `src/api/contracts.ts` does not list
  every error the mock returns: `POST /otp` (400 `invalid_request`, 409 `otp_not_sent`),
  `POST /sessions` (422 `area_not_served`, 409 `table_disabled`), and `ordering_unavailable` /
  `table_disabled` / `item_unavailable` on order, round, change and payment endpoints.
  [api-contract.md](api-contract.md) documents what the mock actually enforces. `GET /payments/:id`
  is referred to as the real replacement for `…/simulate` but is not specified yet.
- **Branch id vs name.** `blr-indiranagar` is still the id of the Gurgaon branch. Ids are permanent
  keys (stored orders, sessions); only the display name changed. Do not rename the id.

## Defined but not yet used

Kept in `src/config/masters` so features can adopt them without new lists:

- Rejection reasons, units of measurement and notification types (no feature uses them yet).
- Tax types with effective dates: a catalogue. Bills use each branch's own tax settings; the
  effective dates are placeholders (`2024-04-01`).
- Reservation status has no "Arrived" step: bookings go from `booked` straight to `seated`.

## Related

- [Documentation index](README.md)
- [Architecture](architecture.md)
- [Data and API](data-and-api.md)
- [API contract](api-contract.md)
- [Masters and configuration](masters-and-config.md)
- [Testing](testing.md)
