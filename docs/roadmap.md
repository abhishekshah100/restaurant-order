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

The UI phase is complete for the guest app, the staff app, the kitchen and Settings, and the app
runs against `restaurant-backend`: every server-owned endpoint is in
[`src/api/backend.ts`](../src/api/backend.ts). A build without `NEXT_PUBLIC_BACKEND_URL` still runs
on the in-browser mock server.

| Area                  | Status      | Documentation                                                                 |
| --------------------- | ----------- | ----------------------------------------------------------------------------- |
| Guest app             | Done        | [guest-app.md](guest-app.md)                                                  |
| Staff app (waiter)    | Done        | [staff-app.md](staff-app.md)                                                  |
| Kitchen workspace     | Done        | [staff-app.md](staff-app.md#kitchen-workspace)                                |
| Settings              | Done        | [settings.md](settings.md)                                                    |
| Master values         | Done        | [masters-and-config.md](masters-and-config.md)                                |
| Reports               | Not started | [Next up](#next-up)                                                           |
| Admin dashboard       | Deferred    | [Planned later](#planned-later)                                               |
| Roles and permissions | Deferred    | [Planned later](#planned-later)                                               |
| Real backend          | Connected   | [data-and-api.md](data-and-api.md#connecting-restaurant-backend-area-by-area) |
| Live updates (SSE)    | Done        | [staff-app.md](staff-app.md#live-updates-and-polling)                         |
| Order history by date | Done        | [staff-app.md](staff-app.md#orders)                                           |
| Kitchen hold and fire | Deferred    | [Planned later](#planned-later)                                               |

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
- **Backend:** every area moved to `restaurant-backend` (sign-in, branches and settings, menu,
  sessions and OTP, signed table links, pricing and promotions, orders, payments, requests,
  floor views, bookings); orders adapted to the screens' shape (`orderAdapter`). Branch API as
  data: `GET /branches` in brief, `GET /branches/:id/config` for the rules, times worded on screen.
- **History:** orders by date (Orders and Payments From / To, `?from=&to=`, up to 90 days back
  and 31 long); a table's Order history.
- **India and Nepal billing:** per-branch order numbers (`UDY-001`, prefix and start in Settings ›
  Branch details) and a daily token; the tax switch with GSTIN / PAN (with tax off the bill is a
  "Bill of supply" in India, a "Bill" in Nepal); every charge listed on the cart and checkout bill;
  redesigned printed bill; compact toasts and add-to-cart feedback in the cart bar.
- **Kitchen phases 1–3:** Phase 1 (device only): Screen settings (station per screen, text size,
  chime, waiting reminder, wake lock, auto-print), light / dark theme, allergy flag, large ticket,
  KOT print, keyboard and bump bar, connection status. Phase 2: live updates over SSE, undo and
  recall (`back`), plated ticks shared by every screen. Phase 3: rush orders, kitchen → waiter
  messages, prep time per dish (a ticket is due when its slowest dish is done).

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
- **Kitchen Phase 4: hold and fire** (courses held until the waiter fires them). Planned with
  phases 1–3, deferred.
- **Menu prices including tax:** proposed for later; today menu prices exclude tax
  (`tax.pricesIncludeTax: false`).

## Before production

The backend serves every server-owned endpoint; these remain before real guests use it:

| Today                                                 | Replace with                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------- |
| OTP is a fixed code in development (`123456`)         | An SMS OTP service (the backend refuses to start in production without one) |
| Payments via `POST /payments/:id/simulate`            | The payment partner's checkout and webhooks                                 |
| Demo login (shown while `NEXT_PUBLIC_API_MOCK` is on) | Real staff accounts; no demo login                                          |
| Placeholders in the seeded branches                   | Real phone, address and payment partner details                             |
| `?status=` preview parameter                          | Remove, or restrict to staff                                                |
| `GET /restaurant`, `/help`, `/content/*` static       | Fine as static files, or served by the backend                              |

Hosting requirements (security headers, caching) are in the root
[README](../README.md#deploying).

## Known issues

- **The mock lags the backend.** A mock-only build numbers orders `A001` up without a token,
  answers today's orders only (it ignores `?from=&to=`), and has no events, plated ticks, rush
  or kitchen messages (those routes exist only on the backend).
- **Contract comments lag the mock in places.** The JSDoc in `src/api/contracts.ts` does not list
  every error the mock returns: `POST /otp` (400 `invalid_request`, 409 `otp_not_sent`),
  `POST /sessions` (422 `area_not_served`, 409 `table_disabled`), and `ordering_unavailable` /
  `table_disabled` / `item_unavailable` on order, round, change and payment endpoints.
  [api-contract.md](api-contract.md) documents what is enforced. `GET /payments/:id` is referred
  to as the real replacement for `…/simulate` but is not specified yet.
- **Branch id vs name.** `blr-indiranagar` is still the id of the Gurgaon branch. Ids are permanent
  keys (stored orders, sessions); only the display name changed. Do not rename the id.
- **Menu page notifications.** Every dish card subscribes to the branch's queries, so the menu
  fires thousands of query notifications on load; batched by the microtask scheduler
  (`api/queryClient`), but a candidate for a refactor.

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
