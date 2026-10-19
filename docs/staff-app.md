# Staff app

The staff side of The Olive Table: sign-in, the branch picker, the admin dashboard under
`/admin/dashboard/` and the kitchen workspace under `/admin/kitchen-dashboard/`. Every page works
in one selected branch and reads server-owned data through the admin endpoints of the backend
contract, which the in-browser mock server answers until a real backend exists.

Settings (`/admin/dashboard/settings/*`) are covered separately in [settings.md](settings.md).

## Contents

- [Route index](#route-index)
- [Sign-in and branch selection](#sign-in-and-branch-selection)
- [Admin shell](#admin-shell)
- [Home](#home)
- [Tables](#tables)
- [Waiter ordering at the table](#waiter-ordering-at-the-table)
- [Requests](#requests)
- [Orders](#orders)
- [Menu](#menu)
- [Reservations](#reservations)
- [Payments](#payments)
- [QR codes](#qr-codes)
- [Kitchen workspace](#kitchen-workspace)
- [Endpoint index](#endpoint-index)
- [Related](#related)

## Route index

All routes are static pages under `src/app/admin/`. Dynamic values (table number, view, day) are
read from the query string, so new tables or days never need a new build.

| Route                                       | Page                        | Main component                     |
| ------------------------------------------- | --------------------------- | ---------------------------------- |
| `/admin/login/`                             | Staff sign-in               | `admin/AdminLogin`                 |
| `/admin/select-branch/`                     | Branch picker               | `admin/AdminSelectBranch`          |
| `/admin/dashboard/`                         | Home (waiter home)          | `admin/home/AdminHome`             |
| `/admin/dashboard/tables/`                  | Floor plan (`?floor=`)      | `admin/tables/FloorPlan`           |
| `/admin/dashboard/tables/view/?table=5`     | One table                   | `admin/tables/TableDetail`         |
| `/admin/dashboard/tables/qr/`               | QR code sheet               | `admin/tables/qr/TableQrCodes`     |
| `/admin/dashboard/requests/`                | Waiter and bill requests    | `admin/requests/RequestsBoard`     |
| `/admin/dashboard/orders/`                  | Orders (`?view=`)           | `admin/orders/OrdersBoard`         |
| `/admin/dashboard/orders/ready/`, `unpaid/` | Orders, opened on that view | `admin/orders/OrdersBoard`         |
| `/admin/dashboard/menu/`                    | Menu and availability       | `admin/menu/MenuBoard`             |
| `/admin/dashboard/reservations/`            | Reservations (`?day=`)      | `admin/reservations/...Board`      |
| `/admin/dashboard/payments/`                | Payments (`?view=`)         | `admin/payments/PaymentsBoard`     |
| `/admin/dashboard/settings/*`               | Settings                    | see [settings.md](settings.md)     |
| `/admin/kitchen-dashboard/`                 | Kitchen board               | `kitchen/board/KitchenBoard`       |
| `/admin/kitchen-dashboard/stock/`           | Kitchen stock               | `kitchen/stock/KitchenStock`       |
| `/admin/kitchen-dashboard/activity/`        | Kitchen activity            | `kitchen/activity/KitchenActivity` |

Component paths are relative to [`src/components/`](../src/components/). Link builders for these
routes (`tablePath`, `floorPath`, `ordersPath`, `paymentsPath`, `reservationsPath`,
`qrCodesPath`, `settingsPath`) live in [`src/lib/adminNav.ts`](../src/lib/adminNav.ts); fixed
entry points (`ADMIN_PATHS`) are in [`src/lib/adminBranches.ts`](../src/lib/adminBranches.ts).
Page titles come from `adminMetadata.ts` and `kitchenMetadata.ts` beside the route layouts.

## Sign-in and branch selection

### Sign-in

- **Route:** `/admin/login/`, component
  [`AdminLogin`](../src/components/admin/AdminLogin.tsx); form schema in
  [`src/lib/adminLogin.ts`](../src/lib/adminLogin.ts).
- **Endpoint:** `POST /admin/sessions` with `{ identity, password }`. The identity is an email
  address or a mobile number in international form; the client checks only its shape.
- The server never says which part was wrong (401 `invalid_credentials`).
- On success the session is stored by [`src/lib/adminAuth.ts`](../src/lib/adminAuth.ts)
  (`olive.admin.session.v1` in localStorage) and the admin lands via `adminLanding`: straight on
  the dashboard when they manage one branch, otherwise on the branch picker.
- **Demo account (mock only):** [`src/api/mock/demoAdmin.ts`](../src/api/mock/demoAdmin.ts)
  defines the single account the mock signs in. It manages `blr-indiranagar` (Udyog Vihar,
  Gurgaon) and `ktm-thamel` (Thamel, Kathmandu). While the mock API is on, `useDemoAdminAccount`
  loads this module lazily and the login page offers **Use demo account**, which fills the form.
  With `NEXT_PUBLIC_API_MOCK=false` the module is never loaded.
- Mock sessions last 12 hours (`ADMIN_SESSION_HOURS` in
  [`src/api/mock/rules.ts`](../src/api/mock/rules.ts)).

### Branch picker

- **Route:** `/admin/select-branch/`, component
  [`AdminSelectBranch`](../src/components/admin/AdminSelectBranch.tsx) with `BranchGrid`,
  `BranchCard` and `AdminTopBar`.
- **Endpoint:** `GET /admin/branches`: only the branches this account manages.
- The last-used branch is listed first (`sortAdminBranches`); a search field appears from five
  branches (`BRANCH_SEARCH_MIN`, `filterAdminBranches`).
- Picking a branch stores its id (`olive.admin.branch.v1`) and opens the dashboard.

### Access guard

[`AdminAccess`](../src/components/admin/AdminAccess.tsx) wraps every staff page. It computes a
decision with the pure function `adminAccess` in
[`src/lib/adminBranches.ts`](../src/lib/adminBranches.ts) and renders a fallback until the
decision is `allow`.

| Situation                                          | Decision                              |
| -------------------------------------------------- | ------------------------------------- |
| Signed out, or `GET /admin/branches` answered 401  | Sign out, redirect to `/admin/login/` |
| Branch picker, admin manages exactly one branch    | Select it, redirect to the dashboard  |
| Dashboard or kitchen, selected branch is managed   | Allow                                 |
| Dashboard or kitchen, one branch, none selected    | Select it and stay                    |
| Dashboard or kitchen, several branches, none valid | Redirect to the branch picker         |
| Branch list failed (not 401), a branch is selected | Allow (keep working)                  |

`adminPage` treats both `/admin/dashboard/` and `/admin/kitchen-dashboard/` as branch workspaces,
so they are guarded the same way. Access is gated by sign-in and branch only; staff roles are not
implemented yet, so any signed-in account can open every page, including the kitchen.

## Admin shell

Every `/admin/dashboard/` route renders inside
[`AdminShell`](../src/components/admin/shell/AdminShell.tsx), mounted once by
[`src/app/admin/dashboard/layout.tsx`](../src/app/admin/dashboard/layout.tsx) so it persists
across page changes.

### Structure

- `WorkspaceGate` = `AdminAccess` + `Workspace`. It is shared with the kitchen shell.
- `Workspace` resolves the selected branch from `GET /admin/branches` and its region rules from
  `GET /branches`, then provides `AdminWorkspace`. During a failed refresh of the admin's
  branches, the `GET /branches` entry stands in.
- `ShellFrame` renders the navigation, the header and the page:
  - [`Sidebar`](../src/components/admin/shell/Sidebar.tsx) from 1024px, with every nav item,
    the branch status control, switch branch and sign out.
  - [`ShellHeader`](../src/components/admin/shell/ShellHeader.tsx): on phones the brand mark,
    branch name, status control, a Menu shortcut and the avatar (opens More); from 1024px the page
    title, the Menu shortcut, the status control and the branch's local time.
  - [`MobileNav`](../src/components/admin/shell/MobileNav.tsx): the bottom tab bar below 1024px
    and its More sheet.
- [`useShellActions`](../src/components/admin/shell/useShellActions.ts): sign out (back to the
  login page) and switch branch (the picker).

### Navigation

One list, `ADMIN_NAV` in [`src/lib/adminNav.ts`](../src/lib/adminNav.ts), drives both layouts.
`activeNavId` maps a pathname to its item (sub-pages such as `orders/ready/` count as Orders).

| Item         | Mobile tab bar | Badge                               |
| ------------ | -------------- | ----------------------------------- |
| Home         | Yes            |                                     |
| Tables       | Yes            |                                     |
| Orders       | Yes            | `counts.readyToServe`               |
| Requests     | Yes            | `counts.waiterCalls + billRequests` |
| Reservations | More           |                                     |
| Kitchen      | More           | (links to the kitchen workspace)    |
| Menu         | More           |                                     |
| Payments     | More           |                                     |
| Settings     | More           |                                     |

Badge counts come from `GET /admin/branches/:branchId/service`.

### AdminWorkspace context

[`AdminWorkspace.tsx`](../src/components/admin/shell/AdminWorkspace.tsx) exposes
`useAdminWorkspace()` to every page inside the shell (it throws outside it):

- `branch`: the selected branch as `GET /admin/branches` reports it (id, names, city, `status`,
  `statusUntil`, time zone, locale).
- `region`: the full `Branch` from `GET /branches` (currency, taxes, tables, modes).
- `money` and `clock`: formatters built from the region (`createMoney`, `createClock`). Pages use
  these for every amount and time, never hard-coded formats.
- `canSwitch`: the admin manages more than one branch.

### Branch status control

[`BranchStatusControl`](../src/components/admin/shell/BranchStatusControl.tsx) shows the branch
status as a button in the sidebar, the header and the kitchen bar. It opens a "Taking orders?"
dialog.

- **Open:** take orders normally.
- **Pause:** stop new guest orders for 15, 30, 45, 60 or 90 minutes; it ends by itself.
- **Closed:** closed for the rest of today; it opens again at the next day's opening time.
- **Endpoint:** `PATCH /admin/branches/:branchId/status`. The response carries `statusUntil`.
- `useSetBranchStatus` invalidates the admin branch list and `GET /branches`. Guests poll
  `GET /branches` every 60 s, so they see the change within a minute.
- While paused or closed, guest orders, rounds and payments for new food are refused with 409
  `ordering_unavailable`. Waiters can still take orders at the table.
- Mock: the change is stored in `olive.mock.branchStatus.v1` and applied over the branch data by
  [`src/api/mock/branchStatus.ts`](../src/api/mock/branchStatus.ts).

### Polling

Floor data is polled, not pushed. The query options live in
[`src/api/queries.ts`](../src/api/queries.ts).

- Service, floor plan, table, orders and reservations: every 15 s
  (`BRANCH_SERVICE_REFRESH_MS`) and on window focus. Their query keys share the prefix
  `['admin', 'service', ...]`, so a mutation that refreshes the service refreshes all of them.
- Settings and floor layout: stale after 60 s, no polling. QR codes: stale after 10 minutes.
- Relative ages on screen ("3 min ago") re-render on their own timer (`useNow`, 20–30 s).

## Home

The waiter home: what needs a person now, in one place. The page is factual about the current
build; a redesign is planned (see [roadmap.md](roadmap.md)).

- **Route:** `/admin/dashboard/`.
- **Components:** [`src/components/admin/home/`](../src/components/admin/home/): `AdminHome`,
  `HomeGreeting`, `ServiceCounters`, `ServiceQueue`, `QueueItemRow`, `TablesGlance`,
  `useQueueActions`.
- **Logic:** [`src/lib/adminService.ts`](../src/lib/adminService.ts) (`serviceQueue`, optimistic
  updates `withoutRequest`, `withAcknowledged`, `withoutReadyRound`, `dayPeriod` for the
  greeting).
- **Endpoints:** `GET /admin/branches/:branchId/service`;
  `POST /admin/service-requests/:id/resolve`;
  `POST /admin/orders/:id/served`.

Behaviour:

- Four counters (waiter calls, bill requests, ready to serve, unpaid) each link to their page.
- One queue, oldest first, merges waiter calls, bill requests and rounds ready to serve. Each row
  has one action: Done for a request, Mark served (or Handed over for takeaway) for food.
- Actions are optimistic: the item leaves the queue at once and returns with an error toast if
  the server refuses.
- A row's age turns amber and then red as it waits.
- Tables glance: every table with activity today and its current state.
- "Today" is the branch's day in its own time zone.

## Tables

### Floor plan

- **Route:** `/admin/dashboard/tables/`; `?floor=<areaId>` keeps the open area.
- **Components:** [`src/components/admin/tables/`](../src/components/admin/tables/): `FloorPlan`,
  `FloorTabs`, `FloorLegendBar`, `TableCard`. Logic in
  [`src/lib/adminTables.ts`](../src/lib/adminTables.ts).
- **Endpoint:** `GET /admin/branches/:branchId/tables`.

Behaviour:

- One tab per area; with a single area there are no tabs. Each tab shows how many tables are
  free and a red bell count for tables needing a waiter or the bill.
- The legend counts the open area's tables by group: available, reserved, occupied (seated,
  ordering and eating combined), needs waiter, wants bill, and out of service (shown only when
  there are any).
- A table card shows its number, seats and state. Reserved tables show for whom, when and the
  party size (or how late they are); taken tables show orders, amount due and time seated.
- Links to Reservations and QR codes sit beside the tabs.

Table status rules (server side):

- An order stays open until it is both served and paid.
- A table with no open order and no open request is `available`, or `reserved` from 60 minutes
  before a booking until 30 minutes after it (`HOLD_BEFORE_MINUTES`, `HOLD_AFTER_MINUTES` in
  [`src/lib/reservations.ts`](../src/lib/reservations.ts)), or `seated` once staff seat a booking.
- Otherwise the most urgent state wins: `needsWaiter`, `wantsBill`, `ordering`, `eating`.

### Table page

- **Route:** `/admin/dashboard/tables/view/?table=5` (build links with `tablePath`). One static
  page reads the number, so tables added in Settings open without a rebuild.
- **Component:** [`TableDetail`](../src/components/admin/tables/TableDetail.tsx) with
  `TableOrderCard`, `TableRequests`, `TableBookings`, `TableCollectDialog`, `FreeTableDialog`,
  and `qr/TableQrDialog`.
- **Endpoint:** `GET /admin/branches/:branchId/tables/:table` (404 when no area has the table).

The page shows the area, seats and state; open orders (newest first), still to pay and time
seated; today's bookings with Seat; open requests with Done. Actions:

- **Take order / New order** opens the order pad (a new order is a separate bill).
- **Add items**, **Change** and **Collect** on each order card (see
  [Waiter ordering](#waiter-ordering-at-the-table)).
- **Collect from the whole table** (`TableCollectDialog`): pays every order at the table with
  something due, at any point of the meal (`POST .../tables/:table/payment`).
- **Reserve** opens the booking form for this table.
- **QR code** shows the table's printable card.

### Free table

- Shown when the table is neither available, reserved nor out of service.
- [`FreeTableDialog`](../src/components/admin/tables/FreeTableDialog.tsx) states what is still
  unpaid (it stays on the Orders page) and calls `POST .../tables/:table/free`.
- The table becomes available; earlier orders and requests are left out of its state. The flag
  clears with the next order or request there. The mock stores a freed timestamp per table.

### Out-of-service tables

A table is taken out of service in Settings › Floor plan (`disabled: true` in the floor layout).

- It stays on the plan with its number and QR code, shown as Out of service on the Tables page and
  its own page (which links to the floor plan settings).
- Take order and Reserve are hidden on its page.
- Guest sessions, guest orders and payments, waiter orders and bookings at that table are refused
  with 409 `table_disabled` ([`src/api/mock/tableService.ts`](../src/api/mock/tableService.ts),
  `assertTableInService`). Takeaway still works for guests who scan it.
- It cannot be taken out of service while it has an open bill today or a booking still to come
  (409 `table_in_use` on `PATCH .../floors`).

## Waiter ordering at the table

For guests who do not order on their phone.

- **Component:** [`src/components/admin/orderPad/`](../src/components/admin/orderPad/):
  `OrderPad` (menu → choose → review), `PadMenu`, `PadChoose`, `PadReview`. Logic in
  [`src/lib/orderPad.ts`](../src/lib/orderPad.ts).
- **Opened from:** the table page and the order dialog on the Orders page.

| Pad target | Endpoint                                                   | Result                              |
| ---------- | ---------------------------------------------------------- | ----------------------------------- |
| New order  | `POST /admin/branches/:branchId/tables/:table/orders`      | New dine-in order, own bill         |
| Add items  | `POST /admin/branches/:branchId/orders/:id/rounds`         | New round on that order's bill      |
| Change     | `PATCH /admin/branches/:branchId/orders/:id/rounds/:round` | Round items replaced, tab re-priced |

Rules:

- The pad's menu has search, category chips and one-tap add for dishes without choices; dishes
  with sizes or choice groups open `PadChoose` with defaults pre-selected.
- The review collects the guest name (new orders), quantities and a kitchen note.
- New orders are dine-in, paid at the counter, without a guest session; the timeline records
  "Taken by <name>". Prices use the offers active now and the branch's taxes.
- A round can be changed only while the kitchen has not finished it (received or preparing;
  `editableRound` in [`src/lib/adminOrders.ts`](../src/lib/adminOrders.ts)). Anything paid beyond
  the new total is refunded. To remove everything, cancel the order instead.
- Sold-out dishes are refused (422 `item_unavailable`); a disabled dine-in mode gives 409
  `mode_unavailable`; an out-of-service table gives 409 `table_disabled`.

## Requests

- **Route:** `/admin/dashboard/requests/`.
- **Components:** [`src/components/admin/requests/`](../src/components/admin/requests/):
  `RequestsBoard`, `RequestCard`, `useRequestText`. Logic in
  [`src/lib/adminRequests.ts`](../src/lib/adminRequests.ts).
- **Endpoints:** `GET /admin/branches/:branchId/service`;
  `POST /admin/service-requests/:id/acknowledge`; `POST /admin/service-requests/:id/resolve`.

Behaviour:

- Filter by kind: all, waiter, bill (with counts).
- **Waiting** (oldest first) offers On my way and Done; **On the way** shows who has it, with Done;
  **Done** lists requests resolved in the last 30 minutes with who handled them and how fast.
- On my way records `acknowledgedBy`; the first person to claim it stays. The guest's waiter and
  bill screens show who is coming (they poll their requests every 15 s).
- Done is idempotent; the request leaves the guest's pending list.

## Orders

- **Routes:** `/admin/dashboard/orders/` with `?view=`; `orders/ready/` and `orders/unpaid/`
  open on those views (the home counters link there).
- **Components:** [`src/components/admin/orders/`](../src/components/admin/orders/):
  `OrdersBoard`, `OrderListItem`, `OrderDetailDialog`, `OrderSummary`, `OrderActionViews`
  (`CollectPaymentView`, `CancelOrderView`), `PaymentBadge`. Logic in
  [`src/lib/adminOrders.ts`](../src/lib/adminOrders.ts).
- **Endpoints:** `GET /admin/branches/:branchId/orders` (today's orders in the branch's time zone,
  newest first); `POST /admin/orders/:id/served`; `POST .../orders/:id/payment`;
  `POST .../orders/:id/cancel`; plus the order pad endpoints.

Status views (`ORDER_VIEWS`, selected by `?view=`):

| View        | Contains                          |
| ----------- | --------------------------------- |
| `active`    | Orders not finished (the default) |
| `ready`     | Status `ready`                    |
| `unpaid`    | Not cancelled, amount due > 0     |
| `completed` | Finished and not cancelled        |
| `cancelled` | Cancelled                         |
| `all`       | Everything today                  |

Behaviour:

- Today's totals (orders, sales, still to collect), a mode filter (dine-in, takeaway, delivery)
  and search by order number, guest name or table.
- Each row shows its one next action (`nextAction`): Mark served, Handed over (takeaway) or
  Collect (finished with money due).
- The order dialog offers Mark served, Collect payment, Add items and Change (dine-in), and
  Cancel while the order is not finished.
- **Collect payment in person:** `method` from the branch's `payments.atTable`; optional
  `amount` (part of what is due) and `tip`. Recorded in `payment.transactions` with who took it.
- **Cancel with a reason:** one of `outOfStock`, `guestLeft`, `kitchenIssue`, `duplicate`,
  `other` (`CANCELLATION_REASONS` in `src/config/masters/orders.ts`). Every open round is
  cancelled with `cancelledBy: 'restaurant'`; anything already paid starts a refund; the guest's
  order page shows the reason. Refused with 409 `order_closed` once served, picked up, delivered
  or cancelled.

## Menu

- **Route:** `/admin/dashboard/menu/` (also a shortcut in the shell header on every page).
- **Components:** [`src/components/admin/menu/`](../src/components/admin/menu/): `MenuBoard`,
  `MenuDishRow`, `AvailabilityDialog`, `CategoriesDialog`, `DishEditor`, `Switch`, and the editor
  sections in [`menu/editor/`](../src/components/admin/menu/editor/). Logic in
  [`src/lib/adminMenu.ts`](../src/lib/adminMenu.ts).
- **Endpoints:** `GET /branches/:id/menu`; under `/admin/branches/:branchId/menu/`:
  `PATCH dishes/:slug/availability`, `POST dishes`, `PATCH dishes/:slug`, `DELETE dishes/:slug`,
  `PATCH categories/:categoryId/order`, `PATCH categories`, `POST images`.

### Availability

- Filter by state (all, available, sold out, off today) with counts; search; pick a category.
- The switch takes a dish off or puts it back at once. Off means one of: sold out, sold out until
  a time (guests read "Back 8:30 PM"; it returns by itself at `until`), or off today (returns the
  next branch day).
- Dishes with sizes can have individual sizes switched off.
- Guests see changes within a minute (menu refetch interval 60 s). Orders containing an
  unavailable dish or size are refused.

### Dish editor

`DishEditor` adds or edits a dish in folding sections; a section with a problem opens itself on
save.

- Basics and picture (resized in the browser to 640 px, then uploaded via `POST .../images`).
- Price, or two or more sizes with names, prices and on/off.
- Choice groups (a meal's slots, a spice level): two or more choices, the first is the default,
  optionally limited to some sizes.
- Add-ons (free or priced, per size), leave-outs and quick kitchen notes.
- Details: highlights, spice, prep time, serves, allergens, meal contents.
- Availability. An existing dish can be removed (it also leaves curated lists).

### Order and categories

- With a category selected, Reorder moves its dishes; `PATCH .../categories/:categoryId/order`
  takes exactly the category's slugs.
- Categories renames and reorders categories. Adding a category is not supported in the static
  build (guest category pages are generated at build time).

## Reservations

- **Route:** `/admin/dashboard/reservations/` with `?day=YYYY-MM-DD` (today by default).
- **Components:** [`src/components/admin/reservations/`](../src/components/admin/reservations/):
  `ReservationsBoard`, `DayStrip`, `DayCalendar`, `ReservationRow`, `ReservationDialog`,
  `ReservationEditor`, `TablePicker`, `useReservationStatus`, `useReservationText`. Rules in
  [`src/lib/reservations.ts`](../src/lib/reservations.ts), shared with the mock server.
- **Endpoints:** `GET`, `POST /admin/branches/:branchId/reservations`;
  `PATCH .../reservations/:id`; `PATCH .../reservations/:id/status`.

Behaviour:

- Day tiles for today and tomorrow, plus a calendar for any day up to 60 days ahead
  (`MAX_DAYS_AHEAD`). The day is summarised (bookings, guests, seated, next arrival).
- Filters: upcoming, seated, closed (cancelled and no-show), all; plus search.
- The booking form takes guest name, mobile, party size (1–20), day, time (15-minute steps),
  duration (60, 90, 120, 150 or 180 minutes; default 90) and a note (≤ 200 chars).
- `TablePicker` blocks tables already booked at that time, fades tables that are too small (still
  allowed) and marks the smallest free table that fits as Best fit.
- Overlapping a booked or seated booking returns 409 `table_taken` with the clashing booking.
  Back-to-back bookings are fine.
- Status changes: seat (booked, from an hour before), no-show (booked, after its time), cancel
  (booked), restore (from cancelled or no-show). Seating makes the table `seated` on the plan.
- Mock: bookings are stored in `olive.mock.reservations.v1`; under `npm run dev` a branch starts
  with sample bookings ([`src/api/mock/demoReservations.ts`](../src/api/mock/demoReservations.ts)).

## Payments

- **Route:** `/admin/dashboard/payments/` with `?view=transactions` or `?view=refunds` (To collect
  is the default).
- **Components:** [`src/components/admin/payments/`](../src/components/admin/payments/):
  `PaymentsBoard`, `TakingsSummary`, `MethodBreakdown`, `DueCard`, `LedgerRow`, `CollectDialog`,
  `RefundDialog`, `PaymentOrderDialog`, `PaymentPrint`, `PaymentFields`. Logic in
  [`src/lib/adminPayments.ts`](../src/lib/adminPayments.ts), whose ledger and refund rules the
  mock server also uses.
- **Endpoints:** `GET /admin/branches/:branchId/orders` and the service's bill requests;
  `POST .../orders/:id/payment`; `POST .../tables/:table/payment`; `POST .../orders/:id/refund`.

Sections:

- **Takings:** net (collected less refunded), online vs in person, to collect, tips, average bill,
  refunds. Then a breakdown by method with the cash expected in the drawer.
- **To collect:** open bills grouped by table (bill requests first) or by takeaway/delivery order.
  `CollectDialog` supports the full bill, an even split (one share at a time), or another amount;
  the method, a tip, and for cash the amount handed over and change due.
- **Transactions:** every payment and refund, filterable by channel and method, searchable.
- **Refunds:** in full or in part, up to what is paid and not yet refunded (`refundable`), with a
  reason (`complaint`, `wrongItem`, `overcharged`, `goodwill`, `other`) and an optional note
  (≤ 200 chars). Online payments refund through the payment partner (`started`); in-person
  refunds are cash from the drawer (`done`). 409 `nothing_to_refund` when nothing is refundable.
- **Printing:** bills, receipts and the day report via `usePaymentPrint`.
- **CSV export:** the ledger as CSV (`ledgerCsv`), one row per payment or refund.

## QR codes

- **Route:** `/admin/dashboard/tables/qr/`; one table's card is also available from its page.
- **Components:** [`src/components/admin/tables/qr/`](../src/components/admin/tables/qr/):
  `TableQrCodes`, `QrCard`, `PrintSheet`, `TableQrDialog`, `useQrDownload`, `useOrigin`. Link
  logic in [`src/lib/tableQr.ts`](../src/lib/tableQr.ts).
- **Endpoint:** `GET /admin/branches/:branchId/tables/qr-codes`.

Behaviour:

- Cards by area; select some or all and print on A4, two cards across. Each card shows the
  restaurant, the table number, the QR code (SVG), "Scan to order & pay", and area and branch.
- Download one code as a PNG (`table-5-qr.png`).
- The server returns a relative `path` (`/?branch=<id>&table=<n>&qr=<token>`); the page prefixes
  the site's own origin, so codes printed from the live site open it.
- The mock token (`t<n>.<hash>`, `mockQrToken`) is deterministic and unsigned. A real backend
  signs it and can invalidate printed codes by issuing a new one.

## Kitchen workspace

A separate full-width workspace for the kitchen display, using the same staff sign-in and
selected branch as the admin dashboard.

- **Routes:** `/admin/kitchen-dashboard/` (board), `stock/`, `activity/`; navigation in
  [`src/lib/kitchenNav.ts`](../src/lib/kitchenNav.ts).
- **Shell:** [`KitchenShell`](../src/components/kitchen/shell/KitchenShell.tsx) wraps the pages in
  `WorkspaceGate` (same guard and `AdminWorkspace` as the admin shell), then
  [`KitchenBar`](../src/components/kitchen/shell/KitchenBar.tsx): brand, branch and its status
  control (so the kitchen can pause ordering), the kitchen pages, a link back to the admin
  dashboard, local time, full screen (`useFullscreen`) and the account menu.
- **Data:** no kitchen data of its own.
  [`useKitchenTickets`](../src/components/kitchen/useKitchenTickets.ts) reads
  `GET /admin/branches/:branchId/orders` (polled every 15 s, the same read as the Orders page) and
  the branch menu for stations (a dish's category).

### Board

- **Component:** [`src/components/kitchen/board/`](../src/components/kitchen/board/):
  `KitchenBoard`, `TicketCard`, `TicketItem`, `TicketTimer`, `BoardStats`, `AllDayList`,
  `useTicketActions`. Logic in [`src/lib/kitchenBoard.ts`](../src/lib/kitchenBoard.ts).
- **Endpoint:** `PATCH /admin/branches/:branchId/orders/:id/rounds/:round/status` with
  `{ status: 'preparing' | 'ready' }`.

Rules:

- Every round of every order today is a ticket (`kitchenTickets`); an order without rounds is one
  round. Tickets are sorted oldest first into three lanes: New, Cooking, Ready.
- Due time (`ticketDueAt`): takeaway at its pickup time; delivery within the branch's delivery
  `prepMinutes`; dine-in within `DINE_IN_TARGET_MINUTES` (18).
- Urgency (`ticketUrgency`): late in red, due soon in amber; a ready ticket waiting more than
  `READY_WAIT_MINUTES` (5) is late.
- Start cooking and Mark ready (Hand to rider for delivery) update optimistically
  (`withKitchenStep`). `ready` may skip `preparing`; steps are idempotent and keep the first
  person who marked them. Guest tracking and the waiters' Ready to serve follow.
- Filters by order type, station and search. The all-day list adds up dishes still to cook across
  New and Cooking tickets, grouped by station (shown in a panel below 1280px).
- Below 1024px one lane is shown at a time.
- Ticking an item as plated is local to that screen and never sent to the server.
- Ticket data adds optional fields only: `OrderRound.kitchen` / `Order.kitchen`
  (`{ started?, ready? }`, each `{ at, by }`) and `OrderEvent.at`.
- Mock: until marked, the mock kitchen's own timing applies (started at 2 min, ready at 18 min,
  served 4 min after ready; [`src/api/mock/kitchen.ts`](../src/api/mock/kitchen.ts)).

### Tickets

[`TicketItem`](../src/components/kitchen/board/TicketItem.tsx) renders each line as a cook reads
it, using [`src/lib/kitchenItems.ts`](../src/lib/kitchenItems.ts) (`kitchenItem`, `stockIssue`):

- Quantity, dish and size; a meal's picks one per line; other choices with their group name when
  not the default; add-ons; leave-outs highlighted; the guest's note; no prices.
- A warning when the dish has since gone off the menu (sold out, off today, or its size off).
- **Sold out** on an item takes the dish off the menu for everyone via the Menu page's
  availability endpoint and dialog.
- The ticket header shows where it goes, order and round, guest or waiter origin, a running clock,
  due time and the kitchen note.

### Activity

- **Route:** `/admin/kitchen-dashboard/activity/`.
- **Components:** [`src/components/kitchen/activity/`](../src/components/kitchen/activity/):
  `KitchenActivity`, `HourChart`, `TopDishes`, `ActivityFeed`. Logic in
  [`src/lib/kitchenActivity.ts`](../src/lib/kitchenActivity.ts).
- Today's numbers (tickets, finished, items cooked, average and longest ticket, ready on time,
  cancelled), tickets by hour in the branch's time zone, the most-ordered dishes, and a feed of
  every ticket event (received, started, ready, served, cancelled) with who marked it. The feed
  filters by event kind and searches by order, table, guest, dish or staff.

### Stock

- **Route:** `/admin/kitchen-dashboard/stock/`, component
  [`KitchenStock`](../src/components/kitchen/stock/KitchenStock.tsx).
- Every dish by station with its availability. It reuses the Menu page's dish rows and
  `AvailabilityDialog`, without editing, on `PATCH .../menu/dishes/:slug/availability`.

## Endpoint index

All admin endpoints take `Authorization: Bearer <token>` and answer 401 `unauthorized` without a
valid session and 403 `forbidden` for a branch the admin does not manage. Full request and
response shapes are in [api-contract.md](api-contract.md) and
[`src/api/contracts.ts`](../src/api/contracts.ts); mock handlers are in
[`src/api/mock/handlers/`](../src/api/mock/handlers/).

| Endpoint                                                | Used by                   | Mock handler file   |
| ------------------------------------------------------- | ------------------------- | ------------------- |
| `POST /admin/sessions`                                  | Sign-in                   | `adminSessions`     |
| `GET /admin/branches`                                   | Guard, picker, shell      | `adminSessions`     |
| `PATCH /admin/branches/:id/status`                      | Branch status control     | `adminSessions`     |
| `GET /admin/branches/:id/service`                       | Home, Requests, badges    | `adminService`      |
| `POST /admin/service-requests/:id/acknowledge`          | Requests                  | `adminService`      |
| `POST /admin/service-requests/:id/resolve`              | Home, Requests, table     | `adminService`      |
| `POST /admin/orders/:id/served`                         | Home, Orders              | `adminService`      |
| `GET /admin/branches/:id/tables`                        | Floor plan                | `adminTables`       |
| `GET /admin/branches/:id/tables/:table`                 | Table page                | `adminTables`       |
| `POST /admin/branches/:id/tables/:table/free`           | Table page                | `adminTables`       |
| `GET /admin/branches/:id/tables/qr-codes`               | QR codes                  | `adminTables`       |
| `POST /admin/branches/:id/tables/:table/orders`         | Order pad                 | `adminOrders`       |
| `POST /admin/branches/:id/tables/:table/payment`        | Table page, Payments      | `adminOrders`       |
| `GET /admin/branches/:id/orders`                        | Orders, Payments, kitchen | `adminOrders`       |
| `POST /admin/branches/:id/orders/:id/rounds`            | Order pad                 | `adminOrders`       |
| `PATCH /admin/branches/:id/orders/:id/rounds/:r`        | Order pad (change)        | `adminOrders`       |
| `POST /admin/branches/:id/orders/:id/payment`           | Orders, Payments          | `adminOrders`       |
| `POST /admin/branches/:id/orders/:id/refund`            | Payments                  | `adminOrders`       |
| `POST /admin/branches/:id/orders/:id/cancel`            | Orders                    | `adminOrders`       |
| `PATCH /admin/branches/:id/orders/:id/rounds/:r/status` | Kitchen board             | `kitchen`           |
| `GET`/`POST /admin/branches/:id/reservations`           | Reservations              | `adminReservations` |
| `PATCH /admin/branches/:id/reservations/:id[/status]`   | Reservations              | `adminReservations` |
| `/admin/branches/:id/menu/...` (seven endpoints)        | Menu, kitchen stock       | `adminMenu`         |

The settings, floor layout and branch endpoints are listed in [settings.md](settings.md).

## Related

- [README.md](README.md)
- [architecture.md](architecture.md)
- [conventions.md](conventions.md)
- [testing.md](testing.md)
- [guest-app.md](guest-app.md)
- [staff-app.md](staff-app.md)
- [settings.md](settings.md)
- [data-and-api.md](data-and-api.md)
- [api-contract.md](api-contract.md)
- [masters-and-config.md](masters-and-config.md)
- [how-to.md](how-to.md)
- [roadmap.md](roadmap.md)
