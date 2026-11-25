# Staff app

The staff side of The Olive Table: sign-in, the branch picker, the admin dashboard under
`/admin/dashboard/` and the kitchen workspace under `/admin/kitchen-dashboard/`. Every page works
in one selected branch and reads server-owned data through the admin endpoints of the backend
contract. Routes the backend serves go to it (`NEXT_PUBLIC_BACKEND_URL`); the rest are answered by
the in-browser mock server. Pages marked **backend only** (cash register, inventory, purchasing,
sales, audit log, invoices…) show a "needs the server" note in a mock-only build.

Settings (`/admin/dashboard/settings/*`) are covered separately in [settings.md](settings.md).

## Contents

- [Route index](#route-index)
- [Sign-in and branch selection](#sign-in-and-branch-selection)
- [Roles and permissions](#roles-and-permissions)
- [Admin shell](#admin-shell)
- [Home](#home)
- [Tables](#tables)
- [Waiter ordering at the table](#waiter-ordering-at-the-table)
- [Requests](#requests)
- [Orders](#orders)
- [Menu](#menu)
- [Reservations](#reservations)
- [Shifts & attendance](#shifts--attendance)
- [Payments](#payments)
- [Refunds & cancellations](#refunds--cancellations)
- [Cash register](#cash-register)
- [Sales report](#sales-report)
- [Inventory](#inventory)
- [Purchasing](#purchasing)
- [Activity log](#activity-log)
- [QR codes](#qr-codes)
- [Kitchen workspace](#kitchen-workspace)
- [Endpoint index](#endpoint-index)
- [Related](#related)

## Route index

All routes are static pages under `src/app/admin/`. Dynamic values (table number, view, days) are
read from the query string, so new tables or days never need a new build.

| Route                                       | Page                              | Main component                     |
| ------------------------------------------- | --------------------------------- | ---------------------------------- |
| `/admin/login/`                             | Staff sign-in                     | `admin/AdminLogin`                 |
| `/admin/select-branch/`                     | Branch picker                     | `admin/AdminSelectBranch`          |
| `/admin/dashboard/`                         | Home (waiter home)                | `admin/home/AdminHome`             |
| `/admin/dashboard/tables/`                  | Floor plan (`?floor=`)            | `admin/tables/FloorPlan`           |
| `/admin/dashboard/tables/view/?table=5`     | One table                         | `admin/tables/TableDetail`         |
| `/admin/dashboard/tables/history/?table=5`  | One table's past orders           | `admin/tables/TableHistory`        |
| `/admin/dashboard/tables/qr/`               | QR code sheet                     | `admin/tables/qr/TableQrCodes`     |
| `/admin/dashboard/requests/`                | Waiter and bill requests          | `admin/requests/RequestsBoard`     |
| `/admin/dashboard/requests/history/`        | Past requests                     | `admin/requests/RequestHistory`    |
| `/admin/dashboard/orders/`                  | Today's orders (`?view=`)         | `admin/orders/OrdersBoard`         |
| `/admin/dashboard/orders/ready/`, `unpaid/` | Orders, opened on that view       | `admin/orders/OrdersBoard`         |
| `/admin/dashboard/orders/history/`          | Orders on past days               | `admin/orders/OrderHistory`        |
| `/admin/dashboard/menu/`                    | Menu and availability             | `admin/menu/MenuBoard`             |
| `/admin/dashboard/reservations/`            | Reservations (`?day=`)            | `admin/reservations/...Board`      |
| `/admin/dashboard/reservations/history/`    | Past bookings                     | `admin/reservations/...History`    |
| `/admin/dashboard/team/`                    | Shifts & attendance › Rota        | `admin/team/RotaPlanner`           |
| `/admin/dashboard/team/attendance/`         | Shifts & attendance › Attendance  | `admin/team/Attendance`            |
| `/admin/dashboard/team/requests/`           | Shifts & attendance › Requests    | `admin/team/RotaRequests`          |
| `/admin/dashboard/payments/`                | Today's payments (`?view=`)       | `admin/payments/PaymentsBoard`     |
| `/admin/dashboard/payments/history/`        | Payment history                   | `admin/payments/PaymentHistory`    |
| `/admin/dashboard/payments/invoices/`       | Invoices & credit notes           | `admin/payments/InvoiceList`       |
| `/admin/dashboard/refunds/`                 | Refunds & cancellations           | `admin/refunds/RefundsPage`        |
| `/admin/dashboard/cash/`                    | Cash register                     | `admin/cash/CashRegister`          |
| `/admin/dashboard/sales/`                   | Sales report (`?from=&to=&view=`) | `admin/sales/SalesReportPage`      |
| `/admin/dashboard/inventory/`               | Inventory                         | `admin/inventory/Inventory`        |
| `/admin/dashboard/purchasing/`              | Purchasing                        | `admin/purchasing/Purchasing`      |
| `/admin/dashboard/audit/`                   | Audit log                         | `admin/audit/AuditLog`             |
| `/admin/dashboard/settings/*`               | Settings                          | see [settings.md](settings.md)     |
| `/admin/kitchen-dashboard/`                 | Kitchen board                     | `kitchen/board/KitchenBoard`       |
| `/admin/kitchen-dashboard/stock/`           | Kitchen stock                     | `kitchen/stock/KitchenStock`       |
| `/admin/kitchen-dashboard/activity/`        | Kitchen activity                  | `kitchen/activity/KitchenActivity` |

Component paths are relative to [`src/components/`](../src/components/). Link builders for these
routes (`tablePath`, `tableHistoryPath`, `floorPath`, `ordersPath`, `orderHistoryPath`,
`paymentsPath`, `paymentHistoryPath`, `salesPath`, `reservationsPath`, `reservationHistoryPath`,
`qrCodesPath`, `settingsPath`) live in [`src/lib/adminNav.ts`](../src/lib/adminNav.ts); fixed
entry points (`ADMIN_PATHS`) are in [`src/lib/adminBranches.ts`](../src/lib/adminBranches.ts).
Page titles come from `adminMetadata.ts` and `kitchenMetadata.ts` beside the route layouts. The
old `settings/rota/`, `settings/shifts/` and `team/time-sheet/` addresses only point to their new
place (`MovedTo`).

## Sign-in and branch selection

### Sign-in

- **Route:** `/admin/login/`, component
  [`AdminLogin`](../src/components/admin/AdminLogin.tsx); form schema in
  [`src/lib/adminLogin.ts`](../src/lib/adminLogin.ts).
- **Endpoint:** `POST /admin/sessions` with `{ identity, password }`. The identity is an email
  address or a mobile number in international form; the client checks only its shape.
- The server never says which part was wrong (401 `invalid_credentials`).
- A staff member signing in with a password an admin gave them (new, or reset) chooses their own,
  twice, before going on ([`NewPasswordStep`](../src/components/admin/NewPasswordStep.tsx)).
- On success the session is stored by [`src/lib/adminAuth.ts`](../src/lib/adminAuth.ts)
  (`olive.admin.session.v1` in localStorage) and the staff member lands via `adminLanding`:
  straight in their branch when they work at one, otherwise on the branch picker.
- After an idle sign-out (see [Idle sign-out](#idle-sign-out)) the sign-in page says why.
- **Demo account (mock only):** [`src/api/mock/demoAdmin.ts`](../src/api/mock/demoAdmin.ts)
  defines the single account the mock signs in. It manages `blr-indiranagar` (Udyog Vihar,
  Gurgaon) and `ktm-thamel` (Thamel, Kathmandu). While the mock API is on, `useDemoAdminAccount`
  loads this module lazily and the login page offers **Use demo account**, which fills the form.
  With `NEXT_PUBLIC_API_MOCK=false` the module is never loaded.
- Mock sessions last 12 hours (`ADMIN_SESSION_HOURS` in
  [`src/api/mock/rules.ts`](../src/api/mock/rules.ts)). Against the backend, a sign-in in use is
  renewed every 30 minutes (`SessionRenewal`, `POST /admin/sessions/current/renew`), up to a day
  after signing in.

### Branch picker

- **Route:** `/admin/select-branch/`, component
  [`AdminSelectBranch`](../src/components/admin/AdminSelectBranch.tsx) with `BranchGrid`,
  `BranchCard` and `AdminTopBar`. A card shows the branch's photo (Settings › Restaurant info),
  or its short name's first letter.
- **Endpoint:** `GET /admin/branches`: only the branches this account works at, each with the
  staff member's `permissions` there.
- The last-used branch is listed first (`sortAdminBranches`); a search field appears from five
  branches (`BRANCH_SEARCH_MIN`, `filterAdminBranches`).
- Picking a branch stores its id (`olive.admin.branch.v1`) and opens the dashboard; someone
  whose role doesn't include Home moves on to where they start (`landingFor`: the kitchen, else
  their first page).

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
so they are guarded the same way. What a signed-in staff member may open inside a branch is
decided by their role (next section).

## Roles and permissions

Staff get a role (Settings › Staff & roles, see [settings.md](settings.md#staff--roles)); a role
is a set of permissions, held per branch. `GET /admin/branches` sends the staff member's
`permissions` at each branch, and `useAdminWorkspace().can(...permissions)` is true when they hold
any of them (`canAt` in
[`AdminWorkspace.tsx`](../src/components/admin/shell/AdminWorkspace.tsx)). A branch sent without
permissions (the mock) lets everything show; the server checks every action anyway.

- **Menu items:** each `ADMIN_NAV` item names the permissions that open it (`needs`); `navFor`
  shows only those the staff member can open (table below).
- **Pages:** `pageNeeds(pathname)` gives a page's permissions (its nav item's; the QR sheet needs
  `tables.manage`). A page opened by its link without them shows
  [`NoAccess`](../src/components/admin/shell/NoAccess.tsx), with a button to where they start. Home
  that isn't theirs (a cook, say) moves on to their landing page.
- **Buttons:** screens hide what the role can't do (for example Move table needs `tables.move`,
  Collect needs `payments.collect`, Give a discount needs `discounts.give`). Prices and costs in
  inventory and purchasing show only to those who may see them.
- **Settings:** each settings page needs its own permission (see
  [settings.md](settings.md#page-index)).
- **Kitchen:** each kitchen page needs its own (`kitchenNav`: Dashboard and Activity
  `kitchen.update`, Stock `menu.availability.update`).
- **Optional modules:** when inventory is switched off for the restaurant (Settings › Modules),
  the server drops every `inventory.*` and `purchase.*` permission, so Inventory and Purchasing
  disappear.

## Admin shell

Every `/admin/dashboard/` route renders inside
[`AdminShell`](../src/components/admin/shell/AdminShell.tsx), mounted once by
[`src/app/admin/dashboard/layout.tsx`](../src/app/admin/dashboard/layout.tsx) so it persists
across page changes.

### Structure

- `WorkspaceGate` = `AdminAccess` + `Workspace` (+ `SessionRenewal`). It is shared with the
  kitchen shell.
- `Workspace` resolves the selected branch from `GET /admin/branches` and its region rules from
  `GET /branches`, then provides `AdminWorkspace`. During a failed refresh of the admin's
  branches, the `GET /branches` entry stands in.
- `ShellFrame` renders the navigation, the header and the page:
  - [`Sidebar`](../src/components/admin/shell/Sidebar.tsx) from 1024px, with every nav item the
    staff member can open, the branch status control, switch branch and sign out.
  - [`ShellHeader`](../src/components/admin/shell/ShellHeader.tsx): on phones the brand mark,
    branch name, status control, a Menu shortcut and the avatar (opens More); from 1024px the page
    title, the Menu shortcut, the status control and the branch's local time.
  - [`MobileNav`](../src/components/admin/shell/MobileNav.tsx): the bottom tab bar below 1024px
    and its More sheet (`MobileNavMore`).
- [`useShellActions`](../src/components/admin/shell/useShellActions.ts): sign out (back to the
  login page) and switch branch (the picker).

### Navigation

One list, `ADMIN_NAV` in [`src/lib/adminNav.ts`](../src/lib/adminNav.ts), drives both layouts,
in the order staff see it: grouped by the work it's for and, in each group, the most used first.
Each person sees only the pages their role opens (`navFor`).

- **Sidebar** (1024px and up): Home, then each group under a small heading (**Service**,
  **Money**, **Manage**, **Reports**; `navGroups`, empty groups left out), and Settings at the
  foot above the signed-in admin.
- **Phone** (below 1024px): the bottom bar holds the role's first four pages in that order
  (`splitTabs`: a waiter's Home, Tables, Orders, Requests; a cashier's Payments, Cash
  register…), never Settings, then More. **More** is a sheet: the admin's name and branch (status,
  Switch branch) at the top, the other pages as icon tiles under the same group headings with
  their badges, Settings, then Sign out.

`activeNavId` maps a pathname to its item (sub-pages such as `orders/history/` count as Orders).
Labels are `common › adminShell.nav.<id>` (plain words: Stock, Purchases, Activity log — also each page's title); group headings `adminShell.nav.groups.<group>`.

| Group   | Item                    | Shown with (any of)                                                          | Badge                                        |
| ------- | ----------------------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
|         | Home                    | `orders.view`                                                                |                                              |
| Service | Tables                  | `orders.view`                                                                |                                              |
| Service | Orders                  | `orders.view`                                                                | ready to serve                               |
| Service | Requests                | `orders.view`                                                                | waiter calls + bill requests + kitchen notes |
| Service | Reservations            | `reservations.manage`                                                        |                                              |
| Service | Kitchen                 | `kitchen.update` (links to the kitchen workspace)                            |                                              |
| Money   | Payments                | `payments.collect`, `reports.view`                                           |                                              |
| Money   | Cash register           | `cash.manage`, `cash.review`                                                 |                                              |
| Money   | Refunds & cancellations | `refunds.give`, `orders.cancel`, `reports.view`                              |                                              |
| Manage  | Menu                    | `menu.manage`, `menu.availability.update`                                    |                                              |
| Manage  | Stock                   | `inventory.view`, `.manage`, `.adjust`, `.wastage`, `.count`                 | low + out + expiring + expired               |
| Manage  | Purchases               | `purchase.view`, `.manage`, `.approve`, `.receive`                           |                                              |
| Manage  | Shifts & attendance     | `rota.plan`, `reports.view`, `attendance.fix`                                | time off and swaps waiting                   |
| Reports | Sales                   | `reports.view`                                                               |                                              |
| Reports | Activity log            | `audit.view`                                                                 |                                              |
|         | Settings                | `branch.settings.manage`, `tables.manage`, `branches.manage`, `staff.manage` |                                              |

Floor badge counts come from `GET /admin/branches/:branchId/service`; the stock badge from the
inventory alerts.

### AdminWorkspace context

[`AdminWorkspace.tsx`](../src/components/admin/shell/AdminWorkspace.tsx) exposes
`useAdminWorkspace()` to every page inside the shell (it throws outside it):

- `branch`: the selected branch as `GET /admin/branches` reports it (id, names, city, `status`,
  `statusUntil`, time zone, locale, `permissions`, fiscal years).
- `region`: the full `Branch` from `GET /branches` (currency, taxes, tables, modes).
- `money` and `clock`: formatters built from the region (`createMoney`, `createClock`). Pages use
  these for every amount and time, never hard-coded formats.
- `can`: whether the staff member holds any of the given permissions here.
- `canSwitch`: the admin manages more than one branch.

### Branch status control

[`BranchStatusControl`](../src/components/admin/shell/BranchStatusControl.tsx) shows the branch
status as a button in the sidebar, the header and the kitchen bar. It opens a "Taking orders?"
dialog.

- **Open:** take orders normally.
- **Pause:** stop new guest orders for 15, 30, 45, 60 or 90 minutes; it ends by itself.
- **Closed:** closed for the rest of today; it opens again at the next day's opening time.
- **Endpoint:** `PATCH /admin/branches/:branchId/status`. The response carries `statusUntil`.
- `useSetBranchStatus` invalidates the admin branch list and `GET /branches`. Guests'
  ordering pages poll `GET /branches/:branchId/status` every 60 s, so they see the change
  within a minute.
- While paused or closed, guest orders, rounds and payments for new food are refused with 409
  `ordering_unavailable`. Waiters can still take orders at the table.
- Mock: the change is stored in `olive.mock.branchStatus.v1` and applied over the branch data by
  [`src/api/mock/branchStatus.ts`](../src/api/mock/branchStatus.ts).

### Idle sign-out

Staff screens are often shared tablets, so
[`IdleSignOut`](../src/components/admin/shell/IdleSignOut.tsx), mounted by `AdminShell` only,
signs the device out after 30 minutes nobody used a staff screen (`IDLE_LIMIT_MS` in
[`src/lib/idleSignOut.ts`](../src/lib/idleSignOut.ts)). A minute before, "Still there?" offers
Stay signed in or Sign out now. Use on any staff tab of the device counts (shared through
localStorage). The kitchen display is left out on purpose: while a kitchen page is open and on
screen it counts as use every minute (`useKitchenKeepAlive`), so an admin tab beside it can't sign
the kitchen out.

### Live updates and polling

Against the backend, the staff shells (`AdminShell`, and `KitchenBar` in the kitchen) keep the
branch's events open: `useBranchEvents` in [`src/api/liveEvents.ts`](../src/api/liveEvents.ts)
reads `GET /admin/branches/:branchId/events` (Server-Sent Events) with `fetch` and the bearer
token in the `Authorization` header, never in the address. Each event names what changed and
[`src/api/refreshAfter.ts`](../src/api/refreshAfter.ts) refreshes the queries that read it (every
mutation goes through the same list); `resync` (and every reconnect) refreshes everything. A
dropped stream reconnects after 3 s, doubling to 30 s. The mock has no events, so a mock-only
build only polls.

Polling stays as the safety net. The query options live in
[`src/api/queries.ts`](../src/api/queries.ts).

**Floor alerts** (`useServiceAlerts` in `components/admin/shell/useServiceAlerts.ts`, run by
`AdminShell`): when the service board shows something new (a round ready to serve or hand over,
a waiter call, a bill request, a kitchen message), the device plays a three-note chime
(`playChime('service')`, distinct from the kitchen's), vibrates where the browser can (Android;
iPhones don't allow it) and shows a toast naming it ("Table 6 · round 2 ready to serve"). What's
already there when a page opens doesn't alert. The bell in the bar switches it per device
(`olive.staff-alerts.v1`, on by default); browsers only play sound after a tap on the page, so
until then the bell pulses.

- Service, floor plan, table, today's orders and reservations: every 15 s
  (`BRANCH_SERVICE_REFRESH_MS`) and on window focus; while the events are connected only every
  60 s (`liveRefresh`, `LIVE_REFRESH_MS` in [`src/api/liveState.ts`](../src/api/liveState.ts)).
  Past days' orders are not polled.
- Stock alerts are read again every 60 s even while live (expiry has no event).
- Settings and floor layout: stale after 60 s, no polling. QR codes: stale after 10 minutes.
- Relative ages on screen ("3 min ago") re-render on their own timer (`useNow`, 20–30 s).

## Home

The waiter home: what needs a person now, in one place, by urgency. Each part shows only to staff
allowed to use it.

- **Route:** `/admin/dashboard/`.
- **Components:** [`src/components/admin/home/`](../src/components/admin/home/): `AdminHome`,
  `HomeHeader`, `ServiceCounters`, `ServiceQueue`, `QueueItemRow`, `FloorGlance`, `ArrivingSoon`,
  `SoldOutTonight`, `MyShift`, `MyRota`, `ShiftControl`, `useQueueActions`.
- **Logic:** [`src/lib/adminService.ts`](../src/lib/adminService.ts) (`serviceQueue`, optimistic
  updates `withoutRequest`, `withAcknowledged`, `withoutReadyRound`) and
  [`src/lib/adminHome.ts`](../src/lib/adminHome.ts).
- **Endpoints:** `GET /admin/branches/:branchId/service`, `…/tables`, `…/reservations` and the
  menu; `POST /admin/service-requests/:id/resolve`; `POST /admin/orders/:id/served`.

Behaviour:

- **Header:** until when orders are taken, and quick actions (new order, new booking, sold out).
- **Counters** (waiter calls, bill requests, ready to serve, unpaid) each link to their page.
- **One queue**, oldest first, merges waiter calls, bill requests, the kitchen's messages and
  rounds ready to serve. Each row has one action: Done for a request or message, Mark served (or
  Handed over for takeaway) for food. Actions are optimistic: the item leaves at once and returns
  with an error toast if the server refuses. A row's age turns amber and then red as it waits.
- **Floor at a glance:** tables and seats taken, free and reserved, then every table as a tile
  in its state's colour with time seated and amount owed, tagged when it needs a look (seated
  with no order yet, a long wait for food). All · Needs a look · Free narrow it.
- **Arriving soon:** bookings in the next two hours (and up to an hour late), with Seat.
- **Offers today:** the offers on now and those starting later today (branch time), so waiters
  can tell guests: Now or the start time, the name, what it takes off what, the ways of ordering
  it's for, until when. For everyone; hidden when none today (`offersToday` in lib/promotions).
- **Not available tonight:** dishes sold out or off today; those who may change it tap one to
  bring it back.
- **My shift:** orders the staff member took, what they collected and their tips today; shift in
  and out, and **My rota** (their week from the published rota, swaps and time off).
- "Today" is the branch's day in its own time zone.

## Tables

### Floor plan

- **Route:** `/admin/dashboard/tables/`; `?floor=<areaId>` keeps the open area.
- **Components:** [`src/components/admin/tables/`](../src/components/admin/tables/): `FloorPlan`,
  `FloorTabs`, `FloorLegendBar`, `TableCard`, `AssignWaitersDialog`. Logic in
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
- Links to Reservations, QR codes and Edit floor plan (Settings) sit beside the tabs.
- **Assign waiters** (`tables.assign`): pick a waiter, then tap their tables; each tap is saved
  at once (`PATCH …/tables/sections`). Clear all (tapped twice) frees every table for the next
  shift. A table's page shows who covers it, with Take this table / Release for waiters.

Table status rules (server side):

- An order stays open until it is both served and paid.
- Paying isn't leaving: once every dine-in order at the table is served and paid, the table is
  `paidSeated` ("Paid · still seated", counted as Occupied) until staff tap **Free table**. A new
  order there takes it back to `ordering`. Booked guests seated after the last paid order make it
  `seated` instead. There is no automatic freeing yet.
- A table with no open order, no open request and nothing paid since it was last freed is
  `available`, or `reserved` from 60 minutes
  before a booking until 30 minutes after it (`HOLD_BEFORE_MINUTES`, `HOLD_AFTER_MINUTES` in
  [`src/lib/reservations.ts`](../src/lib/reservations.ts)), or `seated` once staff seat a booking.
- Otherwise the most urgent state wins: `needsWaiter`, `wantsBill`, `ordering`, `eating`.

### Table page

- **Route:** `/admin/dashboard/tables/view/?table=5` (build links with `tablePath`). One static
  page reads the number, so tables added in Settings open without a rebuild.
- **Component:** [`TableDetail`](../src/components/admin/tables/TableDetail.tsx) with
  `TableOrderCard`, `TableRequests`, `TableBookings`, `TableNoteCard`, `TableWaiterLine`,
  `TableCollectDialog`, `FreeTableDialog`, `MoveTableDialog` and `qr/TableQrDialog`.
- **Endpoint:** `GET /admin/branches/:branchId/tables/:table` (404 when no area has the table).

The page shows the area, seats and state; open orders (newest first), still to pay and time
seated; today's bookings with Seat; open requests with Done. Actions (each for staff whose role
allows it):

- **Take order / New order** opens the order pad (a new order is a separate bill). Its review step
  shows the bill as the guest will see it (`calculateBill` and `billRows`); the send button
  carries that total. Dine-in offers on now (happy hour, read from `GET /branches/:id/promotions`)
  show as the server will apply them: a banner above the search ("Happy hour · 20% off Beverages
  till 7:00 PM", with a button to show that category), the offer price with the menu price struck
  through on each dish and line, and the discount on the bill.
- **Add round**, **Change** and **Collect** on each order card (see
  [Waiter ordering](#waiter-ordering-at-the-table)). Add round (a running tab: same bill, a new
  ticket for the kitchen) shows only while the order still has something to pay. Once it's paid
  in full the card and the order dialog offer **New order** instead: a new bill at the same table
  with the guest's name filled in, so a paid bill is never reopened.
- **Collect from the whole table** (`TableCollectDialog`): pays every order at the table with
  something due, at any point of the meal (`POST .../tables/:table/payment`), on the shared
  collect form (see [Payments](#payments)).
- **Move table** (`tables.move`, `MoveTableDialog`): every free table in service, by area, as
  tiles. The guests' orders, calls, note and phones go with them
  (`POST …/tables/:table/move { to }`) and the page follows them. A table taken meanwhile is
  refused (409 `table_occupied`). Merging two parties is not supported.
- **Guest note** (`TableNoteCard`): tags (VIP, allergy, birthday, regular, high chair) and a
  line, with who wrote it; cleared when the table is freed. An allergy also shows on the
  kitchen's tickets.
- **Reserve** opens the booking form for this table.
- **QR code** (`tables.qr` or `tables.manage`): the table's printable card, read on its own
  (`GET …/tables/:table/qr`, recorded in the audit log), so a waiter can replace a torn sticker
  without seeing every table's link.
- **Order history** opens `tables/history/?table=5`: the table's orders over the days picked
  (the last 30 without, up to a year back), counted (orders, billed, average bill, cancelled),
  filtered and searched; each opens in full (`GET .../orders?from=&to=&table=`).

Order cards show the order number and the day's token.

### Free table

- Shown when the table is neither available, reserved nor out of service (so also on a
  `paidSeated` table, which keeps it taken until staff free it).
- [`FreeTableDialog`](../src/components/admin/tables/FreeTableDialog.tsx) states what is still
  unpaid (it stays on the Orders page) and calls `POST .../tables/:table/free`.
- The table becomes available; earlier orders and requests are left out of its state. Freeing
  ends every guest session at the table, so the next scan starts a new visit. The mock stores a
  freed timestamp per table.

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
- **Opened from:** the table page, the home's New order and the order dialog on the Orders page.

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

- **Route:** `/admin/dashboard/requests/`; past requests on `requests/history/`.
- **Components:** [`src/components/admin/requests/`](../src/components/admin/requests/):
  `RequestsBoard`, `RequestCard`, `RequestHistory`, `useRequestText`. Logic in
  [`src/lib/adminRequests.ts`](../src/lib/adminRequests.ts).
- **Endpoints:** `GET /admin/branches/:branchId/service`;
  `POST /admin/service-requests/:id/acknowledge`; `POST /admin/service-requests/:id/resolve`;
  `GET …/service-requests/history`.

Behaviour:

- Filter by kind: all, waiter, bill, kitchen (with counts). Kitchen messages
  (`kind: 'kitchen'`: running late, an item unavailable, a question, with an optional note) come
  from the kitchen board about an order and name it, its table or mode and who sent it
  (`useRequestText › kitchenText`).
- **Waiting** (oldest first) offers On my way and Done; **On the way** shows who has it, with Done;
  **Done** lists requests resolved in the last 30 minutes with who handled them and how fast.
- On my way records `acknowledgedBy`; the first person to claim it stays. The guest's waiter and
  bill screens show who is coming (they poll their requests every 15 s).
- Done is idempotent; the request leaves the guest's pending list.
- **History:** pick the days (up to 31, back a year) and the kind; a summary (how many, done, not
  answered, average answer time), then each request with who answered and how fast.

## Orders

- **Routes:** `/admin/dashboard/orders/` (today) with `?view=`; `orders/ready/` and
  `orders/unpaid/` open on those views (the home counters link there); `orders/history/` for past
  days.
- **Components:** [`src/components/admin/orders/`](../src/components/admin/orders/):
  `OrdersBoard`, `OrderHistory`, `OrderListItem`, `OrderDetailDialog`, `OrderSummary`,
  `OrderActionViews` (`CancelOrderView`), `PaymentBadge`; collecting uses the shared
  `CollectFields`. The dialog's Rush, Add items, Change items and Cancel order are small buttons
  sharing one row (icon above the label under 560px). Logic in
  [`src/lib/adminOrders.ts`](../src/lib/adminOrders.ts).
- **Endpoints:** `GET /admin/branches/:branchId/orders` (today's orders in the branch's time zone,
  newest first, or `?from=&to=` for past days); `POST /admin/orders/:id/served`;
  `POST .../orders/:id/payment`; `POST .../orders/:id/cancel`; `PATCH .../orders/:id/rush`; plus
  the order pad endpoints.

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

- Totals (orders, sales, still to collect), a mode filter (dine-in, takeaway, delivery) and
  search by order number, guest name or table.
- Rows, cards and the order popup show the order number (`UDY-001`) and the day's token. The
  popup's bill (`OrderSummary`) is collapsible: the total, with ⌄ to open every charge
  (`BillSummary` with `collapsible`).
- Each row shows its one next action (`nextAction`): Mark served, Handed over (takeaway) or
  Collect (finished with money due).
- The order dialog offers Mark served, Collect payment, Add items and Change (dine-in), **Rush**
  (the kitchen takes it first; pressed again it is removed) and Cancel while the order is not
  finished.
- **Collect payment in person:** the shared collect form (see [Payments](#payments)).
- **Cancel with a reason** (`orders.cancel`): one of `outOfStock`, `guestLeft`, `kitchenIssue`,
  `duplicate`, `other` (`CANCELLATION_REASONS` in `src/config/masters/orders.ts`). Every open
  round is cancelled with `cancelledBy: 'restaurant'`; anything already paid starts a refund; the
  guest's order page shows the reason. Refused with 409 `order_closed` once served, picked up,
  delivered or cancelled.
- **History** (`orders/history/`): quick ranges (7 days to a year) or any From–To up to a year,
  back two years (This FY and Last FY too). Totals summed on the server (sales, completed and
  cancelled, average bill, still to collect, by order type), then every order under its day,
  30 at a time, searchable and filtered, with an Excel export. An unpaid order can still be
  collected from there.

## Menu

- **Route:** `/admin/dashboard/menu/` (also a shortcut in the shell header on every page).
- **Components:** [`src/components/admin/menu/`](../src/components/admin/menu/): `MenuBoard`,
  `MenuDishRow`, `AvailabilityDialog`, `CategoriesDialog`, `DishEditor`, `Switch`,
  `SearchSuggestionsDialog`, `CartSuggestionsPanel`, and the editor sections in
  [`menu/editor/`](../src/components/admin/menu/editor/). Logic in
  [`src/lib/adminMenu.ts`](../src/lib/adminMenu.ts).
- **Endpoints:** `GET /branches/:id/menu`; under `/admin/branches/:branchId/menu/`:
  `PATCH dishes/:slug/availability`, `POST dishes`, `PATCH dishes/:slug`, `DELETE dishes/:slug`,
  `PATCH categories/:categoryId/order`, `PATCH categories`, `POST images`, and the suggestion
  settings.

### Availability

- Filter by state (all, available, sold out, off today) with counts; search; pick a category.
- The switch takes a dish off or puts it back at once. Off means one of: sold out, sold out until
  a time (guests read "Back 8:30 PM"; it returns by itself at `until`), or off today (returns the
  next branch day).
- Dishes with sizes can have individual sizes switched off.
- With inventory on, a dish whose ingredient runs out is taken off by itself.
- Guests see changes within a minute (menu refetch interval 60 s). Orders containing an
  unavailable dish or size are refused.

### Dish editor

`DishEditor` adds or edits a dish in folding sections; a section with a problem opens itself on
save.

- Basics and picture (checked, fitted to 1080 px and compressed by `prepareImage`, with a 192 px
  thumbnail, then uploaded via `POST .../images`; a refusal says why).
- Price, or two or more sizes with names, prices and on/off.
- Choice groups (a meal's slots, a spice level): two or more choices, the first is the default,
  optionally limited to some sizes.
- Add-ons (free or priced, per size), leave-outs and quick kitchen notes.
- Details: highlights, spice, prep time, serves, allergens, meal contents. A prep time is one
  time or a range in minutes ("15 min", "12–15 min", up to 240), tidied on save
  (`tidyPrepTime` in [`src/lib/prepTime.ts`](../src/lib/prepTime.ts)); the kitchen plans by it.
- Availability. An existing dish can be removed (it also leaves curated lists).
- With inventory on, a Recipe button opens the dish's recipe (see [Inventory](#inventory)).

### Order and categories

- With a category selected, Reorder moves its dishes; `PATCH .../categories/:categoryId/order`
  takes exactly the category's slugs.
- Categories renames and reorders categories. Adding a category is not supported in the static
  build (guest category pages are generated at build time).

### Suggestions

`SearchSuggestionsDialog` has two tabs. **Search**: what guests see on the search screen before
they type; staff pin dishes and add their own words (shown first), and with "Fill from orders" on
the rest are what's ordered most. **Cart** (`CartSuggestionsPanel`): "Goes well with your order",
on or off, the categories its dishes come from, staff's pins, and a preview for any dish.

## Reservations

- **Route:** `/admin/dashboard/reservations/` with `?day=YYYY-MM-DD` (today by default); past
  days on `reservations/history/`.
- **Components:** [`src/components/admin/reservations/`](../src/components/admin/reservations/):
  `ReservationsBoard`, `DayStrip`, `DayCalendar`, `ReservationRow`, `ReservationDialog`,
  `ReservationEditor`, `TablePicker`, `BookingRulesDialog`, `DepositDialog`, `RemindersPanel`,
  `RemindActions`, `ReservationHistory`, `useReservationStatus`, `useReservationText`. Rules in
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
  allowed) and marks the smallest free table that fits as Best fit. For a booking within the
  hour, tables with guests at them now (eating, waiting, needing a waiter, or paid and still
  seated) say "Guests at it now" and aren't suggested; they can still be picked, since the guests
  may leave. Bookings later in the day ignore who sits there now.
- Overlapping a booked or seated booking returns 409 `table_taken` with the clashing booking.
  Back-to-back bookings are fine.
- Status changes: seat (booked, from an hour before), no-show (booked, after its time), cancel
  (booked), restore (from cancelled or no-show). Seating makes the table `seated` on the plan.
  A booking left unseated past the branch's grace time becomes a no-show by itself (staff can
  undo it).
- **Booking rules** (`BookingRulesDialog`): when a late party becomes a no-show, when a deposit is
  asked (party size, past no-shows), how much a head, and how long before the booking a
  cancellation is still refunded.
- **Deposits** (`DepositDialog`): staff record the guest's advance (cash, UPI or card, proof
  photos for UPI and card, shown on the booking afterwards; "deleted after 90 days" once gone); cash goes into the open cash register. It comes off the bill when the
  party is seated; a late cancel or no-show keeps it.
- **Reminders** (`RemindersPanel`): parties booked in the next 24 hours with a number, each
  reminded on WhatsApp or by SMS in a tap; reminded ones say so.
- **History:** past days (the last 30 without, up to a year back), counted (bookings, seated,
  showed up, no-shows, cancelled), filtered and searched, with Excel.
- Mock: bookings are stored in `olive.mock.reservations.v1`; under `npm run dev` a branch starts
  with sample bookings ([`src/api/mock/demoReservations.ts`](../src/api/mock/demoReservations.ts)).

## Shifts & attendance

The sidebar's **Shifts & attendance** (formerly Team; `team/`), three tabs in
[`TeamFrame`](../src/components/admin/team/TeamFrame.tsx), each for whoever may open it. Staff
who manage staff get a shortcut to Settings › Staff & roles. Backend only.

- **Rota** (`rota.plan`, `RotaPlanner`): a week, Monday to Sunday, person by person; tap a day
  to plan a shift (a shift type or own hours), each person's weekly hours (warned over the limit)
  and how many are on each day. One next step at a time: Copy last week, Publish, Publish
  changes, Send on WhatsApp. On a phone, one day at a time.
- **Attendance** (`reports.view`, `staff.manage` or `attendance.fix`): who came and when, against
  the published rota, today or over a range; what needs a look first (a missing shift out,
  someone absent), then every shift. With `attendance.fix`: Fix times and Add a shift, each change
  shown as Edited. Excel.
- **Requests** (`rota.plan`, `RotaRequests`): time off and swaps waiting for an answer, then
  swaps still with a colleague, then what was answered in the last 30 days. An approved swap
  moves the shift on the rota.

Staff shift in and out from Home (My shift) or the kitchen bar's shift button.

## Payments

- **Routes:** `/admin/dashboard/payments/` (today, live) with `?view=transactions` or
  `?view=refunds` (To collect is the default); `payments/history/` for any days;
  `payments/invoices/` for tax invoices and credit notes.
- **Components:** [`src/components/admin/payments/`](../src/components/admin/payments/):
  `PaymentsBoard`, `TodayStrip`, `MethodBreakdown`, `DueCard`, `LedgerRow`, `CollectDialog`,
  `CollectFields`, `PaymentPartsFields`, `DiscountPanel`, `BusinessBuyer`, `ProofPicker`,
  `RefundDialog`, `PaymentOrderDialog`, `PaymentHistory`, `InvoiceList`, `InvoiceDoc`,
  `PaymentPrint`, `paymentsExport`. Logic in
  [`src/lib/adminPayments.ts`](../src/lib/adminPayments.ts) and
  [`src/lib/refundItems.ts`](../src/lib/refundItems.ts).
- **Endpoints:** `GET /admin/branches/:branchId/orders`, `…/payments/history` for today (today's money) and the
  service's bill requests; `POST .../orders/:id/payment`; `POST .../tables/:table/payment`;
  `POST .../orders/:id/refund`; `POST/DELETE .../orders/:id/discounts`;
  `PATCH/DELETE .../orders/:id/buyer`; `GET .../payments/history`; `GET .../invoices`.

### Today

- **Today strip:** To collect (every bill still open, with what's from earlier days) and Taken
  today (after refunds); under them online, in person, tips, refunds and what was left off bills.
  **Day report** (print) and **Excel** at the top. Today's money counts each payment when it was
  taken, whatever day the order was placed.
- By payment method, with the cash taken.
- **To collect:** open bills grouped by table (bill requests first) or by takeaway/delivery order.
- **Transactions:** every payment and refund today, filterable by channel and method, searchable.
- **Refunds:** today's refunds.
- Each order opens with its payments, to collect, refund or print.

### Collecting

One collect screen everywhere (`CollectScreen`): the Payments page (`CollectDialog`), the order
dialog (Orders, Unpaid) and the table page (`TableCollectDialog`). Laid out like a till: from
860px wide, the bill on the left (`BillBreakdown`: each item, every charge, the total, then paid
so far and due now) with **Bill options** under it, and the payment on the right
(`CollectFields`: what to collect, how they paid, cash and change); on a phone one column, the
payment first (the bill behind View bill), then the bill options. The bill options are icon
tiles — Discount, Leave unpaid, Business invoice — each opening its form under them, one at a
time. Print bill is the receipt icon beside Collect. Every dialog shows a "More below" pill
while there's more under the fold and it hasn't been scrolled (tap: scrolls down).

- **How it was paid:** the branch's ways to pay staff, cash first. For cash, staff type what the
  guest handed over (or tap Exact) and see the change; the change can be kept as a tip ("Keep ₹20
  as tip"). UPI and card take optional proof photos (`ProofPicker`).
- **Split payment** (`PaymentPartsFields`): part cash, part UPI or card; the last row takes the
  remaining balance so they always add up.
- **Leave part of the bill** (waive, `LeaveCard`): an amount, or a round amount to take, with why (`noChange`,
  `regular`, `complaint`, `other`; `WAIVE_REASONS`). It shows as "Left off bills".
- **Give a discount** (`discounts.give`, `DiscountPanel`): off the whole bill or one item, a
  percentage or an amount, with a reason (regular guest, sorry for the trouble, staff meal,
  manager's choice, other). It comes off before service charge and taxes; bills show it as
  "Discount (reason)". Above the role's discount limit the server refuses and a manager gives it.
- **Business customer** (`BusinessBuyer`): registered name, GSTIN or PAN and address for the tax
  invoice, set before payment.
- **Cash needs an open register:** while the cash register is closed, cash is refused
  (409 `register_closed`); the form says so and offers Open register (`cash.manage`). UPI and card
  still work.
- A seated party's booking deposit can be used against the bill.

### Refunds

`RefundDialog` (`refunds.give`): on an order that stands, up to what is paid and not yet refunded.

- **Why:** `complaint`, `wrongItem`, `overcharged`, `goodwill`, `other`.
- **Which dishes:** required for Complaint and Wrong item, optional for the rest
  (`REFUND_NEEDS_ITEMS`), so reports can take the refund off sales by dish. Only dishes served on
  rounds not cancelled, less what earlier refunds named, can be picked.
- **How much:** what those dishes came to, everything refundable, or part of it.
- A note for the day report (≤ 200 chars).
- Online payments go back through the payment partner (`started`); in-person refunds are cash
  from the drawer (`done`), which needs the register open. 409 `nothing_to_refund` when nothing
  is refundable. Refund rows say what they were for ("For: 1× Butter Chicken (Full)").

### History and invoices

- **Payment history** (`payments/history/`): quick ranges (7 days to a year) or any From–To up
  to a year, back two years, This FY and Last FY. A summary summed on the server (net taken,
  online, in person, tips, refunds, cash), then All or Refunds, every payment and refund under its
  day, 50 at a time, searchable by paid channel and method. Excel. A **Sales register** button
  downloads every tax invoice and credit note as CSV (days shown, This FY or Last FY).
- **Invoices & credit notes** (`payments/invoices/`, from Payment history): the invoices and
  credit notes issued on the days picked (31 at a time, back seven years), all or one kind. View
  opens one exactly as issued (`InvoiceDoc`: seller with GSTIN or PAN, SAC and FSSAI, the Nepali
  date in Nepal, buyer, items, every charge); the first print is the original, later ones say
  "Copy of original – n", and each print is recorded. Backend only.

### Printing and export

- **Printing** (`usePaymentPrint` in
  [`PaymentPrint`](../src/components/admin/payments/PaymentPrint.tsx)): a bill for an order or a
  table, or the day report for the day. The bill shows the brand, branch, phone and tax
  registration number (GSTIN or PAN), bill number, date, guest, each order's items, every
  charge as the guest's bill lists them (`billRows`), the total, paid and due, and the payments
  taken; once invoiced, the invoice details. It is titled "Receipt" once paid, "Bill of supply"
  in India without tax, else "Bill". The print page has no margin (`@page { margin: 0 }`), so
  browsers leave out their own header and footer; the tab's title names a saved PDF ("Bill
  UDY-001").
- **Day report:** summary, by payment method, every payment and refund (with tip, what was left
  and why, staff, reason) and what's still to collect.
- **Excel:** payments and refunds, one row each (`paymentsExport.ts`).

## Refunds & cancellations

- **Route:** `/admin/dashboard/refunds/` (`refunds.give`, `orders.cancel` or `reports.view`).
- **Components:** [`src/components/admin/refunds/`](../src/components/admin/refunds/):
  `RefundsPage`, `OrderPicker`. Logic in [`src/lib/refundsReport.ts`](../src/lib/refundsReport.ts).
- **Endpoints:** `GET …/orders?from=&to=`, the payments, and
  `POST …/orders/:id/refunds/:seq/received`.

Behaviour:

- **Refund an order** and **Cancel an order** at the top: pick the order, then the same windows
  Orders and Payments use.
- Ranges: Today, Last 7 days, This month, Pick days.
- **Money given back** (refunds on the day they were given; in person and online), compared with
  the same number of days just before. **Cancelled** (on the day of the order): whole orders,
  rounds, and dishes that ran out.
- **Online refunds on the way:** every one from the last 30 days that hasn't reached the guest;
  **Guest got it** marks it received; after 7 days it is marked late ("check with the bank").
- Every refund and cancellation by day, with All / Refunds / Cancellations, a search, and More
  filters (reason, who did it). A row opens its order.

## Cash register

- **Route:** `/admin/dashboard/cash/` (`cash.manage` or `cash.review`). Backend only.
- **Components:** [`src/components/admin/cash/`](../src/components/admin/cash/): `CashRegister`,
  `CashCounter`, `CashMoveDialog`, `CloseRegisterDialog`, `CashSessionDialog`, `SessionRow`,
  `CashDayEnd`, `CashReports`. Logic in [`src/lib/cashRegister.ts`](../src/lib/cashRegister.ts).
- **Endpoints:** under `/admin/branches/:branchId/cash-register`: `GET`, `POST open`,
  `POST movements`, `POST close`, `GET sessions/:id`, `POST sessions/:id/check`,
  `GET days/:day`, `POST days/:day/sign-off`, `GET report`, `PATCH limit`.

One drawer per branch. Three tabs:

- **Today's drawer:** closed, Start the day (count the cash note by note, or reuse the last count
  in one tap) and open it. Open, who opened it and when (warned when left open from an earlier
  day), **Add cash**, **Take cash out** (with a reason), **Close & count**, and the moves so far.
  What should be in the drawer shows only to reviewers: the close count is blind for the rest.
  Earlier drawers are listed below.
- **Closing** (`CloseRegisterDialog`): count the cash (by note or a total), then the card
  machine's and UPI app's totals (optional), then the check. A match closes at once; a difference
  shows short or extra and needs what happened.
- **End of day** (`CashDayEnd`): did the cash match for the drawers closed that day, the cash
  during the day, card and UPI, and **Sign off the day** (`cash.review`, once every drawer is
  closed).
- **Reports** (`CashReports`): for the days chosen (the last 30 by default), total short, total
  extra, days with a difference, drawers to check; drawers day by day and by who closed them.
  Reviewers set the allowed difference here (not in Settings). A drawer over the limit needs a
  manager's check (Mark as checked).

Cash payments and cash refunds need the drawer open (see [Collecting](#collecting)).

## Sales report

The manager's report: sidebar **Sales** (`reports.view`). Backend only.

- **Route:** `/admin/dashboard/sales/` with `?from=&to=` (the last 7 days without) and
  `?view=branches` for every branch side by side (`salesPath`).
- **Components:** [`src/components/admin/sales/`](../src/components/admin/sales/):
  `SalesReportPage`, `KpiTiles`, `ColumnChart`, `MeterList`, `DishRanking`, `MoneyStatement`,
  `BranchComparison`, `useSalesExport`, `useSalesPdf`. Logic in
  [`src/lib/salesReport.ts`](../src/lib/salesReport.ts) (presets, buckets, day parts, ticks) and
  [`src/lib/salesExport.ts`](../src/lib/salesExport.ts) (the workbook). Wording in
  `common › adminSales`.
- **Endpoints:** `GET /admin/branches/:branchId/reports/sales?from=&to=` and
  `GET …/reports/sales/branches?from=&to=`.

How it counts:

- A sale counts on the day the order was placed (branch time); money (payments, refunds) on the
  day it moved.
- Cancelled orders are left out of sales and named on one line ("3 cancelled (₹1,200), not
  counted in sales").
- Refunds means refunds staff gave (complaint, wrong item, goodwill…), not cancellations.
- Up to 366 days at a time, back 730 days (`SALES_LIMITS`).

The page, top to bottom:

- **Presets:** Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, This FY and
  Last FY (when the branch has fiscal years, Nepal's converted from Bikram Sambat), Pick dates.
- **Showing** and **Compared with** boxes: the days picked, and the same number of days just
  before. An ⓘ explains that Compared with is picked for you, only for the ▲ up / ▼ down on each
  figure.
- **KPI tiles**, each with its change: Net sales (after discounts, before VAT and service
  charge), Orders (not counting cancelled), Average bill (VAT included), Discounts (offers, promo
  codes, staff discounts), Refunds (by staff; more is shown as bad news).
- **Sales by day:** net sales per day, with the average, best and quietest day; weeks after 45
  days and months after 190 (`grainOf`). Tap a column to open that day (or week, or month) on its
  own.
- **Busiest hours** by net sales, the peak named, and **Through the day**: morning, lunch,
  afternoon, dinner, late night (`DAY_PARTS`).
- **By order type** (dine-in, takeaway, delivery) and **By payment method** (money received,
  with what was refunded).
- **Best sellers:** rank by sales or quantity, top 10, "Show all"; **Sold least**: dishes on the
  menu that sold least or not at all (with "Added …" for new dishes). **Categories** by sales.
- **Money summary** (`MoneyStatement`), to the paisa for the accountant: dishes at menu prices,
  offers, promo codes, staff discounts, net sales, service charge, each tax, delivery fees, round
  off, other adjustments, total billed; then money in: payments received, refunds by reason, net
  received, and what was left off bills. **Refunds by dish**, with "Not linked to a dish" for
  goodwill, overcharged and older refunds. A **Sales register** button downloads the tax
  invoices and credit notes for the days as CSV.
- **All branches** (shown only to staff who see reports at more than one branch): each branch in
  its own currency against the period before (net sales, orders, average bill, best seller), with
  **Open report**. Amounts in different currencies are never added together.
- **Excel:** a multi-sheet workbook (report, summary, by day with the Nepali date, by hour, order
  types, payment methods, dishes, categories, money summary, and branches when compared).
- **PDF:** one click, the report drawn at A4 width and laid on A4 pages with page numbers
  (jsPDF). **Print:** the browser's print of the same sheet.

## Inventory

- **Route:** `/admin/dashboard/inventory/` (any `inventory.*` permission). Backend only, and
  only while inventory is on for the restaurant (Settings › Modules).
- **Components:** [`src/components/admin/inventory/`](../src/components/admin/inventory/):
  `Inventory`, `TodayTab`, `StockTab`, `RecipesTab`, `UsageTab`, `LedgerTab`, `DashboardTab`,
  `IngredientsTab`, `CountsTab`, `TransfersTab`, the dialogs, and `setup/` (Get started). Logic in
  [`src/lib/inventory.ts`](../src/lib/inventory.ts), `inventorySetup.ts`,
  `inventoryPlanning.ts`, `inventoryWeek.ts` and `recipeTemplates.ts`.

Rules (server side): stock is used when the kitchen starts cooking, and put back on the
kitchen's undo; a dish goes sold out by itself when an ingredient reaches zero; stock may go below
zero, so service is never blocked; costs are a weighted average. Costs and values show only to
`inventory.manage` or `reports.view`.

Tabs:

- **Get started** (first screen while nothing is tracked): tick ingredients from a ready list
  or add your own, starting amounts, "Warn me at" levels, recipes.
- **Today:** what needs someone now (out, past its date, running low, running out soon,
  ingredients that cost more than before), four daily jobs (Stock arrived, Record wastage, Count
  stock, Correct a number) and this week in three numbers, with a WhatsApp share. Record wastage
  takes up to five photos of what's thrown away (optional), shown on the ledger's wastage rows
  and kept like proof photos (Settings › Proof photos).
- **Stock:** every item by category with level bars, filters with counts and days left; an item
  opens its amount, worth, recent changes, expiry batches and settings.
- **Recipes:** what each dish uses (per size, add-on and choice), food cost against a goal,
  templates for common dishes, "Price went up" tags.
- **Reports:** Where stock went (usage: actual against recipes, wastage, missing; food cost),
  Every stock change (the ledger, CSV), Wastage, Charts (the dashboard: stock value, wastage by
  reason, most used, price moves; every branch side by side for admins of several).
- **More:** Ingredients, Stock counts (blind counts a manager applies; printable count sheet),
  Other branches (transfers: send, then the receiver confirms).

Batches and expiry: items with "Track expiry dates" take an expiry on every delivery; expired
batches are written off with one tap, never automatically.

## Purchasing

- **Route:** `/admin/dashboard/purchasing/` (`purchase.view`, `.manage`, `.approve` or
  `.receive`). Backend only, and only while inventory is on.
- **Components:** [`src/components/admin/purchasing/`](../src/components/admin/purchasing/):
  `Purchasing`, `TodayTab`, `OrdersTab`, `OrderEditor`, `OrderDialog`, `ReceiptsTab`,
  `ReceiveDialog`, `ReceiptDialog`, `SuppliersTab`, `SettingsDialog`, `OrderPrint`,
  `useSendOrder`. Logic in [`src/lib/purchasingFlow.ts`](../src/lib/purchasingFlow.ts) and
  [`src/lib/purchasingToday.ts`](../src/lib/purchasingToday.ts).

Tabs:

- **Today:** until buying is set up, four steps (ingredients in Inventory, a supplier, what they
  sell, a first order). Then cards: running low by supplier (one tap makes the order with
  quantities filled in), to approve, to send, arriving today or late (Receive), delivered prices
  to check. "All caught up" when nothing waits.
- **Orders:** every order as a card with its progress (placed, sent, arrived) and one next step:
  Approve, **Send on WhatsApp** (which also marks it sent), Receive. Views: to do, on the way,
  done, all; search. A new order shows the supplier's items with stock, last price and a suggested
  quantity. **Print** lays the order out on A4 (prices only for staff who see them).
- **Deliveries:** receiving starts from the order as a checklist ("Everything came as ordered");
  only differences are typed, and the bill photo is one tap. Delivered prices to look at first,
  then deliveries with badges (price to confirm, refused, returned, bill photo), then **returns**
  to suppliers. The kitchen receives deliveries too (`purchase.receive`), without prices.
- **Suppliers:** cards with call and WhatsApp; Details and What they sell (searchable, pack,
  price, preferred supplier).
- **Settings** (from the page head, `purchase.approve`): whether orders need approval (off by
  default; every order, or those above an amount) and how far above the expected price a
  delivered one is flagged.

## Activity log

- **Route:** `/admin/dashboard/audit/` (`audit.view`: admins; managers only when an owner adds it
  to their role). Backend only.
- **Component:** [`src/components/admin/audit/`](../src/components/admin/audit/): `AuditLog`,
  `useAuditText`, `settingsChanges` (a settings change field by field), `AuditBill` (View bill).
- **Endpoints:** `GET /admin/branches/:branchId/audit` and `…/audit/export.csv`.

Who did what at the branch, newest first: cancellations, refunds, discounts, write-offs, prices,
settings, staff and roles, sign-ins, invoices. Filter by days (today without any; up to 92, back
seven years), area (Orders & bills, Tables, Invoices, Cash drawer, Menu prices, Settings, Staff &
roles) and person. Each entry is a sentence with why and the particulars, linking to its table.
100 at a time; the filtered days download as CSV. Entries can't be changed.

- **View bill:** an entry about an order (refunds, discounts, cancellations, left-off amounts,
  invoices) has View bill. The order is read only then (`GET …/orders/:id`, `useBranchOrder`) and
  opens in the Payments page's order pop-up (`PaymentOrderDialog`, without Collect and Refund):
  items, bill, every payment and refund, Print. The pop-up's code downloads the first time.
- **Settings changes:** each field that changed, in plain words, before → after ("Tax & bill ›
  Service charge: 5% → 10%", "Opening hours › Dine-in › Monday: 11:00–23:00 → Closed", "Delivery
  zones › Sector 18: Added"); five at a time, then Show all. The server records every changed
  section in full (the Wi-Fi password only as changed). Older entries recorded only some
  sections, so they may list fewer details.
- **Table moves:** the Move screen asks why (Guest asked, More people came, Too hot, cold or
  noisy, Table needed for a booking, Other) and takes a note; the entry shows both and the
  orders that moved. Moves made before this have no reason.

## QR codes

- **Route:** `/admin/dashboard/tables/qr/` (`tables.manage`); one table's card is also available
  from its page (`tables.qr` or `tables.manage`).
- **Components:** [`src/components/admin/tables/qr/`](../src/components/admin/tables/qr/):
  `TableQrCodes`, `QrCard`, `PrintSheet`, `TableQrDialog`, `useQrDownload`, `useOrigin`. Link
  logic in [`src/lib/tableQr.ts`](../src/lib/tableQr.ts).
- **Endpoints:** `GET /admin/branches/:branchId/tables/qr-codes`; one table's
  `GET …/tables/:table/qr`.

Behaviour:

- Cards by area; select some or all and print on A4, two cards across. Each card shows the
  restaurant, the table number, the QR code (SVG), "Scan to order & pay", and area and branch.
- Download one code as a PNG (`table-5-qr.png`).
- The server returns a relative `path` (`/?branch=<id>&table=<n>&qr=<token>`); the page prefixes
  the site's own origin, so codes printed from the live site open it.
- The backend signs the token and refuses a dine-in scan with a wrong one (403 `qr_invalid`).
  The mock token (`t<n>.<hash>`, `mockQrToken`) is deterministic and unsigned.

## Kitchen workspace

A separate full-width workspace for the kitchen display, using the same staff sign-in and
selected branch as the admin dashboard.

- **Routes:** `/admin/kitchen-dashboard/` (board; `?station=<category>` sets this screen's
  station), `stock/`, `activity/`; navigation in [`src/lib/kitchenNav.ts`](../src/lib/kitchenNav.ts).
- **Shell:** [`KitchenShell`](../src/components/kitchen/shell/KitchenShell.tsx) wraps the pages in
  `WorkspaceGate` (same guard and `AdminWorkspace` as the admin shell), in the device's theme,
  then [`KitchenBar`](../src/components/kitchen/shell/KitchenBar.tsx): brand, branch and its
  status control (so the kitchen can pause ordering), the kitchen pages, a link back to the admin
  dashboard, local time, the shift button (`KitchenShift`: shift in and out, the week's rota),
  the new-ticket sound on or off, Screen settings, full screen (`useFullscreen`) and the account
  menu. The bar keeps the branch's events open (`useBranchEvents`, see
  [Live updates and polling](#live-updates-and-polling)).
- **Stays signed in:** the kitchen has no idle sign-out, and while a kitchen page is open and on
  screen it keeps the device's sign-in in use (`useKitchenKeepAlive`).
- **Theme:** light or dark, dark by default (less glare at the pass), chosen per device in Screen
  settings (`useKitchenTheme`, localStorage `olive.kitchen-theme.v1`, synced across tabs). The
  colours are tokens in [`kitchenTheme.module.css`](../src/components/kitchen/kitchenTheme.module.css)
  (`.light`, `.dark`); dialogs opened from the kitchen take the same class.
- **Data:** no kitchen data of its own.
  [`useKitchenTickets`](../src/components/kitchen/useKitchenTickets.ts) reads
  `GET /admin/branches/:branchId/orders` (polled every 15 s, 60 s while events are connected) and
  the branch menu for stations (a dish's category) and prep times.

### Screen settings

[`KitchenSettingsDialog`](../src/components/kitchen/shell/KitchenSettingsDialog.tsx): each
kitchen screen keeps its own (a wall screen and a station tablet differ), in localStorage
`olive.kitchen-prefs.v1` ([`useKitchenPrefs`](../src/components/kitchen/shell/useKitchenPrefs.ts)).
It also lists the keyboard and bump-bar keys.

| Pref        | Default | Effect                                                                  |
| ----------- | ------- | ----------------------------------------------------------------------- |
| `sound`     | on      | A chime when a ticket comes in (with a test button)                     |
| `reminders` | on      | A softer chime every minute while a ticket has waited in New over 2 min |
| `awake`     | on      | Keeps the screen from dimming (Screen Wake Lock, `useWakeLock`)         |
| `textSize`  | medium  | Tickets scaled 0.9 / 1 / 1.15 / 1.3 (`TEXT_SCALE`)                      |
| `autoPrint` | off     | Prints each new ticket as a KOT                                         |
| `station`   | `all`   | The station (menu category) this screen shows, or `pass`                |

The chimes are made in the browser ([`kitchenSound.ts`](../src/components/kitchen/shell/kitchenSound.ts),
Web Audio, no sound file). Browsers allow sound only after a touch, so the audio context resumes
on the first tap anywhere (`useSoundUnlock`). The wake lock is asked for again when the tab comes
back. A station gone from the menu shows everything.

### Board

- **Component:** [`src/components/kitchen/board/`](../src/components/kitchen/board/):
  `KitchenBoard`, `TicketCard`, `TicketItem`, `TicketTimer`, `BoardStats`, `AllDayList`,
  `KitchenMessageDialog`, `CantMakeDialog`, `KotPrint`, `useTicketActions`, `useBoardKeyboard`,
  `useConnection`, `useWaitingReminder`. Logic in
  [`src/lib/kitchenBoard.ts`](../src/lib/kitchenBoard.ts).
- **Endpoints:** `PATCH /admin/branches/:branchId/orders/:id/rounds/:round/status` with
  `{ status, back? }`; `PATCH …/rounds/:round/items/:position/plated`;
  `POST …/orders/:id/messages`.

Rules:

- Every round of every order today is a ticket (`kitchenTickets`); an order without rounds is one
  round. Three lanes: New, Cooking, Ready. From 1024px they are three **equal fixed columns**,
  each scrolling on its own, so a busy lane never squeezes the others; below 1024px one lane is
  shown at a time, picked from tabs. In each lane (`laneTickets`): a ticket just cancelled
  first (it stays where the kitchen last saw it for 5 minutes, `CANCELLED_SHOW_MS`), then rush
  orders, then the rest oldest first.
- Due time (`ticketDueAt`): takeaway at its pickup time; delivery within the branch's delivery
  `prepMinutes`, or the slowest dish's prep time if longer; dine-in when its slowest dish is done
  (the menu's `prepTime`, read by `prepMinutes` in [`src/lib/prepTime.ts`](../src/lib/prepTime.ts):
  a range's longest), `DINE_IN_TARGET_MINUTES` (18) when no dish says. A takeaway for a later
  slot is marked scheduled until `prepMinutes` before it (`isScheduled`).
- Urgency (`ticketUrgency`): late in red, due soon in amber; a ready ticket waiting more than
  `READY_WAIT_MINUTES` (5) is late.
- Start cooking and Mark ready (Hand to rider for delivery) update optimistically
  (`withKitchenStep`) and offer **Undo** in a toast for a few seconds. A ready ticket has
  **Recall** back to Cooking. Both send `back: true`. Steps are idempotent and keep the first
  person who marked them. Guest tracking and the waiters' Ready to serve follow.
- **Offline tap queue** ([`src/lib/kitchenOutbox.ts`](../src/lib/kitchenOutbox.ts),
  [`useKitchenOutbox`](../src/components/kitchen/useKitchenOutbox.ts)): every kitchen tap (a step,
  a recall, a plated tick) goes into a queue kept on the device and shows on the board at once.
  Taps are sent in order, one at a time, and retried every few seconds and as soon as the device
  is back online, surviving a reload. A banner says how many are waiting to send. A tap the
  server refuses (the order was cancelled or served meanwhile) is dropped with a message; taps over
  2 hours old are dropped too. Sending one twice does no harm.
- **Plated ticks:** tapping an item ticks it off; saved on the order (`useSetPlated`), so every
  kitchen screen shows it.
- **Stations and the pass:** a screen set to one station lists only its dishes (others are
  counted) and offers **My dishes done**, which ticks that station's dishes on the ticket as
  plated ("Your dishes are done – waiting on other stations"). A screen set to **Pass** shows
  whole tickets with each station's progress (`stationProgress`, "2/3") and "All dishes done –
  ready for the pass"; the pass still marks the ticket ready by hand.
- **Can't make an item** (`CantMakeDialog`): how many, and whether the dish goes off the menu too
  (on to start with). It comes off the guest's bill and the waiters are told; or the whole order is
  cancelled as out of stock.
- **Rush:** a waiter marks an order rush from its Orders popup (`useSetRush`); the ticket is
  flagged and goes first in its lane.
- **Message the waiters** (`KitchenMessageDialog`, `useSendKitchenMessage`): running late, an
  item unavailable or a question, with an optional note (80 characters). It lands on the
  Requests board and the home queue as a `kitchen` request.
- **Large ticket:** a ticket opens large in a dialog from its place in the header, with its
  buttons and Print.
- **KOT print** ([`KotPrint`](../src/components/kitchen/board/KotPrint.tsx), `useKotPrint`):
  kitchen order tickets 80 mm wide, black on white, one after another with a cut between; where
  it goes, the token and quantities large; no prices. No page margin, so the browser adds no
  header or footer. From a ticket's Print, the `P` key, or every new ticket with `autoPrint`.
- **Keyboard and bump bar** (`useBoardKeyboard`): ↑ ↓ (or ← →) and 1–9 pick a ticket in the
  order shown, Enter moves it on, Backspace takes the last step back, F opens it large, P prints
  it, Esc clears the pick. Keys in a field or with a dialog open are left alone.
- **New tickets** chime (`sound`), print (`autoPrint`) and are flagged New for a moment; a
  ticket left in New over 2 minutes chimes every minute (`useWaitingReminder`, `reminders`).
- **Connection** (`useConnection`), beside the tools: offline (no network), stale (reads failing,
  or without events nothing new for 45 s) or live.
- Filters by order type, station and search. The all-day list adds up dishes still to cook across
  New and Cooking tickets, grouped by station (shown in a panel below 1280px).
- Mock: until marked, the mock kitchen's own timing applies (started at 2 min, ready at 18 min,
  served 4 min after ready; [`src/api/mock/kitchen.ts`](../src/api/mock/kitchen.ts)). The mock has
  no events, no plated ticks shared between screens and no kitchen messages.

### Tickets

[`TicketItem`](../src/components/kitchen/board/TicketItem.tsx) renders each line as a cook reads
it, using [`src/lib/kitchenItems.ts`](../src/lib/kitchenItems.ts) (`kitchenItem`, `stockIssue`):

- **Allergy flag:** an allergen named in the kitchen note, an item's note or the table's guest
  note ("peanut", "gluten", "dairy", or "allergy" itself) flags the ticket above everything else,
  listing the allergens (`allergensIn`; whole words, so "nutmeg" is not "nut").
- Quantity, dish and size; a meal's picks one per line; other choices with their group name when
  not the default; add-ons; leave-outs highlighted; the guest's note; no prices.
- A warning when the dish has since gone off the menu (sold out, off today, or its size off).
- The ticket header shows where it goes and the day's token in large type, the minutes waited,
  then the order and round, guest or waiter origin, due time, a Rush badge and the kitchen note.
  With a station chosen, other stations' items are counted, not listed.

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

- **Route:** `/admin/kitchen-dashboard/stock/` (`menu.availability.update`), component
  [`KitchenStock`](../src/components/kitchen/stock/KitchenStock.tsx).
- Every dish by station with its availability. It reuses the Menu page's dish rows and
  `AvailabilityDialog`, without editing, on `PATCH .../menu/dishes/:slug/availability`.
- With inventory on (`KitchenIngredients`, `UseFirst`): what's low or out, **Use these first**
  (dates today, tomorrow or past, to write off), Record wastage (`inventory.wastage`), Receive a
  delivery (`purchase.receive`) and Start or carry on a stock count (`inventory.count`). The
  kitchen sees quantities, never costs or prices.

## Endpoint index

All admin endpoints take `Authorization: Bearer <token>` and answer 401 `unauthorized` without a
valid session and 403 `forbidden` for a branch the admin does not manage or a permission their
role lacks. Full request and response shapes are in [api-contract.md](api-contract.md) and
[`src/api/contracts/`](../src/api/contracts/) (re-exported by `src/api/contracts.ts`); the
calls are in [`src/api/endpoints/`](../src/api/endpoints/); backend-only routes are listed in
[`src/api/backend.ts`](../src/api/backend.ts); mock handlers are in
[`src/api/mock/handlers/`](../src/api/mock/handlers/).

| Endpoint                                                         | Used by                   | Mock handler file   |
| ---------------------------------------------------------------- | ------------------------- | ------------------- |
| `POST /admin/sessions`                                           | Sign-in                   | `adminSessions`     |
| `DELETE /admin/sessions/current`                                 | Sign-out                  | `adminSessions`     |
| `POST /admin/sessions/current/renew`                             | Session renewal           | backend only        |
| `GET /admin/branches`                                            | Guard, picker, shell      | `adminSessions`     |
| `PATCH /admin/branches/:id/status`                               | Branch status control     | `adminSessions`     |
| `GET /admin/branches/:id/service`                                | Home, Requests, badges    | `adminService`      |
| `POST /admin/service-requests/:id/acknowledge`                   | Requests                  | `adminService`      |
| `POST /admin/service-requests/:id/resolve`                       | Home, Requests, table     | `adminService`      |
| `POST /admin/orders/:id/served`                                  | Home, Orders              | `adminService`      |
| `GET /admin/branches/:id/tables`                                 | Floor plan, Home          | `adminTables`       |
| `GET /admin/branches/:id/tables/:table`                          | Table page                | `adminTables`       |
| `POST /admin/branches/:id/tables/:table/free`                    | Table page                | `adminTables`       |
| `POST /admin/branches/:id/tables/:table/move`                    | Table page                | backend only        |
| `PATCH`/`DELETE /admin/branches/:id/tables/sections`             | Assign waiters            | backend only        |
| `PATCH /admin/branches/:id/tables/:table/note`                   | Table page                | backend only        |
| `GET /admin/branches/:id/tables/qr-codes`                        | QR codes                  | `adminTables`       |
| `GET /admin/branches/:id/tables/:table/qr`                       | Table page                | backend only        |
| `POST /admin/branches/:id/tables/:table/orders`                  | Order pad                 | `adminOrders`       |
| `POST /admin/branches/:id/tables/:table/payment`                 | Table page, Payments      | `adminOrders`       |
| `GET /admin/branches/:id/orders`                                 | Orders, Payments, kitchen | `adminOrders`       |
| `POST /admin/branches/:id/orders/:id/rounds`                     | Order pad                 | `adminOrders`       |
| `PATCH /admin/branches/:id/orders/:id/rounds/:r`                 | Order pad (change)        | `adminOrders`       |
| `POST /admin/branches/:id/orders/:id/payment`                    | Orders, Payments          | `adminOrders`       |
| `POST /admin/branches/:id/orders/:id/refund`                     | Payments, Refunds         | `adminOrders`       |
| `POST /admin/branches/:id/orders/:id/refunds/:seq/received`      | Refunds                   | backend only        |
| `POST /admin/branches/:id/orders/:id/cancel`                     | Orders, Refunds           | `adminOrders`       |
| `POST`/`DELETE /admin/branches/:id/orders/:id/discounts[/:d]`    | Collect                   | backend only        |
| `PATCH`/`DELETE /admin/branches/:id/orders/:id/buyer`            | Collect                   | backend only        |
| `GET /admin/branches/:id/payments/history`                       | Payment history           | backend only        |
| `GET /admin/branches/:id/invoices[/:id]`, `…/register.csv`       | Invoices, Sales           | backend only        |
| `GET /admin/branches/:id/reports/sales[/branches]`               | Sales report              | backend only        |
| `/admin/branches/:id/cash-register/...`                          | Cash register             | backend only        |
| `GET /admin/branches/:id/audit`, `…/audit/export.csv`            | Audit log                 | backend only        |
| `PATCH /admin/branches/:id/orders/:id/rounds/:r/status`          | Kitchen board             | `kitchen`           |
| `PATCH /admin/branches/:id/orders/:id/rounds/:r/items/:p/plated` | Kitchen board             | backend only        |
| `PATCH /admin/branches/:id/orders/:id/rush`                      | Orders popup              | backend only        |
| `POST /admin/branches/:id/orders/:id/messages`                   | Kitchen board             | backend only        |
| `GET /admin/branches/:id/events` (SSE)                           | Admin shell, kitchen bar  | backend only        |
| `GET`/`POST /admin/branches/:id/reservations`                    | Reservations              | `adminReservations` |
| `PATCH /admin/branches/:id/reservations/:id[/status]`            | Reservations              | `adminReservations` |
| `/admin/branches/:id/menu/...`                                   | Menu, kitchen stock       | `adminMenu`         |
| `/admin/branches/:id/inventory/...`, `…/purchasing/...`          | Inventory, Purchasing     | backend only        |

The settings, floor layout, staff, roles and branch endpoints are listed in
[settings.md](settings.md).

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
