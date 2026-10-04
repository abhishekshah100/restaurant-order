# The Olive Table: project guide

This guide explains how the codebase is put together, so you can find your way around and change it safely. For setup and scripts, see [README.md](README.md).

## What this is

The Olive Table is a QR-code ordering site for a restaurant brand with branches in India and Nepal (more regions later). A guest scans the code on their table (for example `/?table=12`, or `/?branch=ktm-thamel&table=5` for another branch), browses that branch's menu, builds a cart and checks out with name, mobile number and OTP. They pay online or at the counter, then follow their order. Everything that differs by branch or region (currency, locale, time zone, taxes, phone numbers, payment methods, dietary marks, hours) comes from API data, never from code: see [Branches and regions](#branches-and-regions).

- **Stack:** Next.js 16 (App Router), React 19 and TypeScript 7.
- **Hosting:** exported as a fully static site (`out/`). There's no server and no backend yet. All data comes from an API layer (`src/api`, TanStack Query): reference data from dummy JSON endpoints in `public/api/`, and everything the backend will own (sessions, OTP, orders, payments, service requests) from an in-browser mock server (`src/api/mock`) that answers exactly as the [backend contract](#backend-contract) says. Pointing it at a real backend is a config change (see [Data](#data)). UI state lives in the browser.
- **Design source of truth:** `../the-olive-table-ui`. The `screens/*.html` files and `png/*.png` are the reference for every page. The `w*` and `ws*` screens are the desktop layout (1024px and up); `01–21` and `s*` are the mobile layout.

## Status

| Phase | Scope                                                                                                                  | State |
| ----- | ---------------------------------------------------------------------------------------------------------------------- | ----- |
| 1     | Tooling, tokens, fonts, Icon, `ui/` kit, `/styleguide`                                                                 | Done  |
| 2     | Layout shell, Welcome, Menu, Category, Search, Food detail, Quick-add                                                  | Done  |
| 3     | Cart, Checkout (details, OTP, payment, processing, failed, cancelled), order confirmation                              | Done  |
| 4     | Order tracking, order details, My orders, Help, waiter, bill                                                           | Done  |
| 5     | Restaurant state screens (closed, paused, offline), full responsive and accessibility pass, README                     | Done  |
| G1a   | Branches and region config: per-branch menus, currency, locale, time zone, tax engine, phone, payments, dietary marks  | Done  |
| G1b   | Backend-ready write layer: contracts, transport, in-browser mock server, query and mutation hooks; region-neutral copy | Done  |

## Routes

Every route is prerendered at build time. Dynamic segments list their pages with `generateStaticParams` and set `dynamicParams = false`.

| Route                    | Screen(s)                                                                                               | Component                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `/`                      | 01 · w01 Welcome; s01–s03 · ws01–ws03 when closed / paused / offline                                    | `components/home/Welcome` in `OrderingGate` |
| `/menu`                  | 02 · w02 Menu home                                                                                      | `components/menu/MenuHome`                  |
| `/menu/[category]`       | 03 · w03 Category (6 pages)                                                                             | `components/menu/CategoryView`              |
| `/dish/[slug]`           | 06 · w06 Food detail (one page per dish slug on any branch's menu); `?edit=<lineKey>` edits a cart line | `components/menu/DishDetail`                |
| `/search`                | 04, 05, s04, s05 · w04, w05, ws04, ws05; `?q=`                                                          | `components/menu/SearchView`                |
| `/cart`                  | 08 · w08, empty s06 · ws06                                                                              | `components/cart/CartView`                  |
| `/checkout/*`            | Restaurant-state screen instead of the step while ordering is unavailable                               | `app/checkout/layout.tsx` (`OrderingGate`)  |
| `/checkout/details`      | 09 · w09                                                                                                | `components/checkout/DetailsStep`           |
| `/checkout/verify`       | 10, s07 · w10, ws07                                                                                     | `components/checkout/VerifyStep`            |
| `/checkout/payment`      | 11 · w11                                                                                                | `components/checkout/PaymentStep`           |
| `/checkout/processing`   | 12, s08, s09 · w12, ws08, ws09; `?state=payment-failed` or `?state=payment-cancelled`                   | `components/checkout/ProcessingStep`        |
| `/order/[id]/confirmed`  | 13 · w13                                                                                                | `components/order/OrderConfirmed`           |
| `/order/[id]/track`      | 14 · w14 Order tracking; s10 · ws10 when cancelled                                                      | `components/order/OrderTracking`            |
| `/order/[id]`            | 15 · w15 Order details; s10 · ws10 when cancelled                                                       | `components/order/OrderDetails`             |
| `/orders`                | 16 · w16 My orders                                                                                      | `components/order/MyOrders`                 |
| `/help`                  | 17 · w17 Help (Payment help and Allergens & FAQs open as dialogs; Follow us links)                      | `components/service/HelpView`               |
| `/help/bill`             | 20 · w20 Request bill                                                                                   | `components/service/BillRequestView`        |
| `/help/bill/pay`         | Pay my bill (laid out like 20 · w20; payment states as 12 · w12, s08 · ws08)                            | `components/service/PayBillView`            |
| `/help/waiter-requested` | 19 · w19 Waiter requested                                                                               | `components/service/WaiterRequested`        |
| `/help/bill-requested`   | 21 · w21 Bill requested                                                                                 | `components/service/BillRequested`          |
| `/styleguide`            | Design-system board (ds01 / ds02)                                                                       | `app/styleguide/Styleguide`                 |

The quick-add sheet and modal (07 · w07) isn't a route. It's a dialog opened from any menu list through `QuickAddContext`. The request-waiter sheet and modal (18 · w18) is also a dialog, opened from anywhere with `useServiceRequest().openRequest('waiter')`.

`app/error.tsx` and `app/global-error.tsx` show a "Something went wrong" screen with **Try again** instead of a blank page if a component throws.

## Folder structure

```
src/
  app/            Routes only. Thin server components that set metadata and render one view.
  components/
    ui/           Design-system primitives (Button, Chip, OptionRow, OtpInput, Dialog…). No business logic.
    layout/       SiteHeader (desktop), MobileHeader, BottomNav, CartBar, CheckoutSteps, page shells.
    menu/         Menu, category, search, food detail, quick-add and their parts (DishRow, DishCard…).
    cart/         Cart page, desktop cart panel, tablet slide-over, PriceSummary, CartLineItem.
    checkout/     The four checkout steps, their shared frame and the order-summary aside.
    order/        Order confirmation, tracking, details, My orders, cancelled order.
    service/      Help page, request-waiter dialog, request bill, the "requested" pages.
    status/       Restaurant-state screen (closed, paused, offline), OrderingBanner, OrderingGate.
    home/         Welcome screen.
  api/            Data access (see Data): the backend contract (contracts.ts), the transport (client.ts:
                  fetch or the mock server), typed endpoints, query keys and options, read hooks (hooks.ts),
                  write hooks (mutations.ts), the response adapter and the build-time helpers for server pages.
    mock/         The in-browser mock server: router, handlers per resource, its storage tables, seed data
                  and the backend's rules (OTP, session expiry, payment window, kitchen timing).
  context/        React Context providers (guest session and table, cart, toasts, filters, search, checkout, service requests, quick-add).
  hooks/          Reusable client hooks (useCart, useTable, useMediaQuery, useCountdown, useDishConfig…).
  lib/            Pure logic, no React and no data imports: pricing (tax engine), money, clock and phone
                  formatting, QR scan resolution, payment methods, cart-line identity, cart reducer, the
                  menu catalog, checkout validation, order display helpers, bills, safe storage. Data (a
                  branch, its rules, a Money or Clock) comes in as arguments.
  types/          Domain and API types: Branch (region rules), Restaurant (brand), Dish, MenuData, CartLine, Order…
  styles/         tokens.css (design tokens), globals.css (base styles, typography, utilities) and
                  patterns.module.css (shared CSS patterns used with `composes:`).
  fonts/          Manrope and Newsreader .woff2 files, loaded with next/font/local.
public/
  api/            Dummy API responses: restaurant.json, branches.json, branches/<id>/menu.json, orders.json,
                  help.json, content/*.json.
tests/
  apiState.tsx    Test helpers: the API JSON as fixtures, a seeded query cache, TestProviders / ApiTestProvider.
  unit/           Vitest + React Testing Library.
  e2e/            Playwright smoke tests (mobile 390px and desktop 1280px).
```

### Rules of thumb

- **Pages are thin.** A file in `app/` exports `generateMetadata` (its title and description come from the content API via `getContent`), maybe `generateStaticParams`, and renders a single view component.
- **Data comes from `src/api`.** Client components read it with the hooks (`useBranch()`, `useMenu()`, `useRegion()`, `useRestaurant()`, `useOrder(id)`…) and write through the mutation hooks (`api/mutations`); server pages use the `api/server` helpers. Nothing imports JSON directly (the one exception is `app/global-error.tsx`, which renders outside the providers), and nothing outside `api/mock` keeps server data in storage.
- **No text in JSX.** Every label, heading, message and screen-reader string comes from the content API (`useContent(ns)` / `getContent(ns)`). ESLint enforces it (`react/jsx-no-literals` plus a rule for text props such as `aria-label`), so hard-coded copy fails `npm run lint`.
- **Logic lives in `lib/` and hooks.** Components receive data and call callbacks. For example, price maths is in `lib/pricing.ts`, the cart line description ("Full · 10 pcs, Medium spicy…") is in `lib/cartLine.ts`, and filtering, sorting and search are in `lib/menu.ts`.
- **Use `'use client'` only where needed.** Components that use state, context or browser APIs are client components. Small presentational pieces (`DishRow`, `DishCard`, `PriceSummary`, `Tag`…) don't declare it themselves.

## How a request becomes a screen

1. `app/layout.tsx` loads the fonts, sets `<html lang="en">`, the theme colour and the skip link, prefetches every API query at build time (`prefetchAppData`) and wraps everything in `AppProviders` with the dehydrated cache.
2. `AppProviders` nests the providers in this order: Query (TanStack Query, outermost, so every provider below can read API data), Toast, GuestSession (table and branch), Cart, Checkout, Filters, Search, ServiceRequest, QuickAdd. `layout.tsx` imports `globals.css` first, so every component module comes after it in the cascade.
3. The route's view component renders **both** headers: `SiteHeader` (desktop) and `MobileHeader` (mobile). Each hides itself on the other side of 1024px.

## Responsive strategy (one codebase, two layouts)

The mobile layout is used below 1024px and the web layout from 1024px. There are no separate mobile and desktop pages.

| Technique                                                                                                                                                            | Where it's used                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **One DOM, CSS rearranges it.** Each component's CSS Module holds its mobile rules first, then the `olive-web.css` desktop rules under `@media (min-width: 1024px)`. | Dish rows, cart lines (CSS grid areas move the stepper and price), checkout panels, food detail. |
| **Two small variants, one hidden.** The global `.hide-mobile` and `.hide-desktop` classes.                                                                           | Headers, copy that differs ("on your phone" vs "on your device"), mobile-only action bars.       |
| **Behaviour by media query.** `useMediaQuery()` — never used for server-rendered markup.                                                                             | Tablet cart slide-over vs navigating to /cart.                                                   |

The tablet range (768–1023px) uses the mobile layout with a 2-column dish list. On tablet, tapping the cart bar opens the cart as a slide-over (`CartSlideOver`) instead of going to /cart.

Dialogs use one component, `ui/Dialog`, with a `presentation` prop: `sheet`, `modal`, `adaptive` (sheet below 1024px, modal from 1024px) or `panel` (slide-over). It handles the focus trap, Esc to close, scrim click, scroll lock and returning focus to the trigger.

## Styling

- **Tokens:** `src/styles/tokens.css` holds the `:root` variables from `olive-core.css` with their original names (`--brand-600`, `--ink-2`, `--r-lg`, `--sh-1`…), plus named scales added during the clean-up: ink alphas (`--ink-a18`…), radii (`--r-xs`…`--r-sheet`, `--r-round`), shadows (`--sh-2-up`, `--halo`, `--focus-inset`), z-index layers (`--z-nav`, `--z-dialog`, `--z-toast`…), motion (`--dur-fast`, `--ease-emphasized`…) and type shorthands (`font: var(--font-label)`). Use a token instead of a raw value; breakpoints are documented at the top of the file (360 / 768 / 1024 / 1280, max-width queries end in `.98`). `--f-ui` and `--f-display` chain the next/font variables. Each font family loads two subsets, latin and latin-ext, because the ₹ glyph is in latin-ext. Only the weights the CSS uses are loaded (Newsreader 500, Manrope 400–800).
- **Shared patterns:** `src/styles/patterns.module.css` holds repeated blocks (`clamp`, `chipRail`, `noScrollbar`, `hr`, `textLink`, `hitArea`, `checkbox`, `cover`). Use them with `composes: clamp from '@/styles/patterns.module.css';` in a single-class rule.
- **Global styles:** `globals.css` has the reset, the focus ring (`--focus`), the typography utilities (`.t-display`, `.t-h1`, `.t-body`, `.t-caption`…), `.visually-hidden`, `.hide-mobile` / `.hide-desktop`, and the reduced-motion and forced-colors overrides. Globals load first, so a component module rule beats a utility class of equal specificity on the same element; to change a utility's colour or margin inside a component, do it in the module.
- **Hover:** wrap `:hover` rules in `@media (hover: hover)` so touch screens don't get sticky hover states. Components whose own `box-shadow` would hide the global focus ring set an explicit `:focus-visible` rule.
- **Component styles:** one CSS Module per component, next to it. Class names follow the design classes (`.qty`, `.opt`, `.item`, `.ci`…) so the original CSS is easy to compare against.
- **Not allowed:** Tailwind, `!important` (the only exceptions are the reduced-motion and forced-colors overrides in `globals.css`), and inline styles. The only inline styles are truly dynamic values: Skeleton's width and height, and the styleguide's colour swatches.
- **Icons:** `<Icon name="…" />`. The mask SVGs and the typed `IconName` union are generated from `olive-core.css`; `qr` (Fonepay QR) was added for the Nepal payment methods in the same 24px / 1.8 stroke style.

## State

Server data (sessions, orders, payments, service requests) belongs to the backend: the app reads and writes it only through `src/api`, and the mock server keeps it in its own storage tables until the backend exists. Everything else is UI or device state in the browser. Anything that reads the browser (localStorage, sessionStorage, the URL) or the server-owned endpoints loads **after hydration**, so the prerendered HTML and the first client render are identical and there are no hydration warnings.

| State                                                               | Where                                                                                                  | Persistence                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API data (brand, branches, branch menus, order history, help, copy) | TanStack Query cache (`src/api`)                                                                       | Memory. Prefetched at build time and hydrated, so pages render with it; see [Data](#data) for refresh rules.                                                                                                                                                                                                |
| Server data (orders, service requests)                              | TanStack Query cache, read with `useOrder`, `useSessionOrders`, `useTableOrders`, `useServiceRequests` | Memory; refetched on mount and on returning to the tab, polled every 30 s while an order is live. The mock server's tables: see [Backend contract](#backend-contract).                                                                                                                                      |
| Cart (lines and kitchen note)                                       | `context/CartContext`: `lib/cartReducer` in a small external store                                     | localStorage `olive.cart.v2`, saved with the guest session id; a cart from another session is discarded (the guest starts empty). Validated and re-priced against the menu on load; synced across tabs.                                                                                                     |
| Guest session and table number                                      | `context/GuestSessionContext` (`useSyncExternalStore`): `useGuestSession()`, `useTable()`              | localStorage `olive.session.v1` (`{ id, branchId, table, startedAt, expiresAt, qrToken? }`), as `POST /sessions` returned it; the server decides when it expires (6 hours). A scan whose session is still opening is kept in sessionStorage `olive.pending-scan.v1`. See [Guest sessions](#guest-sessions). |
| Checkout (name, phone, the server's OTP and payment answers)        | `context/CheckoutContext`                                                                              | sessionStorage `olive.checkout.v1` (this tab only), saved with the guest session id; a new session starts a fresh checkout. It mirrors what the server said (`otp: { sentAt, resendAt, attemptsLeft, maxAttempts }`, `verified`, the open `payment`); the rules are the server's.                           |
| Waiter and bill requests                                            | `context/ServiceRequestContext` (the waiter dialog and a facade over the request hooks)                | Server data (`GET /sessions/:id/service-requests`): per guest session (another guest at the table doesn't see them), lapse after 30 minutes.                                                                                                                                                                |
| Restaurant status preview                                           | `hooks/useRestaurantStatus`                                                                            | sessionStorage `olive.status-preview.v1` (see below).                                                                                                                                                                                                                                                       |
| Menu filters and sort                                               | `context/FiltersContext`                                                                               | Memory, for the current visit.                                                                                                                                                                                                                                                                              |
| Search query (shared by the header box and the search page)         | `context/SearchContext`                                                                                | `?q=` in the URL, debounced by 250ms.                                                                                                                                                                                                                                                                       |
| Toasts ("Added · Undo")                                             | `context/ToastContext`                                                                                 | Memory. Shown in a polite live region; the timer pauses while a toast is hovered or focused.                                                                                                                                                                                                                |

**Cart hooks.** Read only what you need, so long menus don't re-render on every change:

- `useDishLines(slug)` / `useDishQuantity(slug)`: one dish's lines or total; re-render only when that dish changes.
- `useCartActions()`: `addItem`, `setQuantity`, `removeLine`, `editLine`, `setKitchenNote`, `clear`. Stable, never re-renders.
- `useCart()`: the whole cart and bill. Use it only where the whole cart is shown.

Everything read from storage goes through `lib/storage` (never throws) and a strict validator; a malformed cart line is dropped, not trusted.

### Guest sessions

Several people at one table can order separately, so every guest who scans the QR code gets their own session at that table. The QR link is `/?branch=ktm-thamel&table=12` plus an optional `&qr=<token>` (reserved for a signed table token; kept with the session but not checked yet). `branch` is optional: without it (or with an unknown id) the link is for the brand's `defaultBranchId` (GET /restaurant). `context/GuestSessionContext` reads it after hydration; the rules are pure functions in `lib/scan.ts` (`parseScan`, `resolveScan`):

- **A valid `?table`** (inside the branch's `tables` range): a live saved session at the **same branch and table** is kept (the same guest re-scanning, or a refresh); otherwise a new session starts there. Another branch is always another session (and so another cart), even at the same table number.
- **Only `?branch`:** a live session at that branch is kept; otherwise a new one starts at the branch's `defaultTable`.
- **Neither:** the live saved session is reused; if there is none, a new session starts at the default branch's `defaultTable`.
- A saved session from before branches (no `branchId`) belongs to the default branch.
- A session expires when the server says (`expiresAt`; the mock's `TABLE_SESSION_HOURS` is 6). The old `olive.table.v1` key is ignored, so a guest coming from before sessions simply gets a new one.
- When another tab on the device starts a session, every tab follows it (the cart is shared across tabs too).

New sessions come from the server: `POST /sessions { branchId, table, qrToken }` (`useStartSession()`), which answers with the session. While it's on its way the scanned branch and table are already shown (`useTable()` and the active branch follow the scan, exactly when they did before), and the scan is kept in sessionStorage (`olive.pending-scan.v1`) so a reload meanwhile opens the same session instead of falling back to the old one. Only one session opens at a time (Strict Mode's double effect reuses it), and an opening that's no longer wanted (the guest's saved session turned out to fit) is dropped. `useTable()` returns the default branch's `defaultTable` in the prerendered HTML and the first client render, the scan's or session's table after that; the **active branch** (`useBranch()`) likewise. `useGuestSession()` returns the session, or `null` before hydration and while a new one is opening; providers that work per session (cart, checkout, service requests) wait for it. Anything added to the cart meanwhile is kept when the cart loads.

Everything personal is scoped to the session id: the cart, the checkout, waiter and bill requests, and new orders (`Order.sessionId`, stamped by `buildOrder` from its input). **Ownership** is decided in one place, `isOwnOrder(order, sessionId)` in `lib/orders.ts`: an order is the guest's only if its `sessionId` matches this session. Orders without a session (the drawn order history) and other guests' orders belong to the table: they appear on the whole-table bill, never on one guest's "Just my orders" bill, so two guests at one table always get separate bills. It drives `latestOwnOrder`, `billFor` ("Just my orders", and the guest's own orders first on the whole-table bill) and the "You" label in `BillOrderList`. My orders (`myOrders`) still lists every order placed on this device, earlier sessions included: it's the same person.

#### Separate bills

Guests at one table pay separately. Each order is paid online at checkout or left for the counter; later, a guest can pay their own outstanding orders in the app:

- **Entry points.** On the bill page (`/help/bill`) and the bill-requested page, when the scope is **Just my orders** and something is payable, a primary **Pay ₹X now** button (as drawn in 21 · w21) opens `/help/bill/pay`. The existing actions stay as secondary ones. On **Whole table** there's no Pay button: the server brings that bill, and one guest never pays other guests' orders in the app.
- **What's payable.** `payableOrders(orders, sessionId)` (`lib/service.ts`): unpaid orders stamped with **this** guest session, i.e. placed on this device in this session. `billFor(…, 'mine', …)` returns them as `payable` / `payableTotal` (always empty for `'table'`). The drawn order history has no `sessionId`, so a history order that counts as "yours" (e.g. #A097 at table 12) still shows on "Just my orders" and in its balance, but can't be paid here; the server settles it.
- **Paying.** `PayBillView` lists the payable orders (`BillOrderList`), the amount due (`BillTotals`) and the branch's bill methods (`checkout/PaymentMethods`, shared with the checkout payment step). **Pay** opens a payment (`usePayBill().startPayment` → `POST /payments { purpose: 'bill', orderIds }`; the server keeps only this session's unpaid orders and works out the amount) and shows a processing state with the same **Prototype: success / failure** links as checkout, which stand in for the payment partner (`POST /payments/:id/simulate`). Failure keeps the orders unpaid and offers **Try again** (a new payment) or **Change payment method**. Success makes the server mark the orders paid (`{ method: 'online', status: 'paid', detail: 'UPI' | 'Card' | 'eSewa'…, transactionRef }`, only unpaid ones) and settle a pending **Just my orders** bill request (a whole-table request still stands for the others); the app refreshes the orders and requests and shows **Bill paid** with the amount, method and orders. The bill then shows those orders as paid and the Pay button disappears.
- **Guards.** Nothing payable (or no session yet) shows "Nothing to pay" with a link back to the bill; if another tab paid meanwhile, the server answers `nothing_to_pay` and the bill is re-read. A repeat tap records one payment (`usePayBill` returns the first result to later calls, and the server never re-marks a paid order). Offline (`useOrderingAvailability`) shows an alert banner and disables Pay; closed or paused doesn't block paying for food already ordered. The processing, failed and paid states move focus to their heading and announce through live regions.
- **Mock limitation.** The mock server runs on each phone, so new orders take IDs from a pool per device (two phones can both get #A105) and a table's bill only knows this device's orders plus the drawn history. A real backend hands out unique IDs and knows every guest's orders.

### Cart line identity

A cart line's key is built from dish + variant + sorted add-ons + options + sorted instructions + the normalised note (`lib/cartLine.ts › lineKey`). Adding the same configuration again increases that line's quantity, and editing a line so it matches another merges the two.

### Pricing (tax engine)

Menu prices are whole major units of the branch's currency, excluding tax. `calculateBill(lines, branch)` (`lib/pricing.ts`) works in minor units (paise) from `branch.tax`:

1. **Service charge** (`tax.serviceCharge`, if any) at `rateBp` on the item total.
2. **Each tax line** at `rateBp` on its `base`: `items` or `itemsPlusService`. A line with `splitInto` (GST → CGST + SGST) is computed once, then split by the parts' rates; an odd paisa goes to the first part.
3. **Round** the total to `rounding.unit` (100 = whole rupee), half up; the difference is the round-off line.

It returns `{ itemTotal, itemTotalMinor, lines: BillLine[] ({ id, labelKey, vars: { rate }, amountMinor, parts? }), serviceCharged, roundOffMinor, totalMinor, total }`. `PriceSummary` renders it with labels from `cart › priceSummary.lines.<labelKey>`: **split** shows parts (India: CGST, SGST, "Service charge · Not added" — only when the branch adds no service charge — and Round off), **receipt** the same without "Not added", **combined** each line whole (CGST + SGST 5%), **compact** everything on one line (`tax.compactLabelKey`: "GST 5% + round off").

| Branch                    | Rules                                                           | Example                                                         |
| ------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| India (`blr-indiranagar`) | GST 5% on items, split CGST 2.5% + SGST 2.5%; no service charge | ₹1,356 → ₹1,424 (+₹0.20), ₹549 → ₹576 (−₹0.45), ₹958 → ₹1,006   |
| Nepal (`ktm-thamel`)      | Service charge 10% on items, then VAT 13% on items + service    | रू 2,280 → service रू 228 → VAT रू 326.04 → रू 2,834 (−रू 0.04) |

### Checkout flow

1. **Details:** the name is required, and the mobile number must match the branch's `mobile` rules (`lib/phone.ts`): India 10 digits starting 6–9 (shown "98765 43210", no dial-code box, as drawn); Nepal 10 digits starting 97 or 98 (shown "984-1234567" beside a +977 box). The prefix error is per country (`checkout › details.errors.phonePrefix.<country>`). **Send OTP** calls `POST /otp` (`CheckoutContext.submitDetails`) and moves on once the code is sent.
2. **Verify:** the server checks the code (`POST /otp/verify`; the mock's code is `123456`, with `OTP_ATTEMPTS` and `OTP_RESEND_SECONDS` in `api/mock/rules.ts`). The app only checks all six digits are there. A wrong code shows the error with the attempts the server says are left (3 in total). Resend (`POST /otp` with `resend: true`) unlocks after 30 seconds or after a wrong code; the server refuses an early one (`otp_resend_too_soon`) and the countdown follows the server's `resendAt`. A number verified earlier in the session stays verified when it's sent again.
3. **Payment:** the branch's methods (`branch.payments.checkout`: India "Pay online now" + counter; Nepal eSewa, Khalti, Fonepay QR, card, counter). An online method opens a payment request (`usePayCheckout().start` → `POST /payments { purpose: 'order', lines }`; the server prices the cart and opens a 4:32 window) and then shows `/checkout/processing` (the copy names the method: "Approve the request in your eSewa app"); **Pay at the counter** places the order immediately. The order records the method's name (`common › paymentMethods`).
4. **Processing:** the "Prototype: success" and "Prototype: failure" links stand in for the payment partner (`POST /payments/:id/simulate`). The request also fails by itself when the server's window (`expiresAt`) runs out. **Cancel payment** goes to the cancelled state; **Try again** opens a new request. Without an open request the page goes back to the payment step.
5. **On success:** `usePlaceOrderState()` places the order (`POST /orders` with the payment's id; the server takes the table from the session, prices the lines from its menu and checks the payment covers exactly that amount) and redirects to `/order/<id>/confirmed`, which shows it straight from the cache. It ignores repeat taps while an order is being placed (use its `placing` flag to disable the buttons) and never places an empty order. The confirmation page then empties the cart (`useFinishPlacedOrder`). On failure or cancel, the cart is never touched.

If the server doesn't answer (a network error, not a "no"), the guest sees an error toast (`common › error.requestFailed`) and stays where they are; this never shows in the normal flow.

A **Pay at the counter** order stays unpaid on the bill; the guest can settle it later from the bill page with **Pay ₹X now** (see [Separate bills](#separate-bills)).

`useCheckoutGuard` redirects a guest who lands mid-flow: an empty cart goes to /cart, a missing number goes to details, and an unverified number goes to verify. Payment and processing both use the `'pay'` step, so the processing page can't be reached without a verified number.

### Order tracking

The server reports each order's live status (`GET /orders/:id`). In the mock, orders placed through it move along by time since they were placed (the mock kitchen, `api/mock/kitchen.ts › simulateOrder`): received, preparing from 2 min, ready from 18, served from 22, and carry `live: true` until served. `useOrder(id)` polls every 30 s (`TRACK_REFRESH_MS`) while the order is `live`, and refetches when the guest comes back to the tab; "Updated 7:42 PM" is when the server last answered. A hidden live region announces status changes only. The drawn mock orders keep their drawn status and aren't live.

Layout on every screen size: the status card (status, ETA, one sentence), then a horizontal four-step progress card (`order/TrackStepper`: Received → Preparing → Ready → Served, left to right, so it fits a 360px phone without scrolling), then the items card. Once received, Received is done and Preparing shows as **Up next** until the kitchen starts. The vertical `TrackTimeline` is only used for cancelled orders.

### Restaurant status and connectivity

`useOrderingAvailability()` (`hooks/useRestaurantStatus.ts`) combines the active branch's `status` (GET /branches, `useBranch()`) with `navigator.onLine` (`useOnlineStatus`) and returns `{ state: 'open' | 'closed' | 'paused' | 'offline', status, canAdd, canCheckout, retry }`.

- **Closed:** the menu stays browsable but read-only (ADD shows "Closed"); `/` and checkout show the closed screen.
- **Paused:** the cart still works, but checkout shows "Our kitchen needs a moment" with **Call a waiter**.
- **Offline:** overrides any status for checkout; browsing pages show an alert banner and **Try again** re-checks.

`OrderingGate` replaces `/` and every checkout route with `StatusScreen` when the state isn't open, and `OrderingBanner` sits under the headers on menu, category, search, cart and food detail. Preview any state with `?status=closed|paused|offline` on any page (kept for the tab); `?status=open` clears it. All of this reads after hydration, so the prerendered HTML is the open state.

The mock server numbers new orders from a pre-rendered pool (`newOrderIds` in GET /orders: `A105`–`A124`), because a static export can only serve pages that exist at build time.

## Data

All data comes through the API layer in `src/api`. There is no backend yet, so:

- **Reference data** comes from dummy JSON files in `public/api/`, which the static site serves like real endpoints (`GET /api/menu.json`). They're listed below.
- **Server-owned data** (sessions, OTP, orders, payments, service requests) comes from the in-browser mock server (`api/mock`), which answers the [backend contract](#backend-contract) exactly as the backend will.

`api/client.ts` is the transport: `apiGet`, `apiPost`, `apiPatch` and `apiDelete` hand each request to the mock server when `NEXT_PUBLIC_API_MOCK` isn't `"false"` (the default) and it owns the endpoint; anything else is a `fetch` to `NEXT_PUBLIC_API_BASE_URL`. A non-2xx answer throws `ApiError` with the server's error code (`isApiError(error, 'otp_wrong_code')`). Components never call the transport: they use the read hooks (`api/hooks.ts`) and the write hooks (`api/mutations.ts`), which call the typed endpoints in `api/endpoints.ts`.

### Endpoints (reference data)

| Endpoint                 | File                                 | Contents                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /restaurant`        | `public/api/restaurant.json`         | `Restaurant`, the brand: name, tagline, `defaultBranchId` and social links.                                                                                                                                                                                                                                                                                                         |
| `GET /branches`          | `public/api/branches.json`           | `Branch[]`: per location its name, address, phone, hours, status (`open` / `closed` / `paused`), tables, prep time, and the region rules (locale, currency, time zone, mobile rules, tax, payment methods, dietary marks). See [Branches and regions](#branches-and-regions).                                                                                                       |
| `GET /branches/:id/menu` | `public/api/branches/<id>/menu.json` | `MenuData`: 7 categories and 56 dishes (defaults filled in, `rank` = position in its category), plus `chefsPicks` (picks rail order), `popularSearches`, `cartSuggestions`, `trendingTonight` and `popularAtTable`. Every dish, price and option shown in the designs is reproduced exactly; dishes not drawn in the designs bring each category up to the counts the designs show. |
| `GET /orders`            | `public/api/orders.json`             | `OrdersResponse`, the mock server's seed: `history` (the mock orders drawn in the designs: A104, A097, A101, A098, A061, A033, A029, each with its `branchId`) and `newOrderIds` (the pool for orders placed on this device). Screens never read it; they read orders through the backend contract. Also lists the order pages to prerender.                                        |
| `GET /help`              | `public/api/help.json`               | `HelpTopics`: the Payment help and Allergens & FAQs dialogs.                                                                                                                                                                                                                                                                                                                        |
| `GET /content/<ns>`      | `public/api/content/*.json`          | Screen copy, one namespace per area (`useContent(ns)`).                                                                                                                                                                                                                                                                                                                             |

### Queries, hooks and server helpers

| Query (`api/queries.ts`) | Key                        | staleTime                                                    | Hook (`api/hooks.ts`)                                                                              |
| ------------------------ | -------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `restaurantQuery()`      | `['restaurant']`           | Infinity                                                     | `useRestaurant(): Restaurant` (the brand)                                                          |
| `branchesQuery()`        | `['branches']`             | 60 s, also refetched on window focus (the status can change) | `useBranches(): Branch[]`, `useBranch(): Branch` (active), `useRegion(): { money, clock, mobile }` |
| `branchMenuQuery(id)`    | `['branches', id, 'menu']` | Infinity                                                     | `useMenu(): MenuCatalog` (the active branch's)                                                     |
| `orderHistoryQuery()`    | `['orders', 'history']`    | Infinity                                                     | none: the mock server's seed (`api/mock/seed.ts`)                                                  |
| `helpQuery()`            | `['help']`                 | Infinity                                                     | `useHelpTopics(): HelpTopics`                                                                      |
| `contentQuery(ns)`       | `['content', ns]`          | Infinity                                                     | `useContent(ns): Translator`                                                                       |

Server-owned reads use `useQuery` (they load on the client: `pending` in the prerendered HTML and the first render, so they never mismatch), are never stale for long (`staleTime: 0`, refetched on mount and when the guest returns to the tab) and are updated by the mutations:

| Query (`api/queries.ts`)              | Key                                  | Polling                 | Hook (`api/hooks.ts`)               | Used by                                          |
| ------------------------------------- | ------------------------------------ | ----------------------- | ----------------------------------- | ------------------------------------------------ |
| `orderQuery(id)`                      | `['orders', 'detail', id]`           | 30 s while `order.live` | `useOrder(id)`                      | `useLiveOrder` (confirmation, tracking, details) |
| `sessionOrdersQuery(sessionId)`       | `['orders', 'session', sessionId]`   | 30 s while any is live  | `useSessionOrders(sessionId)`       | `useLiveOrderList` (My orders)                   |
| `tableOrdersQuery(branch, table, on)` | `['orders', 'table', branch, table]` | none                    | `useTableOrders(branch, table, on)` | `useTableVisit` (Help, bill, Pay my bill)        |
| `serviceRequestsQuery(sessionId)`     | `['service-requests', sessionId]`    | none                    | `useServiceRequests(sessionId)`     | `ServiceRequestContext`                          |

| Mutation (`api/mutations.ts`)    | Endpoint                        | Afterwards                                                                 | Used by                        |
| -------------------------------- | ------------------------------- | -------------------------------------------------------------------------- | ------------------------------ |
| `useStartSession()`              | `POST /sessions`                | (retried twice)                                                            | `GuestSessionContext`          |
| `useSendOtp()`, `useVerifyOtp()` | `POST /otp`, `POST /otp/verify` |                                                                            | `CheckoutContext`              |
| `useCreatePayment()`             | `POST /payments`                | `nothing_to_pay` re-reads the orders                                       | `usePayCheckout`, `usePayBill` |
| `useSimulatePayment()`           | `POST /payments/:id/simulate`   | a paid bill caches the paid orders and refreshes orders and requests       | `usePayCheckout`, `usePayBill` |
| `useCreateOrder()`               | `POST /orders`                  | caches the new order (the confirmation shows at once), refreshes the lists | `usePlaceOrderState`           |
| `useCreateServiceRequest()`      | `POST /service-requests`        | adds it to the session's pending list                                      | `ServiceRequestContext`        |
| `useCancelServiceRequest()`      | `DELETE /service-requests/:id`  | removed from the list straight away; restored if the server refuses        | `ServiceRequestContext`        |

- **Build-time prefetch.** `app/layout.tsx` runs `prefetchAppData` (`api/server.ts`), which reads every endpoint from `public/api` (every branch's menu included, so any branch renders from the cache) and dehydrates the cache into the page. Every page is prerendered with its data and the hooks use `useSuspenseQuery`, so `data` is never undefined, nothing flashes and nothing mismatches on hydration. In the browser, the restaurant query refreshes in the background once it's older than a minute.
- **Server pages** (`generateStaticParams`, `generateMetadata`) use `getDishSlugsServer()` / `getCategoryIdsServer()` (the union over every branch's menu), `getDishServer(slug)` / `getCategoryServer(id)` (metadata, default branch first) and `getOrderIdsServer()` from `api/server.ts`. Page bodies pass only the slug or id: `DishDetail` and `CategoryView` read the dish from the guest's branch menu (`NotOnMenu` if that branch doesn't serve it).
- **The menu catalog.** `createMenuCatalog(data)` (`lib/menu.ts`) wraps a menu response with lookups: `getDish`, `getCategory`, `dishesIn`, `categoryCount`, `categoryCountLabel`, `featuredDishes`, `searchDishes`. It's built once per response object (a `WeakMap`), so `useMenu()` returns the same catalog until the menu changes. Pure helpers that need no data (`startingPrice`, `applyFilters`, `sortDishes`, `highlight`…) stay plain functions.
- **The orders adapter.** `api/adapters.ts › toOrderHistory(raw, branch)` keeps the branch's orders and turns them into `Order`s. A real backend sends an ISO `placedAt`, which passes through untouched. The dummy JSON can't date its "today" orders, so those send `"placedAt": null` and `"placedRelative": { "daysAgo": 0, "time": "19:42" }`, which the adapter dates on today's day in the branch's time zone. The cache keeps the response as sent and the mock server adapts it on every read, so these dates are worked out in the browser rather than frozen at build time.
- **Lib functions take data as arguments and never hard-code words or region rules:** `calculateBill(lines, branch)`, `validateDetails(name, phone, branch.mobile)`, `itemLabel(item, menu)`, `billFor(orders, scope, sessionId)`, `payableOrders(orders, sessionId)`, `isOwnOrder(order, sessionId)`. The same holds for the mock server's rules (`api/mock`): `buildOrder(input, menu, labels, branch)`, `priceLines(lines, menu)`, `nextOrderId(placed, newOrderIds)`, `simulateOrder(order, now, clock)`, `tableOrders(orders, table, now, clock)`, `guestOrders(placed, history)`, `markOrdersPaid(orders, ids, payment)`. Functions that used to return text now return a key the component translates (`paymentLabel`, `totalLabel`, `validateDetails`, `wrongCodeError`, `unavailableReason`, `filterSummaryKind`) or take the words as an argument (`describeOptions(dish, line, labels)` with `useCartLineLabels()`, `formatAddOnPrice(amount, freeLabel)`).

### Screen copy (content API)

All on-screen text lives in `public/api/content/<namespace>.json`, one endpoint per area: `common` (UI kit, header, nav, errors), `home`, `menu`, `cart`, `checkout`, `orders`, `service`, `status`. Keys are nested by screen (`checkout.json › verify.title`) and type-checked from the JSON, so a missing key is a compile error.

```tsx
const t = useContent('checkout');
t('verify.title'); // "Verify your number"
t('summary.eta', { time: prepTime }); // fills {time}
t.plural('itemCount', 3); // { one, other } → "3 items"
t.rich('verify.sentTo', { b: (c) => <b>{c}</b> }, { phone }); // "…to <b>{phone}</b>"
t.get('faq.items'); // raw lists/objects
```

Server code uses `const t = await getContent('orders')`. Unit tests wrap components in `TestProviders` (`tests/apiState.tsx`), which seeds every namespace from the same JSON. To change wording, edit the JSON; the backend can later serve the same shape (and per-language variants).

### Branches and regions

Every rule that differs by place is data on the branch (GET /branches, `types/branch.ts`); content keys it names point into the global English copy. Adding a region means adding a branch, its menu file and the copy its keys name — no component changes. `tests/unit/branches.test.ts` checks every key the data names exists.

| Concern                | Data                                                                                                   | Code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Money                  | `locale`, `localeFallback`, `currency { code, symbol, minorUnit }`                                     | `lib/money.ts › createMoney(branch)`: `format` ("₹1,424", "रू 2,280"), `formatMinor`, `formatSignedMinor`, `addOnPrice`. Intl formats; the configured symbol replaces Intl's. Where the runtime has no number data for the locale (en-NP resolves to "en", western grouping) `localeFallback` (en-IN) is used. India output is exactly as before.                                                                                                                                                                   |
| Time                   | `timezone`, `locale`                                                                                   | `lib/clock.ts › createClock(branch)`: `time` ("7:42 PM", always upper-case AM/PM as drawn), `date` ("12 Sep 2026"), `dayKey` / `isSameDay` ("today" is the branch's today), `localTimestamp`.                                                                                                                                                                                                                                                                                                                       |
| Phone                  | `mobile { dialCode, length, pattern, groups, separator, showDialCode }`                                | `lib/phone.ts`: `formatMobile`, `mobileDigits`, `mobileError`, `mobileInputLength`; `PhoneInput rules={mobile}`.                                                                                                                                                                                                                                                                                                                                                                                                    |
| Tax                    | `tax`                                                                                                  | `lib/pricing.ts` (see [Pricing](#pricing-tax-engine)).                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Payments               | `payments { checkout, bill }`: `{ id, labelKey, recommended? }[]`                                      | `lib/payments.ts › PAYMENT_METHODS` (every known method's icon, settlement and approval kind); copy in `checkout › payment.methods.<labelKey>`, `service › payBill.methods.<labelKey>`, names in `common › paymentMethods.<id>`.                                                                                                                                                                                                                                                                                    |
| Dietary                | `dietary.marks` (`veg`, `nonveg`)                                                                      | Filter chips and the sidebar loop over the marks; `VegMark` drawing unchanged; copy in `menu › filters.diet.<mark>`.                                                                                                                                                                                                                                                                                                                                                                                                |
| Price filter           | `priceFilter` in the branch menu                                                                       | "Under ₹400" / "Under रू 650".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Hours, status, contact | `opensAt`, `closesAt`, `serviceWindows`, `status`, `phone`, `phoneHref`, `wifiName`, `paymentPartner`… | Headers, Welcome, Help hours, closed / paused / offline screens.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Region words in copy   | `currency.nameKey`, `tax.invoiceKey`, `payments.atTable`                                               | `hooks/useRegionCopy` fills `{currencyName}` ("rupees", `common › currencyNames`), `{taxInvoice}` ("GST invoice" / "VAT invoice", `service › region.taxInvoice`) and `{paymentMethods}` (how the printed bill can be paid, listed with `Intl.ListFormat` in the branch's number locale: "card, UPI or cash" / "card, eSewa, Khalti, Fonepay QR or cash", `service › region.atTable`) in global copy: the cart's screen-reader labels, the bill hint and the Help topics (`help.json`, filled by `HelpTopicDialog`). |

Components get the active branch with `useBranch()` and its formatters with `useRegion()` (`{ money, clock, mobile }`, memoised per branch object); pure lib functions take a `Branch`, `Money` or `Clock` argument. No currency symbol, locale, time zone, dial code, tax rate or payment method is hard-coded in `src` (only doc-comment examples mention them).

### Backend contract

Every write and every server-owned read, as `api/contracts.ts` types and documents them (request and response types, JSDoc per endpoint). The mock server implements exactly this; the backend implements the same and the app doesn't change. Paths are relative to `NEXT_PUBLIC_API_BASE_URL`; bodies are JSON; a failure is a non-2xx status with `{ error: ApiErrorCode, attemptsLeft?, resendAt? }`.

| Endpoint                                  | Body                                                                                                   | Response                                                                                                      | Errors                                                                                                                 | Rules the server owns                                                                                                                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /sessions`                          | `{ branchId, table, qrToken? }`                                                                        | 201 `GuestSession` `{ id, branchId, table, startedAt, expiresAt, qrToken? }`                                  | 400 `invalid_request`                                                                                                  | Checks the signed QR token (the mock keeps it unchecked); table in the branch's range; expiry (mock: 6 hours).                                                                                                  |
| `POST /otp`                               | `{ sessionId, phone, resend? }`                                                                        | 200 `{ phone, sentAt, resendAt, attemptsLeft, maxAttempts, verified }`                                        | 400, 404 `session_not_found`, 409 `otp_not_sent`, 429 `otp_resend_too_soon` (`resendAt`)                               | Number valid for the branch; resend cooldown (30 s, or at once after a wrong code); a verified number stays verified.                                                                                           |
| `POST /otp/verify`                        | `{ sessionId, phone, code }`                                                                           | 200 `{ verified: true }`                                                                                      | 409 `otp_not_sent`, 422 `otp_wrong_code` (`attemptsLeft`, `resendAt`), 423 `otp_locked`                                | The code (mock: `123456`), 3 attempts per code.                                                                                                                                                                 |
| `POST /orders`                            | `{ sessionId, customerName, method, kitchenNote, lines: (LineConfig & { quantity })[], paymentId? }`   | 201 `Order` (with `live`)                                                                                     | 402 `payment_required`, 403 `phone_not_verified`, 409 `payment_conflict`, 422 `empty_order`, 503 `order_ids_exhausted` | Branch and table from the session (never the body); prices from the menu and the branch's taxes; an online method needs a succeeded payment for exactly that amount; order numbers (mock: the per-device pool). |
| `GET /orders/:id`                         |                                                                                                        | 200 `Order` with its live status, item statuses, ETA, timeline, `live`                                        | 404 `not_found`                                                                                                        | The kitchen's progress (mock: by time since placing).                                                                                                                                                           |
| `GET /sessions/:id/orders`                |                                                                                                        | 200 `{ orders }`, newest first                                                                                | 404 `session_not_found`                                                                                                | The guest's orders at the session's branch: their sessions' (mock: every session on this device) and their order history.                                                                                       |
| `GET /tables/:branchId/:table/orders`     |                                                                                                        | 200 `{ orders }`, newest first                                                                                | 404 `not_found`                                                                                                        | This visit's orders at the table (today in the branch's time zone, not cancelled), every guest's.                                                                                                               |
| `POST /payments`                          | `{ purpose: 'order', sessionId, method, lines }` or `{ purpose: 'bill', sessionId, method, orderIds }` | 201 `Payment` `{ id, purpose, sessionId, method, amount, status: 'pending', createdAt, expiresAt, orderIds }` | 404 `session_not_found`, 409 `nothing_to_pay`, 422 `empty_order`                                                       | The amount (from the lines, or the session's own unpaid orders among `orderIds`); the method must be one of the branch's online ones; the window (mock: 4:32).                                                  |
| `POST /payments/:id/simulate` (mock only) | `{ outcome: 'succeeded' \| 'failed' }`                                                                 | 200 `{ payment, orders }` (bill: the orders now paid)                                                         | 404 `not_found`, 409 `payment_conflict` (not pending, or expired)                                                      | Stands in for the payment partner's webhook. A paid bill marks only still-unpaid orders and settles the session's "Just my orders" bill request.                                                                |
| `POST /service-requests`                  | `{ sessionId, kind: 'waiter', reason, note? }` or `{ sessionId, kind: 'bill', scope }`                 | 201 `{ request, created: true }`, or 200 with the pending one (`created: false`)                              | 404 `session_not_found`                                                                                                | One pending request of each kind per session; the table from the session; the bill's balance; notes trimmed to 80 characters; requests lapse after 30 minutes.                                                  |
| `DELETE /service-requests/:id`            |                                                                                                        | 204                                                                                                           | 404 `not_found`                                                                                                        |                                                                                                                                                                                                                 |
| `GET /sessions/:id/service-requests`      |                                                                                                        | 200 `{ requests }`                                                                                            |                                                                                                                        | Only that session's pending requests.                                                                                                                                                                           |

Planned with later phases: `PATCH /orders/:id` (change), `POST /orders/:id/cancel`, `POST /orders/:id/items` (running order), `POST /promos/validate`, `POST /delivery/quote`.

**The mock server** (`api/mock`): `server.ts` routes method + path to a handler (`handlers/sessions`, `otp`, `orders`, `payments`, `serviceRequests`), answers after a fixed delay per endpoint within `NEXT_PUBLIC_API_MOCK_LATENCY_MS` (default 200–400 ms, 0 in unit tests) and round-trips bodies through JSON like the wire. Handlers read their reference data through `seed.ts` (the dummy JSON, from the query cache) and keep their tables in Web Storage (`db.ts`, validated on every read): `olive.mock.sessions.v1`, `olive.mock.otp.v1`, `olive.orders.v1` and `olive.mock.payments.v1` in localStorage, `olive.service.v1` in sessionStorage (orders and requests keep the keys the app used before, so a device's orders carry over). The backend's rules are in `rules.ts` and `kitchen.ts`. Because it runs on each device, a table's bill only knows this device's orders plus the drawn history, and order numbers come from a pool per device. Sessions saved on the device before the mock existed (or seeded by tests) are adopted from `olive.session.v1`.

### Switching to a real backend

1. Set `NEXT_PUBLIC_API_MOCK=false`, `NEXT_PUBLIC_API_BASE_URL` to the API's base URL and `NEXT_PUBLIC_API_SUFFIX` to `""` (defaults: on, `/api` and `.json`). Every request then goes to `https://…/orders` (and the mock server isn't loaded at all).
2. Implement the [backend contract](#backend-contract). With real order data, history orders carry their `sessionId` too, so they become payable like any other.
3. Replace the prototype success / failure links with the payment partner's flow: poll `GET /payments/:id` (or subscribe) and settle by webhook instead of `POST /payments/:id/simulate`.
4. In `api/server.ts`, replace `readApiFile` with `apiGet` for build-time reads (or drop the build-time prefetch if pages become dynamic), and serve order pages by id rather than from the prerendered pool.
5. Send real `placedAt` timestamps; `placedRelative` and the adapter branch for it can then go.
6. Serve `GET /content/<namespace>` with the same keys as `public/api/content/*.json` (a CMS or a translations table works well).

To change the dummy data, edit the JSON in `public/api/`. The types in `src/types` describe each response.

Portions can number one, two, three or more. The portion picker adapts: 1 → full width, 2 → two up, 3 → three up (name over the piece count), 4+ → a two-column grid. Menu cards show the cheapest portion as the starting price (`startingPrice`). Three filler dishes carry dummy portion data so these cases can be checked: **Chicken Dum Biryani** (Quarter / Half / Full), **Gulab Jamun** (four portions) and **Mango Lassi** (a single size plus a sweetness choice).

### Option types

| Field on a dish                       | What the guest sees                                                                               | Example                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `variants`                            | Required size / portion (1–4+ tiles)                                                              | Half / Full, Quarter / Half / Full         |
| `optionGroups` with plain strings     | Free single choice as chips                                                                       | Spice level, sweetness                     |
| `optionGroups` with `{ name, price }` | Priced single choice as rows ("Included" / "+₹90")                                                | Chettinad Curry protein, latte almond milk |
| `addOns`                              | Multi-select extras, optional `maxAddOns`                                                         | Extra parmesan                             |
| `removables`                          | "Leave out" chips: _No onion_, _No garlic_ (free)                                                 | Butter Chicken, Paneer Lababdar            |
| `combo` + `optionGroups`              | Meal: one row group per slot (curry, bread, rice, drink), upgrades priced, "Meal · Save ₹X" badge | Veg Thali, Non-veg Thali                   |

**Size-dependent options.** Add-ons, option groups and individual choices take `availableFor: [variantIds]` (e.g. the latte's extra shot only on Medium/Large; the gluten-free base only on the 10" pizza). Add-ons take `priceByVariant` (Burrata ₹120 on 10", ₹160 on 13"). When the guest changes size, `normaliseConfig` (`lib/options.ts`) drops anything the new size doesn't offer and re-defaults affected choices. Option groups with `showInSummary` (meal slots, protein) are always listed in the cart; others only when not the default. Removals are part of a cart line's identity.

To add a dish, add an object to `dishes` in each branch's `public/api/branches/<id>/menu.json` (prices in that branch's currency), with its `categoryId` and a `rank` (its position in the category, which sets its "Recommended" order). A dish with `variants`, `optionGroups` or `addOns` counts as customisable:

- With an `image`, its ADD button opens the food-detail page.
- Without an image, ADD opens the quick-add sheet or modal.
- A dish with no options is added straight away with an Undo toast.

## Accessibility notes

- **Semantics:** real `<button>` and `<a>` elements throughout; every input has a label; icon buttons need a `label` prop (it's required in the types).
- **Focus and touch:** visible focus rings (`--focus`); touch targets of at least 44px (small controls extend their hit area with `::before`).
- **Option controls:** variant and add-on rows use `role="radio"` / `role="checkbox"` with `aria-checked`, as in the design markup. Radio groups support the arrow keys.
- **Veg / non-veg:** always shown by shape (a dot or a triangle) as well as colour, and announced as "Vegetarian" or "Non-vegetarian".
- **Live regions:** toasts, quantity changes, filter result counts and order status changes use `aria-live`. The OTP resend timer announces only when the countdown starts and when resend becomes available, not every second.
- **Toasts:** hovering or focusing a toast pauses it, so the Undo action can be reached by keyboard (WCAG 2.2.1).
- **Motion:** `prefers-reduced-motion` turns off animations.
- **Contrast:** all text pairings are ≥ 4.5:1. Disabled button text uses `--disabled-ink` (5.2:1) instead of the design's #9A8A80 (2.7:1).

## Testing

| Command            | What it runs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`         | Vitest (fixtures come from `public/api` through `tests/apiState.tsx`, which also builds a mock server over the test's storage with `createTestServer(clock)`; the mock answers at once, `NEXT_PUBLIC_API_MOCK_LATENCY_MS=0`): every mock-server endpoint and the transport (`mockServer.test.ts`, including `fetch` when `NEXT_PUBLIC_API_MOCK=false`), the server-owned hooks with `TestProviders` (`apiHooks.test.tsx`), region-neutral copy (`regionCopy.test.tsx`), API adapter, branch data integrity, QR scan resolution, menu catalog, the tax engine (India and Nepal), PriceSummary per branch, money / clock / phone formatting (INR and NPR, Kolkata and Kathmandu, +91 and +977), cart reducer and cart store, cart-line descriptions, menu queries and search, checkout validation, orders and tracking, paying a bill (`markOrdersPaid`, `payableOrders`, `billFor` after payment, `usePayBill`), service requests, restaurant status, guest sessions, hooks, toasts, OtpInput, QuantityStepper.                            |
| `npm run test:e2e` | Playwright against the built `out/` folder, at 390px and 1280px: happy path, failed payment, quick-add (`happy-path.spec.ts`), orders (`orders.spec.ts`), help and service requests (`service.spec.ts`), guest sessions (`sessions.spec.ts`: two guests at one table), separate bills (`separate-bills.spec.ts`: two guests at one table pay their own bills), restaurant states (`states.spec.ts`) and branches (`branches.spec.ts`: a Nepal QR code — रू prices, service charge + VAT bill, +977 validation, eSewa / Khalti / Fonepay, Kathmandu time — paying a Nepal bill with Khalti with the copy naming Nepal's ways to pay and its VAT invoice, and India staying the default). Every flow runs through the mock server with its normal latency; a test that reloads right after adding to the cart waits for the cart to be saved (`tests/e2e/helpers.ts`), since a new guest session opens a moment after the first page load. Run `npm run build` first. It uses the installed Google Chrome; set `PW_CHANNEL=chromium` on CI. |

If `tsc` reports TS2344 in `.next/dev/types/validator.ts` after you add a route `layout.tsx`, delete the stale `tsconfig.tsbuildinfo`.

## Where the build differs from the design

1. **Categories:** the mobile tabs in the designs (Breads, Rice) and the web sidebar (Pizza, Breads & Rice) disagree. The web set is used everywhere.
2. **Filler dishes:** dishes not drawn in the designs were added to `menu.json` so the category counts match the designs.
3. **Margherita:** the Wood-fired Margherita stays under Mains, as drawn in 03 / w03.
4. **Past orders:** in the mock orders, line prices are chosen so the drawn totals come out exactly (₹318, ₹756…). Every menu price ends in 9, so those totals can't be made from current prices.
5. **Disabled buttons:** the text colour is darker, for contrast.
6. **Warmer background:** at the client's request, `--bg` was deepened from #F7F2EA to #F3E8D8 so cards and inputs stand out. `--surface`, `--sand`, `--line` and `--line-strong` were adjusted to match, and `--ink-3` and `--brand-600` darkened slightly to keep every text pairing at 4.5:1 or better.
7. **Dial-code box:** it has no dropdown chevron, because each branch has one country. India's checkout hides it, as drawn; Nepal's shows +977 (`mobile.showDialCode`).
8. **OTP screen:** one centred column on every screen size, with a phone-and-SMS illustration (`checkout/OtpIllustration`). Sizes and gaps scale with the window height (`dvh`), so the step never scrolls, even with an error showing. The "One-time code" label is kept for screen readers only.
9. **After adding from food detail:** the guest returns to where they came from, with an Undo toast, instead of jumping to the cart as the static prototype links do.
10. **Mobile sort:** sorting on mobile opens a bottom sheet, so the scrolling chip row doesn't clip the menu. On desktop it's a dropdown.
11. **Search suggestions:** at the client's request there are no recent searches. Before typing, every device shows Trending tonight (dish cards with photos), Popular searches and icon tiles for all categories.
12. **Closed state banner:** the browsing pages get an error-tone banner while closed, since the design draws none. The closed status card uses 20px side padding below 375px.
13. **Request bill:** a full page, as drawn in 20 · w20. "Pay ₹X now" (21 · w21) appears only for **Just my orders**, pays only the guest's own orders placed on this device, and opens a dedicated Pay my bill page rather than the checkout payment step; "Payment options" is kept as a third, quieter action. The design has no Pay my bill screens, so they reuse the bill page layout, the checkout payment-method cards and the processing / failed / confirmation patterns.
14. **Order details:** item counts are quantities (A104 reads "4 items", matching its "Items (4)" bill line), and a cancelled order from today stays in My orders under This visit.
15. **Empty-cart suggestions:** an added suggestion stays and turns into a stepper instead of disappearing, so keyboard focus isn't lost.
16. **Follow us (Help page):** not in the design. A card under the opening hours links to the restaurant's social profiles (`social` in GET /restaurant, `public/api/restaurant.json`: Instagram, Facebook, YouTube, X), each opening in a new tab. The brand marks are in the icon set (`instagram`, `facebook`, `youtube`, `xbrand`). The links point at the platforms' home pages until the real profiles are filled in.
17. **Nepal branch:** not in the design. It reuses every screen with its own data: "The Olive Table — Thamel" (the mobile header truncates it with an ellipsis at 390px), रू prices (the Devanagari symbol falls back to a system font, since Manrope has no Devanagari), the service charge and VAT bill lines, five payment cards (two per row on desktop) and a +977 box beside the mobile field.
18. **No answer from the server:** not in the design. When a request to the server fails (a network error, not a "no" such as a wrong code), an error toast says "We couldn't reach the restaurant. Check your connection and try again." and the screen stays as it was. It never shows in the normal flow. While a request is on its way the screens look as before (no extra spinners); repeat taps are ignored.
