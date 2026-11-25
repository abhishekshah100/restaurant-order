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

The guest app, the staff app, the kitchen and Settings are built, and the app runs against
`restaurant-backend`: every server-owned endpoint is in
[`src/api/backend.ts`](../src/api/backend.ts). A build without `NEXT_PUBLIC_BACKEND_URL` still
runs on the in-browser mock server, but only for the guest and floor screens (see
[Known issues](#known-issues)). Production runs on Vercel (web), Render (API), Neon (PostgreSQL)
and Upstash (Redis).

| Area                      | Status      | Documentation                                                                 |
| ------------------------- | ----------- | ----------------------------------------------------------------------------- |
| Guest app                 | Done        | [guest-app.md](guest-app.md)                                                  |
| Staff app (waiter)        | Done        | [staff-app.md](staff-app.md)                                                  |
| Kitchen workspace         | Done        | [staff-app.md](staff-app.md#kitchen-workspace)                                |
| Settings                  | Done        | [settings.md](settings.md)                                                    |
| Master values             | Done        | [masters-and-config.md](masters-and-config.md)                                |
| Roles and permissions     | Done        | [settings.md](settings.md#staff--roles)                                       |
| Cash register             | Done        | [staff-app.md](staff-app.md#cash-register)                                    |
| Refunds and cancellations | Done        | [staff-app.md](staff-app.md#refunds--cancellations)                           |
| Shifts and attendance     | Done        | [staff-app.md](staff-app.md#shifts--attendance)                               |
| Inventory                 | Done        | [staff-app.md](staff-app.md#inventory)                                        |
| Purchasing                | Done        | [staff-app.md](staff-app.md#purchasing)                                       |
| Tax invoices (GST / VAT)  | Done        | [staff-app.md](staff-app.md#payments)                                         |
| Audit log                 | Done        | [staff-app.md](staff-app.md#audit-log)                                        |
| Sales report              | Done        | [staff-app.md](staff-app.md#sales-report)                                     |
| Other reports             | Not started | [Next up](#next-up)                                                           |
| Manager home              | Deferred    | [Planned later](#planned-later)                                               |
| Real backend              | Connected   | [data-and-api.md](data-and-api.md#connecting-restaurant-backend-area-by-area) |
| Live updates (SSE)        | Done        | [staff-app.md](staff-app.md#live-updates-and-polling)                         |
| Order history by date     | Done        | [staff-app.md](staff-app.md#orders)                                           |
| Kitchen hold and fire     | Planned     | [Planned later](#planned-later)                                               |
| Payment gateway, SMS OTP  | Not started | [Before production](#before-production)                                       |

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
  and 31 long); a table's Order history; Payments, Requests and Reservations history.
- **India and Nepal billing:** per-branch order numbers (`UDY-001`, prefix and start in Settings ›
  Branch details) and a daily token; the tax switch with GSTIN / PAN (with tax off the bill is a
  "Bill of supply" in India, a "Bill" in Nepal); every charge listed on the cart and checkout bill;
  redesigned printed bill; compact toasts and add-to-cart feedback in the cart bar. An open bill
  keeps the tax rate it started with when Settings › Tax changes.
- **Kitchen phases 1–3:** Phase 1 (device only): Screen settings (station per screen, text size,
  chime, waiting reminder, wake lock, auto-print), light / dark theme, allergy flag, large ticket,
  KOT print, keyboard and bump bar, connection status. Phase 2: live updates over SSE, undo and
  recall (`back`), plated ticks shared by every screen. Phase 3: rush orders, kitchen → waiter
  messages, prep time per dish (a ticket is due when its slowest dish is done).
- **Roles and split payments (2026-11-03):** per-branch roles with permissions, enforced by the
  server (403) and reflected in the menu and landing page (`src/lib/adminNav.ts`); built-in roles
  plus the restaurant's own in Settings › Staff & roles; a bill paid in several parts.
- **Cash register (2026-11-03):** one drawer per branch, opened with a float; pay in / out; cash
  payments blocked while it is closed; blind close (expected shown after the count) with a reason
  for any difference; card and UPI totals checked at close; Day end sign-off (`cash.review`) and
  reports by staff. Refunds & cancellations page, with separate `orders.cancel` and
  `refunds.give` permissions.
- **Reservations (2026-11-03):** auto no-show after the branch's grace period (staff can undo);
  deposits recorded by staff, deducted from the bill, refunded or kept by the branch's rule;
  one-tap WhatsApp / SMS reminders.
- **Inventory (2026-11-04 to 11-13):** ingredients and units, stock and the ledger, adjustments,
  wastage, low-stock alerts; recipes and food cost %, stock used when cooking starts, automatic
  sold-out (stock may go negative); counts, usage, transfers between branches, batches and expiry;
  a dashboard with stock value; price-change alerts. An on / off switch per restaurant in
  Settings › Modules (super admins only).
- **Guest and floor extras (2026-11-10 to 11-11):** search and cart suggestions; Settings › Help
  page (Wi-Fi QR, FAQs, social links including TikTok); waiter home redesign; floor alerts (chime,
  vibration, toast).
- **Shifts and attendance (2026-11-12):** the rota, clock in / out from the home page,
  attendance, time off and swap requests.
- **Security (2026-11-12):** a Content-Security-Policy added after the build; staff screens sign
  out after 30 minutes idle (not the kitchen); sign-ins in use are renewed. All refreshes go
  through `src/api/refreshAfter.ts`.
- **Purchasing P1–P4 (2026-11-17):** a Today tab with what needs doing; orders as cards, sent on
  WhatsApp or printed; receiving from the order as a checklist with the invoice photo;
  deliveries, returns and suppliers; approval off by default.
- **POS compliance (2026-11-17 to 11-18):** audit log and its screen (`audit.view`); GST (India)
  and VAT (Nepal) tax invoices, business buyer details, reprint copies, credit notes, Payments ›
  Invoices and the sales register CSV; fiscal years (India April–March, Nepal Shrawan–Asar);
  manual staff discounts with a limit per role; moving guests to a free table.
- **Kitchen K1–K2 (2026-11-17):** equal fixed lanes; a device-kept queue for taps made offline;
  "My dishes done" on a station screen and a Pass view of every station's progress. The kitchen
  screen keeps the device awake and its sign-in renewed.
- **Table QR for waiters:** staff with `tables.qr` can show a table's QR code from the table page.
- **Clean-up and performance (2026-11-18):** dead code removed, duplicates merged, large API and
  settings files split into area folders behind their barrels; shared dish-card values
  (`DishCardProvider`) cut the menu's load work; smaller page bundles; database indexes.
- **Refunds per dish (2026-11-19):** staff refunds name the dishes (required for Complaint and
  Wrong item); credit notes list them.
- **Sales report (2026-11-19):** Sales in the sidebar (`reports.view`). Presets up to This FY and
  Last FY; headline figures against the period just before ("Showing" / "Compared with", with an
  ⓘ explanation); sales by day, week or month; busiest hours and "Through the day"; order type
  and payment method; best sellers and Sold least; categories; a money summary (tax, service
  charge, discounts, refunds by reason and by dish, "Not linked to a dish") with the Sales
  register button; all branches compared, each in its own currency; Excel (several sheets),
  one-click PDF and print.

- **Developer setup D1–D3 (2026-11-23):** the hidden `/dev-setup/` page loads a client's
  restaurant, branch, tables, staff and menu from one JSON (Claude writes it from menu photos) for
  demos on their own data: developer key (never a role), paste, Check, Import in one go, "Delete
  this restaurant's old data first", the guest and staff links and sign-ins it made, and the
  restaurants made there with Reset activity and Delete; "Start here" downloads the prompt for
  Claude and a sample JSON; the tax number and legal name come with the JSON; the staff link
  signs in under the client's name. ADR-047 in the backend.
- **New branches' QR links (2026-11-23):** a link or saved visit at a branch opened since the
  site was built waits for the live branch list, instead of trying the default branch first.

- **Photos in Cloudflare R2 + proof retention + image uploads (2026-11-25):** dish and branch
  photos in a public R2 bucket, proofs in a private one (`MEDIA_STORE=r2`, ADR-048); proof photos
  deleted for good after 90 days unless the owner keeps them (Settings › Proof photos);
  every upload checked, fitted and compressed by one `prepareImage` (dish photos now 1080 px),
  and checked again by type, weight and pixel size on the server, with clear messages (5 MB at
  most); dish and branch photos nothing uses deleted after a week; `npm run photos:check` finds
  photos lost from Render's disk; a booking's deposit photos show on the booking; wastage forms
  take photos (shown in the ledger, kept like proofs); each day's proof deletions are one
  system entry in the audit log.

## Next up

The Sales report is done. In order, still to come:

- **Tax classes per dish (India).** Decided: a class on the category, with an override on the
  dish; prices entered before tax. Alcohol goes on a separate VAT bill with its own number series
  next to the GST invoice; one payment covers both. Bills, invoices, credit notes, the register
  and the Sales report split by rate.
- **Payment gateway and SMS OTP.** See [Before production](#before-production).
- **More reports:** waiter performance; kitchen performance for any period (the kitchen's
  Activity page covers today only); profit and loss, which first needs expenses to be recorded.

Each report needs a read endpoint in the backend (aggregation belongs on the server).

## Planned later

- **Manager home.** The dashboard home is still the waiter home (queue, counters, tables, my
  shift). Managers use the Sales report and the Inventory dashboard for figures.
- **Nepali (BS) dates on screen.** Invoices and fiscal years already use Bikram Sambat, and the
  Sales report shows it beside its days; date pickers and headings still show Gregorian dates.
- **Kitchen K3: hold and fire** (a waiter holds a round's courses until they fire them). The
  design is agreed; not built.
- **Inventory:** storage areas, and photos on wastage.
- **IRD / CBMS sync (Nepal).** Invoices keep room for the sync status; nothing is sent yet.
- **Push notifications** for new orders and requests. Floor staff already get a chime, vibration
  and a toast on the open device; the notification types exist as master values.
- **Kitchen item rejection** with reasons: master values exist, the feature does not.
- **Menu prices including tax:** proposed for later; today menu prices exclude tax
  (`tax.pricesIncludeTax: false`).

## Before production

The backend serves every server-owned endpoint; these remain before real guests use it:

| Today                                                       | Replace with                                                                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| OTP is a fixed code in development (`123456`)               | An SMS OTP service (the backend refuses to start in production without one)                                                  |
| Payments via `POST /payments/:id/simulate` and test buttons | A payment partner (eSewa, Khalti, Fonepay, UPI): checkout and webhooks; build with `NEXT_PUBLIC_PAYMENT_TEST_CONTROLS=false` |
| Demo login (shown while `NEXT_PUBLIC_API_MOCK` is on)       | Real staff accounts; no demo login                                                                                           |
| Placeholders in the seeded branches                         | Real phone, address and payment partner details                                                                              |
| `?status=` preview parameter                                | Remove, or restrict to staff                                                                                                 |
| `GET /restaurant`, `/help`, `/content/*` static             | Fine as static files, or served by the backend                                                                               |
| Photos (dishes, payment proofs, invoices) on Render's disk  | Object storage or a persistent disk: Render's disk is wiped on redeploy                                                      |
| Migrations run by hand on Neon (deploys don't run them)     | Run `prisma migrate status`, then `migrate deploy`, as each API release goes live                                            |

Hosting requirements (security headers, caching) are in the root
[README](../README.md#deploying).

## Known issues

- **The mock lags the backend.** A mock-only build numbers orders `A001` up without a token,
  answers today's orders only (it ignores `?from=&to=`), and has no events, plated ticks, rush
  or kitchen messages. It does not serve the newer areas at all: roles, cash register, shifts,
  inventory, purchasing, invoices, discounts, audit log and the Sales report exist only on the
  backend.
- **Branch id vs name.** `blr-indiranagar` is still the id of the Gurgaon branch. Ids are permanent
  keys (stored orders, sessions); only the display name changed. Do not rename the id.
- **Contract comments lag in places.** The JSDoc in `src/api/contracts/` does not list `POST /otp`'s
  400 `invalid_request`. `GET /payments/:id` is referred to as the real replacement for
  `…/simulate` but is not specified yet.

## Defined but not yet used

Kept in `src/config/masters` so features can adopt them without new lists:

- Rejection reasons and notification types (no feature uses them yet). Units of measurement are
  now used by Inventory.
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
