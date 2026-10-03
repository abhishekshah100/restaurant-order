# The Olive Table: project guide

This guide explains how the codebase is put together, so you can find your way around and change it safely. For setup and scripts, see [README.md](README.md).

## What this is

The Olive Table is a QR-code ordering site for a restaurant. A guest scans the code on their table (for example `/?table=12`), browses the menu, builds a cart and checks out with name, mobile number and OTP. They pay online or at the counter, then follow their order.

- **Stack:** Next.js 16 (App Router), React 19 and TypeScript 7.
- **Hosting:** exported as a fully static site (`out/`). There's no server and no backend yet. All data comes from an API layer (`src/api`, TanStack Query) that reads dummy JSON endpoints in `public/api/`; pointing it at a real backend is a config change (see [Data](#data)). All other state lives in the browser.
- **Design source of truth:** `../the-olive-table-ui`. The `screens/*.html` files and `png/*.png` are the reference for every page. The `w*` and `ws*` screens are the desktop layout (1024px and up); `01–21` and `s*` are the mobile layout.

## Status

| Phase | Scope                                                                                              | State |
| ----- | -------------------------------------------------------------------------------------------------- | ----- |
| 1     | Tooling, tokens, fonts, Icon, `ui/` kit, `/styleguide`                                             | Done  |
| 2     | Layout shell, Welcome, Menu, Category, Search, Food detail, Quick-add                              | Done  |
| 3     | Cart, Checkout (details, OTP, payment, processing, failed, cancelled), order confirmation          | Done  |
| 4     | Order tracking, order details, My orders, Help, waiter, bill                                       | Done  |
| 5     | Restaurant state screens (closed, paused, offline), full responsive and accessibility pass, README | Done  |

## Routes

Every route is prerendered at build time. Dynamic segments list their pages with `generateStaticParams` and set `dynamicParams = false`.

| Route                    | Screen(s)                                                                             | Component                                   |
| ------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------- |
| `/`                      | 01 · w01 Welcome; s01–s03 · ws01–ws03 when closed / paused / offline                  | `components/home/Welcome` in `OrderingGate` |
| `/menu`                  | 02 · w02 Menu home                                                                    | `components/menu/MenuHome`                  |
| `/menu/[category]`       | 03 · w03 Category (6 pages)                                                           | `components/menu/CategoryView`              |
| `/dish/[slug]`           | 06 · w06 Food detail (54 pages); `?edit=<lineKey>` edits a cart line                  | `components/menu/DishDetail`                |
| `/search`                | 04, 05, s04, s05 · w04, w05, ws04, ws05; `?q=`                                        | `components/menu/SearchView`                |
| `/cart`                  | 08 · w08, empty s06 · ws06                                                            | `components/cart/CartView`                  |
| `/checkout/*`            | Restaurant-state screen instead of the step while ordering is unavailable             | `app/checkout/layout.tsx` (`OrderingGate`)  |
| `/checkout/details`      | 09 · w09                                                                              | `components/checkout/DetailsStep`           |
| `/checkout/verify`       | 10, s07 · w10, ws07                                                                   | `components/checkout/VerifyStep`            |
| `/checkout/payment`      | 11 · w11                                                                              | `components/checkout/PaymentStep`           |
| `/checkout/processing`   | 12, s08, s09 · w12, ws08, ws09; `?state=payment-failed` or `?state=payment-cancelled` | `components/checkout/ProcessingStep`        |
| `/order/[id]/confirmed`  | 13 · w13                                                                              | `components/order/OrderConfirmed`           |
| `/order/[id]/track`      | 14 · w14 Order tracking; s10 · ws10 when cancelled                                    | `components/order/OrderTracking`            |
| `/order/[id]`            | 15 · w15 Order details; s10 · ws10 when cancelled                                     | `components/order/OrderDetails`             |
| `/orders`                | 16 · w16 My orders                                                                    | `components/order/MyOrders`                 |
| `/help`                  | 17 · w17 Help (Payment help and Allergens & FAQs open as dialogs; Follow us links)    | `components/service/HelpView`               |
| `/help/bill`             | 20 · w20 Request bill                                                                 | `components/service/BillRequestView`        |
| `/help/bill/pay`         | Pay my bill (laid out like 20 · w20; payment states as 12 · w12, s08 · ws08)          | `components/service/PayBillView`            |
| `/help/waiter-requested` | 19 · w19 Waiter requested                                                             | `components/service/WaiterRequested`        |
| `/help/bill-requested`   | 21 · w21 Bill requested                                                               | `components/service/BillRequested`          |
| `/styleguide`            | Design-system board (ds01 / ds02)                                                     | `app/styleguide/Styleguide`                 |

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
  api/            Data access: endpoint config, fetch client, query keys and options, hooks, the response
                  adapter, the guest-session stand-in and the build-time helpers for server pages (see Data).
  context/        React Context providers (guest session and table, cart, toasts, filters, search, checkout, orders, service requests, quick-add).
  hooks/          Reusable client hooks (useCart, useTable, useMediaQuery, useCountdown, useDishConfig…).
  lib/            Pure logic, no React and no data imports: pricing, formatting, cart-line identity, cart
                  reducer, the menu catalog, checkout validation, order building, safe storage. Data
                  comes in as arguments.
  types/          Domain and API types: Dish, MenuData, CartLine, Order, OrdersResponse, HelpTopic…
  styles/         tokens.css (design tokens), globals.css (base styles, typography, utilities) and
                  patterns.module.css (shared CSS patterns used with `composes:`).
  fonts/          Manrope and Newsreader .woff2 files, loaded with next/font/local.
public/
  api/            Dummy API responses: restaurant.json, menu.json, orders.json, help.json, content/*.json.
tests/
  apiState.tsx    Test helpers: the API JSON as fixtures, a seeded query cache, TestProviders / ApiTestProvider.
  unit/           Vitest + React Testing Library.
  e2e/            Playwright smoke tests (mobile 390px and desktop 1280px).
```

### Rules of thumb

- **Pages are thin.** A file in `app/` exports `generateMetadata` (its title and description come from the content API via `getContent`), maybe `generateStaticParams`, and renders a single view component.
- **Data comes from `src/api`.** Client components read it with the hooks (`useMenu()`, `useRestaurant()`…); server pages use the `api/server` helpers. Nothing imports JSON directly (the one exception is `app/global-error.tsx`, which renders outside the providers).
- **No text in JSX.** Every label, heading, message and screen-reader string comes from the content API (`useContent(ns)` / `getContent(ns)`). ESLint enforces it (`react/jsx-no-literals` plus a rule for text props such as `aria-label`), so hard-coded copy fails `npm run lint`.
- **Logic lives in `lib/` and hooks.** Components receive data and call callbacks. For example, price maths is in `lib/pricing.ts`, the cart line description ("Full · 10 pcs, Medium spicy…") is in `lib/cartLine.ts`, and filtering, sorting and search are in `lib/menu.ts`.
- **Use `'use client'` only where needed.** Components that use state, context or browser APIs are client components. Small presentational pieces (`DishRow`, `DishCard`, `PriceSummary`, `Tag`…) don't declare it themselves.

## How a request becomes a screen

1. `app/layout.tsx` loads the fonts, sets `<html lang="en">`, the theme colour and the skip link, prefetches every API query at build time (`prefetchAppData`) and wraps everything in `AppProviders` with the dehydrated cache.
2. `AppProviders` nests the providers in this order: Query (TanStack Query, outermost, so every provider below can read API data), Toast, Table, Cart, Orders, Checkout, Filters, Search, ServiceRequest, QuickAdd. `layout.tsx` imports `globals.css` first, so every component module comes after it in the cascade.
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
- **Icons:** `<Icon name="…" />`. The 51 mask SVGs and the typed `IconName` union are generated from `olive-core.css`.

## State

All state is client-side. Anything that reads the browser (localStorage, sessionStorage, the URL) loads **after hydration**, so the prerendered HTML and the first client render are identical and there are no hydration warnings.

| State                                                        | Where                                                                                     | Persistence                                                                                                                                                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API data (restaurant, menu, order history, help, copy)       | TanStack Query cache (`src/api`)                                                          | Memory. Prefetched at build time and hydrated, so pages render with it; see [Data](#data) for refresh rules.                                                                                            |
| Cart (lines and kitchen note)                                | `context/CartContext`: `lib/cartReducer` in a small external store                        | localStorage `olive.cart.v2`, saved with the guest session id; a cart from another session is discarded (the guest starts empty). Validated and re-priced against the menu on load; synced across tabs. |
| Guest session and table number                               | `context/GuestSessionContext` (`useSyncExternalStore`): `useGuestSession()`, `useTable()` | localStorage `olive.session.v1` (`{ id, table, startedAt, expiresAt, qrToken? }`), made by `api/session.ts`; expires after `TABLE_SESSION_HOURS` (6). See [Guest sessions](#guest-sessions).            |
| Checkout session (name, phone, OTP attempts, payment window) | `context/CheckoutContext`                                                                 | sessionStorage `olive.checkout.v1` (this tab only), saved with the guest session id; a new session starts a fresh checkout.                                                                             |
| Orders placed on this device                                 | `context/OrdersContext`                                                                   | localStorage `olive.orders.v1`, each stamped with the guest session that placed it; `markPaid` records a Pay my bill payment. Storage is the source of truth; synced across tabs.                       |
| Waiter and bill requests                                     | `context/ServiceRequestContext`                                                           | sessionStorage `olive.service.v1`, per guest session (another guest at the table doesn't see them), expire after 30 minutes.                                                                            |
| Restaurant status preview                                    | `hooks/useRestaurantStatus`                                                               | sessionStorage `olive.status-preview.v1` (see below).                                                                                                                                                   |
| Menu filters and sort                                        | `context/FiltersContext`                                                                  | Memory, for the current visit.                                                                                                                                                                          |
| Search query (shared by the header box and the search page)  | `context/SearchContext`                                                                   | `?q=` in the URL, debounced by 250ms.                                                                                                                                                                   |
| Toasts ("Added · Undo")                                      | `context/ToastContext`                                                                    | Memory. Shown in a polite live region; the timer pauses while a toast is hovered or focused.                                                                                                            |

**Cart hooks.** Read only what you need, so long menus don't re-render on every change:

- `useDishLines(slug)` / `useDishQuantity(slug)`: one dish's lines or total; re-render only when that dish changes.
- `useCartActions()`: `addItem`, `setQuantity`, `removeLine`, `editLine`, `setKitchenNote`, `clear`. Stable, never re-renders.
- `useCart()`: the whole cart and bill. Use it only where the whole cart is shown.

Everything read from storage goes through `lib/storage` (never throws) and a strict validator; a malformed cart line is dropped, not trusted.

### Guest sessions

Several people at one table can order separately, so every guest who scans the QR code gets their own session at that table. The QR link is `/?table=12` plus an optional `&qr=<token>` (reserved for a signed table token; kept with the session but not checked yet). `context/GuestSessionContext` reads it after hydration:

- **A valid `?table`** (1–`MAX_TABLE`): a live saved session for the **same** table is kept (the same guest re-scanning, or a refresh); otherwise a new session starts for that table.
- **No `?table`:** the live saved session is reused; if there is none, a new session starts at `defaultTable` (GET /restaurant).
- A session expires after `TABLE_SESSION_HOURS` (6). The old `olive.table.v1` key is ignored, so a guest coming from before sessions simply gets a new one.
- When another tab on the device starts a session, every tab follows it (the cart is shared across tabs too).

New sessions come from `startGuestSession({ table, qrToken })` in `api/session.ts`, a synchronous local stand-in for `POST /sessions` (see [Switching to a real backend](#switching-to-a-real-backend)). `useTable()` returns the table number exactly as before: `defaultTable` in the prerendered HTML and the first client render, the session's table after that. `useGuestSession()` returns the session, or `null` before hydration; providers that read storage per session (cart, checkout, service requests) wait for it.

Everything personal is scoped to the session id: the cart, the checkout, waiter and bill requests, and new orders (`Order.sessionId`, stamped by `buildOrder` from its input). **Ownership** is decided in one place, `isOwnOrder(order, sessionId)` in `lib/orders.ts`: an order with a `sessionId` is the guest's only if it matches; an order without one (the drawn order history) falls back to `placedBy === 'you'`. It drives `latestOwnOrder`, `billFor` ("Just my orders", and the guest's own orders first on the whole-table bill) and the "You" label in `BillOrderList`. My orders (`myOrders`) still lists every order placed on this device, earlier sessions included: it's the same person.

#### Separate bills

Guests at one table pay separately. Each order is paid online at checkout or left for the counter; later, a guest can pay their own outstanding orders in the app:

- **Entry points.** On the bill page (`/help/bill`) and the bill-requested page, when the scope is **Just my orders** and something is payable, a primary **Pay ₹X now** button (as drawn in 21 · w21) opens `/help/bill/pay`. The existing actions stay as secondary ones. On **Whole table** there's no Pay button: the server brings that bill, and one guest never pays other guests' orders in the app.
- **What's payable.** `payableOrders(orders, sessionId)` (`lib/service.ts`): unpaid orders stamped with **this** guest session, i.e. placed on this device in this session. `billFor(…, 'mine', …)` returns them as `payable` / `payableTotal` (always empty for `'table'`). The drawn order history has no `sessionId`, so a history order that counts as "yours" (e.g. #A097 at table 12) still shows on "Just my orders" and in its balance, but can't be paid here; the server settles it.
- **Paying.** `PayBillView` lists the payable orders (`BillOrderList`), the amount due (`BillTotals`) and UPI or card (`checkout/PaymentMethods`, shared with the checkout payment step). **Pay** snapshots the orders and amount (`usePayBill().startPayment`) and shows a processing state with the same **Prototype: success / failure** links as checkout. Failure keeps the orders unpaid and offers **Try again** or **Change payment method**. Success calls `OrdersContext.markPaid(orderIds, method)` (`lib/orders › markOrdersPaid`: payment becomes `{ method: 'online', status: 'paid', detail: 'UPI' | 'Card', transactionRef }`, only unpaid orders change, persisted and synced across tabs), cancels a pending **Just my orders** bill request (a whole-table request still stands for the others) and shows **Bill paid** with the amount, method and orders. The bill then shows those orders as paid and the Pay button disappears.
- **Guards.** Nothing payable (or no session yet) shows "Nothing to pay" with a link back to the bill. A repeat tap records one payment (`usePayBill` returns the first result to later calls, and `markOrdersPaid` never re-marks a paid order). Offline (`useOrderingAvailability`) shows an alert banner and disables Pay; closed or paused doesn't block paying for food already ordered. The processing, failed and paid states move focus to their heading and announce through live regions.
- **Mock limitation.** New orders take IDs from a pool per device, so two phones can both get #A105. A real backend hands out unique IDs.

### Cart line identity

A cart line's key is built from dish + variant + sorted add-ons + options + sorted instructions + the normalised note (`lib/cartLine.ts › lineKey`). Adding the same configuration again increases that line's quantity, and editing a line so it matches another merges the two.

### Pricing

Prices are whole rupees. `lib/pricing.ts` works in paise:

1. Calculate GST at 5% on the item total.
2. Split it into CGST and SGST. An odd paisa goes to CGST.
3. Round the total to the nearest rupee and show the difference as the round-off line.

The design's own bills are unit-tested: ₹1,356 becomes ₹1,424 (+₹0.20), ₹549 becomes ₹576 (−₹0.45), and ₹958 becomes ₹1,006.

### Checkout flow

1. **Details:** the name is required, and the mobile number must be 10 digits starting with 6–9.
2. **Verify:** the mock OTP is `123456` (`MOCK_OTP` in `lib/constants.ts`, with `OTP_ATTEMPTS`, `OTP_RESEND_SECONDS` and `PAYMENT_WINDOW_SECONDS`; these mock-backend rules move server-side with a real API). A wrong code shows the error with the attempts left (3 in total). Resend unlocks after 30 seconds or after a wrong code (`canResendOtp`); the reducer ignores early resends.
3. **Payment:** **Pay online** opens a 4:32 mock UPI window on `/checkout/processing`. **Pay at the counter** places the order immediately.
4. **Processing:** the "Prototype: success" and "Prototype: failure" links simulate the result. The request also fails by itself when the timer runs out. **Cancel payment** goes to the cancelled state.
5. **On success:** `usePlaceOrderState()` creates the order and redirects to `/order/<id>/confirmed`. It ignores repeat taps while an order is being placed (use its `placing` flag to disable the buttons) and never places an empty order. The confirmation page then empties the cart (`useFinishPlacedOrder`). On failure or cancel, the cart is never touched.

A **Pay at the counter** order stays unpaid on the bill; the guest can settle it later from the bill page with **Pay ₹X now** (see [Separate bills](#separate-bills)).

`useCheckoutGuard` redirects a guest who lands mid-flow: an empty cart goes to /cart, a missing number goes to details, and an unverified number goes to verify. Payment and processing both use the `'pay'` step, so the processing page can't be reached without a verified number.

### Order tracking

Orders placed on this device move along by time since they were placed (`simulateOrder` in `lib/orders.ts`): received, preparing from 2 min, ready from 18, served from 22. The tracking view refreshes every 30 s and stops once the order is served or cancelled; a hidden live region announces status changes only. The drawn mock orders keep their drawn status.

Layout on every screen size: the status card (status, ETA, one sentence), then a horizontal four-step progress card (`order/TrackStepper`: Received → Preparing → Ready → Served, left to right, so it fits a 360px phone without scrolling), then the items card. Once received, Received is done and Preparing shows as **Up next** until the kitchen starts. The vertical `TrackTimeline` is only used for cancelled orders.

### Restaurant status and connectivity

`useOrderingAvailability()` (`hooks/useRestaurantStatus.ts`) combines `status` from GET /restaurant (`useRestaurant()`) with `navigator.onLine` (`useOnlineStatus`) and returns `{ state: 'open' | 'closed' | 'paused' | 'offline', status, canAdd, canCheckout, retry }`.

- **Closed:** the menu stays browsable but read-only (ADD shows "Closed"); `/` and checkout show the closed screen.
- **Paused:** the cart still works, but checkout shows "Our kitchen needs a moment" with **Call a waiter**.
- **Offline:** overrides any status for checkout; browsing pages show an alert banner and **Try again** re-checks.

`OrderingGate` replaces `/` and every checkout route with `StatusScreen` when the state isn't open, and `OrderingBanner` sits under the headers on menu, category, search, cart and food detail. Preview any state with `?status=closed|paused|offline` on any page (kept for the tab); `?status=open` clears it. All of this reads after hydration, so the prerendered HTML is the open state.

New orders take IDs from a pre-rendered pool (`newOrderIds` in GET /orders: `A105`–`A124`), because a static export can only serve pages that exist at build time.

## Data

All data comes through the API layer in `src/api`. There is no backend yet, so the endpoints are dummy JSON files in `public/api/`, which the static site serves like real endpoints (`GET /api/menu.json`).

### Endpoints

| Endpoint            | File                         | Contents                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /restaurant`   | `public/api/restaurant.json` | `Restaurant`: name, opening hours, status (`open` / `closed` / `paused`), `defaultTable`, social links and the bracketed placeholders (`[RESTAURANT PHONE]`, `[PAYMENT PARTNER]`, `[NETWORK NAME]`, `[RESTAURANT ADDRESS]`).                                                                                                                                                        |
| `GET /menu`         | `public/api/menu.json`       | `MenuData`: 7 categories and 56 dishes (defaults filled in, `rank` = position in its category), plus `chefsPicks` (picks rail order), `popularSearches`, `cartSuggestions`, `trendingTonight` and `popularAtTable`. Every dish, price and option shown in the designs is reproduced exactly; dishes not drawn in the designs bring each category up to the counts the designs show. |
| `GET /orders`       | `public/api/orders.json`     | `OrdersResponse`: `history` (the mock orders drawn in the designs: A104, A097, A101, A098, A061, A033, A029) and `newOrderIds` (the pool for orders placed on this device).                                                                                                                                                                                                         |
| `GET /help`         | `public/api/help.json`       | `HelpTopics`: the Payment help and Allergens & FAQs dialogs.                                                                                                                                                                                                                                                                                                                        |
| `GET /content/<ns>` | `public/api/content/*.json`  | Screen copy, one namespace per area (`useContent(ns)`).                                                                                                                                                                                                                                                                                                                             |

### Queries, hooks and server helpers

| Query (`api/queries.ts`) | Key                     | staleTime                                                    | Hook (`api/hooks.ts`)                                      |
| ------------------------ | ----------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| `restaurantQuery()`      | `['restaurant']`        | 60 s, also refetched on window focus (the status can change) | `useRestaurant(): Restaurant`                              |
| `menuQuery()`            | `['menu']`              | Infinity                                                     | `useMenu(): MenuCatalog`                                   |
| `orderHistoryQuery()`    | `['orders', 'history']` | Infinity                                                     | `useOrderHistory(): Order[]`, `useNewOrderIds(): string[]` |
| `helpQuery()`            | `['help']`              | Infinity                                                     | `useHelpTopics(): HelpTopics`                              |
| `contentQuery(ns)`       | `['content', ns]`       | Infinity                                                     | `useContent(ns): Translator`                               |

- **Build-time prefetch.** `app/layout.tsx` runs `prefetchAppData` (`api/server.ts`), which reads every endpoint from `public/api` and dehydrates the cache into the page. Every page is prerendered with its data and the hooks use `useSuspenseQuery`, so `data` is never undefined, nothing flashes and nothing mismatches on hydration. In the browser, the restaurant query refreshes in the background once it's older than a minute.
- **Server pages** (`generateStaticParams`, `generateMetadata`, page bodies) use `getMenuServer()` (the menu catalog) and `getOrderIdsServer()` (history IDs plus `newOrderIds`) from `api/server.ts`.
- **The menu catalog.** `createMenuCatalog(data)` (`lib/menu.ts`) wraps a menu response with lookups: `getDish`, `getCategory`, `dishesIn`, `categoryCount`, `categoryCountLabel`, `featuredDishes`, `searchDishes`. It's built once per response object (a `WeakMap`), so `useMenu()` returns the same catalog until the menu changes. Pure helpers that need no data (`startingPrice`, `applyFilters`, `sortDishes`, `highlight`…) stay plain functions.
- **The orders adapter.** `api/adapters.ts › toOrderHistory` turns the response into `Order`s. A real backend sends an ISO `placedAt`, which passes through untouched. The dummy JSON can't date its "today" orders, so those send `"placedAt": null` and `"placedRelative": { "daysAgo": 0, "time": "19:42" }`, which the adapter dates on today's restaurant day (IST). The cache keeps the response as sent and the query's `select` adapts it on read, so these dates are worked out in the browser rather than frozen at build time.
- **Lib functions take data as arguments and never hard-code words:** `buildOrder(input, menu, labels)`, `itemLabel(item, menu)`, `nextOrderId(placed, newOrderIds)`, `findOrder(id, placed, history)`, `allOrders(placed, history)`, `myOrders(placed, history)`, `isOwnOrder(order, sessionId)`. Functions that used to return text now return a key the component translates (`paymentLabel`, `totalLabel`, `validateDetails`, `wrongCodeError`, `unavailableReason`, `filterSummaryKind`) or take the words as an argument (`describeOptions(dish, line, labels)` with `useCartLineLabels()`, `formatAddOnPrice(amount, freeLabel)`).

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

### Switching to a real backend

1. Set `NEXT_PUBLIC_API_BASE_URL` to the API's base URL and `NEXT_PUBLIC_API_SUFFIX` to `""` (defaults: `/api` and `.json`). `apiGet` then calls `https://…/menu` instead of `/api/menu.json`.
2. In `api/server.ts`, replace `readApiFile` with `apiGet` for build-time reads (or drop the build-time prefetch if pages become dynamic).
3. Send real `placedAt` timestamps; `placedRelative` and the adapter branch for it can then go.
4. Move the mock checkout rules (`MOCK_OTP`, `OTP_ATTEMPTS`, `OTP_RESEND_SECONDS`, `PAYMENT_WINDOW_SECONDS` in `lib/constants.ts`) server-side.
5. Serve `GET /content/<namespace>` with the same keys as `public/api/content/*.json` (a CMS or a translations table works well).
6. Guest sessions: implement `POST /sessions { table, qrToken } → { sessionId, table, startedAt, expiresAt }` and call it from `api/session.ts` (as a TanStack `useMutation` that `GuestSessionContext` awaits before saving the session). The QR code should carry a signed, expiring table token (`&qr=`) that the server verifies, so a guest can't just change the table number.
7. Orders carry the `sessionId` that placed them; the server should take it from the session (not trust the body) and use it for "mine". A whole-table bill needs `GET /tables/:table/orders`, since one device only knows its own orders.
8. Separate bills: implement `POST /sessions/:sessionId/bill/payments { orderIds, method: 'upi' | 'card' } → { paymentId, status, amount, orders }`. The server checks that every order belongs to the session and is unpaid, works out the amount itself (never trusting one from the client), creates the payment with the payment partner and marks the orders paid only on the partner's confirmation (webhook), which also settles a pending "Just my orders" bill request. Call it from `usePayBill` (as a TanStack `useMutation`) in place of `OrdersContext.markPaid`, poll or subscribe for the result instead of the prototype links, and invalidate the orders query afterwards. With real order data, history orders carry their `sessionId` too, so they become payable like any other.

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

To add a dish, add an object to `dishes` in `public/api/menu.json`, with its `categoryId` and a `rank` (its position in the category, which sets its "Recommended" order). A dish with `variants`, `optionGroups` or `addOns` counts as customisable:

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

| Command            | What it runs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`         | Vitest (fixtures come from `public/api` through `tests/apiState.tsx`): API adapter, menu catalog, pricing, formatting, cart reducer and cart store, cart-line descriptions, menu queries and search, checkout validation, orders and tracking, paying a bill (`markOrdersPaid`, `markPaid`, `payableOrders`, `billFor` after payment), service requests, restaurant status, guest sessions, hooks, toasts, OtpInput, QuantityStepper.                                                                    |
| `npm run test:e2e` | Playwright against the built `out/` folder, at 390px and 1280px: happy path, failed payment, quick-add (`happy-path.spec.ts`), orders (`orders.spec.ts`), help and service requests (`service.spec.ts`), guest sessions (`sessions.spec.ts`: two guests at one table), separate bills (`separate-bills.spec.ts`: two guests at one table pay their own bills) and restaurant states (`states.spec.ts`). Run `npm run build` first. It uses the installed Google Chrome; set `PW_CHANNEL=chromium` on CI. |

If `tsc` reports TS2344 in `.next/dev/types/validator.ts` after you add a route `layout.tsx`, delete the stale `tsconfig.tsbuildinfo`.

## Where the build differs from the design

1. **Categories:** the mobile tabs in the designs (Breads, Rice) and the web sidebar (Pizza, Breads & Rice) disagree. The web set is used everywhere.
2. **Filler dishes:** dishes not drawn in the designs were added to `menu.json` so the category counts match the designs.
3. **Margherita:** the Wood-fired Margherita stays under Mains, as drawn in 03 / w03.
4. **Past orders:** in the mock orders, line prices are chosen so the drawn totals come out exactly (₹318, ₹756…). Every menu price ends in 9, so those totals can't be made from current prices.
5. **Disabled buttons:** the text colour is darker, for contrast.
6. **Warmer background:** at the client's request, `--bg` was deepened from #F7F2EA to #F3E8D8 so cards and inputs stand out. `--surface`, `--sand`, `--line` and `--line-strong` were adjusted to match, and `--ink-3` and `--brand-600` darkened slightly to keep every text pairing at 4.5:1 or better.
7. **+91 box:** the country-code box has no dropdown chevron, because +91 is the only option.
8. **OTP screen:** one centred column on every screen size, with a phone-and-SMS illustration (`checkout/OtpIllustration`). Sizes and gaps scale with the window height (`dvh`), so the step never scrolls, even with an error showing. The "One-time code" label is kept for screen readers only.
9. **After adding from food detail:** the guest returns to where they came from, with an Undo toast, instead of jumping to the cart as the static prototype links do.
10. **Mobile sort:** sorting on mobile opens a bottom sheet, so the scrolling chip row doesn't clip the menu. On desktop it's a dropdown.
11. **Search suggestions:** at the client's request there are no recent searches. Before typing, every device shows Trending tonight (dish cards with photos), Popular searches and icon tiles for all categories.
12. **Closed state banner:** the browsing pages get an error-tone banner while closed, since the design draws none. The closed status card uses 20px side padding below 375px.
13. **Request bill:** a full page, as drawn in 20 · w20. "Pay ₹X now" (21 · w21) appears only for **Just my orders**, pays only the guest's own orders placed on this device, and opens a dedicated Pay my bill page rather than the checkout payment step; "Payment options" is kept as a third, quieter action. The design has no Pay my bill screens, so they reuse the bill page layout, the checkout payment-method cards and the processing / failed / confirmation patterns.
14. **Order details:** item counts are quantities (A104 reads "4 items", matching its "Items (4)" bill line), and a cancelled order from today stays in My orders under This visit.
15. **Empty-cart suggestions:** an added suggestion stays and turns into a stepper instead of disappearing, so keyboard focus isn't lost.
16. **Follow us (Help page):** not in the design. A card under the opening hours links to the restaurant's social profiles (`social` in GET /restaurant, `public/api/restaurant.json`: Instagram, Facebook, YouTube, X), each opening in a new tab. The brand marks are in the icon set (`instagram`, `facebook`, `youtube`, `xbrand`). The links point at the platforms' home pages until the real profiles are filled in.
