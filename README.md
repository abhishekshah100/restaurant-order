# The Olive Table: QR ordering web app

Guests scan the QR code on their table (`/?table=12`, or `/?branch=ktm-thamel&table=5` at the Kathmandu branch), browse that branch's menu, build a cart and check out with their name, mobile number and an OTP. They pay online or at the counter, then follow their order, call a waiter or ask for the bill, all from their phone.

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, CSS Modules. No UI framework, no Tailwind.
- **Output:** a fully static site (`out/`). There is no server and no backend yet. All data is fetched through an API layer (`src/api`, TanStack Query): reference data from dummy JSON endpoints in `public/api/`, and everything the backend will own (guest sessions, OTP, orders, payments, waiter and bill requests) from an in-browser **mock server** (`src/api/mock`) that answers exactly as the backend will. Switching to the real backend is an environment change; see [Data and the API](#data-and-the-api).
- **Branches and regions:** India (Bengaluru, default) and Nepal (Thamel, Kathmandu). Currency, locale, time zone, taxes (GST vs service charge + VAT), mobile numbers, payment methods and dietary marks all come from `public/api/branches.json`; see [PROJECT_GUIDE.md › Branches and regions](PROJECT_GUIDE.md#branches-and-regions).
- **Order modes:** dine-in (a table QR code, `/?table=12`), takeaway and delivery. Without a QR code the guest picks an outlet and a mode on the start screen (`/start/`, or links like `/?mode=delivery` and `/?branch=ktm-thamel&mode=takeaway`). Pickup slots, delivery zones (areas, fee, free-above, minimum order, ETA) and each mode's payment methods are per branch in `branches.json › modes`; see [PROJECT_GUIDE.md › Order modes](PROJECT_GUIDE.md#order-modes-dine-in-takeaway-delivery).
- **After ordering:** at a table the guest's order becomes a running order: later rounds go straight to the kitchen from the cart (**Add to my order**, no second checkout) and onto one bill, paid with Pay my bill or at the counter (`branches.json › ordering.dineInPayment`). For 2 minutes after placing (`ordering.cancelWindowSeconds`), while the kitchen hasn't started, an order or its latest round can be changed (back in the cart, "Editing order #A105") or cancelled; any order can be ordered again from My orders or its details. See [PROJECT_GUIDE.md › After ordering](PROJECT_GUIDE.md#after-ordering-running-orders-changes-and-order-again).
- **Promotions:** promo codes in the cart (India `WELCOME10`, `FLAT50` for delivery; Nepal `NAMASTE15`) and automatic offers such as happy hour (20% off Beverages, 4–7 PM branch time, with offer prices and a banner on the menu). Discounts come off before tax, appear as bill lines from the cart to the receipt, and are checked by the server. Per branch in `public/api/branches/<id>/promotions.json`; see [PROJECT_GUIDE.md › Promotions](PROJECT_GUIDE.md#promotions-promo-codes-and-happy-hour).
- **Design source of truth:** `../the-olive-table-ui` (`screens/*.html`, `png/*.png`). Mobile layout below 1024px, web layout from 1024px.

For the architecture, conventions, state, pricing and accessibility rules, read [PROJECT_GUIDE.md](PROJECT_GUIDE.md).

## Quick start

Requires Node.js 20.9 or later.

```bash
npm install
npm run dev        # http://localhost:3000 (the design-system board is at /styleguide)
```

| Script               | What it does                                                   |
| -------------------- | -------------------------------------------------------------- |
| `npm run dev`        | Dev server with hot reload                                     |
| `npm run build`      | Static export to `out/`                                        |
| `npm start`          | Serves `out/` on http://localhost:3000                         |
| `npm run lint`       | ESLint, zero warnings allowed                                  |
| `npm run format`     | Prettier (write); `npm run format:check` only checks           |
| `npm run typecheck`  | `tsc --noEmit`                                                 |
| `npm test`           | Vitest unit tests (`tests/unit`)                               |
| `npm run test:watch` | Vitest in watch mode                                           |
| `npm run test:e2e`   | Playwright end-to-end tests against `out/` (run a build first) |

## Data and the API

Every piece of data comes from an endpoint, read with a TanStack query hook and written with a mutation hook (`src/api`); components never touch storage or `fetch` for server data.

- **Reference data** (the brand, each branch's details, status and region rules, each branch's menu and promotions, help topics, screen copy): until the backend exists, the JSON files in `public/api/`, served by the static site as `/api/restaurant.json`, `/api/branches.json`, `/api/branches/<id>/menu.json`, `/api/branches/<id>/promotions.json`, `/api/help.json` and `/api/content/<area>.json`. Edit those files to change the dummy data.
- **Server-owned data** (`POST /sessions`, `POST /promos/validate`, `POST /otp`, `POST /otp/verify`, `POST /orders`, `GET /orders/:id`, `POST /orders/:id/rounds`, `PATCH /orders/:id`, `POST /orders/:id/cancel`, `GET /sessions/:id/orders`, `GET /tables/:branch/:table/orders`, `POST /payments`, `POST`/`DELETE /service-requests`, `GET /sessions/:id/service-requests`): answered by the mock server in `src/api/mock`, which keeps its tables in the browser's storage, applies the backend's rules (OTP code and attempts, order numbering, pricing with the branch's taxes and promotions, rounds on a running order, the change / cancel window, the kitchen's progress, payments, request expiry) and seeds itself from `public/api/orders.json` (the drawn order history and the delivery riders). Every request and response is typed in `src/api/contracts.ts`, the backend contract (also summarised in [PROJECT_GUIDE.md › Backend contract](PROJECT_GUIDE.md#backend-contract)).

| Environment variable              | Default   | Use                                                                                                  |
| --------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`        | `/api`    | Base URL of the API. Set it to the backend's URL.                                                    |
| `NEXT_PUBLIC_API_SUFFIX`          | `.json`   | Appended to every endpoint path. Set it to an empty string for a real API.                           |
| `NEXT_PUBLIC_API_MOCK`            | on        | Set to `false` to send every request to the backend instead of the in-browser mock server.           |
| `NEXT_PUBLIC_API_MOCK_LATENCY_MS` | `200-400` | The mock server's response time: a range (each endpoint gets a fixed delay within it) or one number. |

All are read at build time (`next build`), like every `NEXT_PUBLIC_` variable. See [PROJECT_GUIDE.md › Data](PROJECT_GUIDE.md#data) for the query keys, hooks and what else changes with a real backend.

## Routes

Every route is prerendered at build time. Dynamic routes list their pages with `generateStaticParams` (`dynamicParams = false`), so only the dishes and categories on any branch's menu exist. Order pages take the order id from the query string (`/order/track/?id=A105`), so any id the API returns opens and there is no limit on orders; link to them with `orderPath()` in `src/lib/orders.ts`.

| Route                                                                                     | Screen                                                                                               |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/`                                                                                       | Welcome and table confirmation; the closed / paused / offline screen when ordering is unavailable    |
| `/menu`                                                                                   | Menu home                                                                                            |
| `/menu/[category]`                                                                        | Category                                                                                             |
| `/dish/[slug]`                                                                            | Food detail (`?edit=<line key>` edits a cart line)                                                   |
| `/search`                                                                                 | Search (`?q=`)                                                                                       |
| `/cart`                                                                                   | Cart and empty cart                                                                                  |
| `/checkout/details`, `/checkout/verify`, `/checkout/payment`, `/checkout/processing`      | Checkout steps. Show the restaurant-state screen instead while ordering is closed, paused or offline |
| `/order/confirmed?id=`                                                                    | Order confirmation                                                                                   |
| `/order?id=`, `/order/track?id=`                                                          | Order details and live tracking                                                                      |
| `/orders`                                                                                 | My orders                                                                                            |
| `/help`, `/help/bill`, `/help/bill/pay`, `/help/bill-requested`, `/help/waiter-requested` | Service: help, request the bill, pay my own bill, request confirmations                              |
| `/styleguide`                                                                             | Design-system board                                                                                  |

## Preview parameters

The prototype's states can be opened directly, for demos, reviews and tests:

| Parameter                                           | Where                  | Effect                                                                                                                                                                                                          |
| --------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `?branch=ID&table=NN&qr=TOKEN`                      | Any page (the QR link) | Starts a guest session at the branch's table NN (within its `tables` range); see [QR link](#qr-link). `branch` (default `blr-indiranagar`) and `&qr=` are optional. Try `?branch=ktm-thamel&table=5` for Nepal. |
| `?status=closed`                                    | Any page               | Restaurant closed: the welcome page shows the closed screen, the menu is read-only and checkout is blocked.                                                                                                     |
| `?status=paused`                                    | Any page               | Ordering paused: banner on the menu and cart, the cart still works, checkout shows "Our kitchen needs a moment".                                                                                                |
| `?status=offline`                                   | Any page               | Simulates a lost connection (banner, checkout blocked). **Try again** ends it.                                                                                                                                  |
| `?status=open`                                      | Any page               | Ends a `?status` preview.                                                                                                                                                                                       |
| `?state=payment-failed`, `?state=payment-cancelled` | `/checkout/processing` | Payment failed / cancelled outcomes.                                                                                                                                                                            |

A `?status` preview is kept in sessionStorage, so it stays on while you browse in that tab. Without one, the status comes from the branch's `status` in GET /branches (`public/api/branches.json`), and the offline state follows the browser's real connection (`navigator.onLine` and the `online` / `offline` events).

### QR link

Each table's QR code opens `/?branch=<id>&table=12&qr=<token>`. `branch` is the branch id (optional: the brand's default branch, also used for an unknown id); `table` is the table number; `qr` is reserved for a signed table token (so guests can't just edit the number) and is passed on with the session but not checked yet. Every guest who scans gets their own **guest session** at that table, so several people at one table can order separately: their own cart, checkout, waiter and bill requests, and "Just my orders" on the bill, which they can pay in the app (**Pay ₹X now** → `/help/bill/pay`) while the rest of the table pays separately. Re-scanning the same table (or refreshing) keeps the session; scanning another table or another branch, or coming back after the session expires (6 hours: `TABLE_SESSION_HOURS` in the mock server, the backend's rule), starts a new one. A link without `?table` reuses the current session (or, with only `?branch`, one at that branch), or starts one at the branch's `defaultTable`. See "Guest sessions" in [PROJECT_GUIDE.md](PROJECT_GUIDE.md).

## Testing

```bash
npm test                 # unit tests
npm run build
npm run test:e2e         # Playwright at 390px (mobile) and 1280px (desktop)
```

The end-to-end tests serve `out/` on port 4173 and use the installed Google Chrome. On CI, set `PW_CHANNEL=chromium` (and run `npx playwright install chromium`). Specs live in `tests/e2e/`: the happy path (menu, food detail, cart, checkout, confirmation), failed payment and quick-add, orders and tracking, service requests, guest sessions (`sessions.spec.ts`: two guests at one table), separate bills (`separate-bills.spec.ts`: two guests at one table pay their own bills, one at checkout and one later from the bill page), the restaurant states (`states.spec.ts`) order modes (`modes.spec.ts`: India takeaway as soon as possible paid at pickup; Nepal delivery with a zone fee, the below-minimum message, eSewa and tracking to Out for delivery; switching mode keeps the cart; switching outlet empties it after asking) branches (`branches.spec.ts`: the Nepal branch's रू prices, service charge + VAT, +977 numbers, eSewa / Khalti / Fonepay, Kathmandu time, and paying a Nepal bill with Khalti with the help and bill copy naming Nepal's ways to pay) promotions (`promos.spec.ts`: WELCOME10 through checkout to the receipt, the below-minimum and wrong-mode messages, NAMASTE15 with service charge + VAT, happy-hour prices with Playwright's clock in Bengaluru and Kathmandu time, and none outside the window) and the order lifecycle (`lifecycle.spec.ts`: a second round without checkout and one bill for both; cancelling and changing within the window, with the difference paid online; the actions gone once the window has passed, using Playwright's clock; Order again from My orders, skipping a dish that's off the menu; a Nepal tab). The unit tests include every mock-server endpoint (`mockServer.test.ts`, `modesServer.test.ts`, `lifecycleServer.test.ts`: rounds, tab totals under GST and service charge + VAT, `perRound` payments, changes, refunds, cancellations, the window), the window / payment / order-again rules (`lifecycle.test.ts`), zones, fees, minimums and pickup slots in each time zone (`fulfilment.test.ts`), promotions (`promotions.test.ts`: discounts, caps, minimums, modes, the happy-hour window in both time zones and across midnight, tax after discount under both tax models; `promosServer.test.ts`: validation, orders, payments, the per-guest limit and a tab's code) and a check that the transport goes to `fetch` when `NEXT_PUBLIC_API_MOCK=false`.

## Deploying

`npm run build` writes a self-contained static site to `out/`. Upload that folder to any static host or CDN (S3 + CloudFront, Netlify, Vercel static, Nginx…).

- URLs use trailing slashes (`/menu/`), and every page is an `index.html` in its own folder. Serve `404.html` for unknown paths.
- Images are not optimised at runtime (`images.unoptimized`); the files in `public/images` are served as they are.
- **Security headers must be set by the host**, because a static export can't send them: a Content-Security-Policy (scripts and styles from `'self'`; Next's inline bootstrap scripts need a hash or `'unsafe-inline'`), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone and geolocation off) and `frame-ancestors 'none'` (or `X-Frame-Options: DENY`).
- Cache `/_next/static/*` as immutable; keep HTML short-lived so menu updates show up straight away.

## What is mock, and must be replaced before production

This is a front-end prototype. Before real guests use it:

| Mock                        | Where                                                                                                                                                                                                       | Replace with                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| The backend itself          | The mock server in `src/api/mock` (sessions, OTP, orders, payments, service requests), its tables in the guest's browser storage                                                                            | The real API behind `src/api/contracts.ts`; build with `NEXT_PUBLIC_API_MOCK=false`.                    |
| OTP (always `123456`)       | `MOCK_OTP` and the attempt / resend rules in `src/api/mock/rules.ts`                                                                                                                                        | An SMS OTP service, verified on a server, with rate limiting.                                           |
| Payment                     | `/checkout/processing`, Pay my bill and the round / difference payment dialog ("Prototype: success / failure" links call the mock-only `POST /payments/:id/simulate`; 4:32 window)                          | The payment partner's checkout or UPI intent flow, with server-side confirmation and webhooks.          |
| Order IDs                   | Numbered per device by the mock server after the highest known one (`A105`, `A106`, … no limit)                                                                                                             | Globally unique IDs from the order API (order pages already open any ID via `?id=`).                    |
| Order tracking              | The mock kitchen (`src/api/mock/kitchen.ts`) moves orders along by time; the app polls `GET /orders/:id` every 30 s                                                                                         | Live status from the kitchen (polling as now, or SSE / WebSockets).                                     |
| Table token, guest sessions | `?table=NN` trusted as-is (`&qr=` is kept but not checked by the mock's `POST /sessions`)                                                                                                                   | `POST /sessions` with a signed, expiring table token checked by the server, so tables can't be guessed. |
| Restaurant status and hours | `status`, hours and `pausedForMinutes` per branch in `public/api/branches.json`                                                                                                                             | A live status from the restaurant system. Remove or protect the `?status` preview.                      |
| Menu and prices             | `public/api/branches/<id>/menu.json` (dishes not in the designs pad the design's counts; Nepal prices ≈ India × 1.6)                                                                                        | The restaurant's menu and stock feed; prices must be re-checked by the server when an order is placed.  |
| Promotions                  | `public/api/branches/<id>/promotions.json`; the mock counts a code's per-guest uses from this device's orders (by verified number)                                                                          | The promotions engine and customer records on the server.                                               |
| Placeholders                | `[RESTAURANT PHONE]`, `tel:+910000000000`, `[RESTAURANT ADDRESS]`, `[NETWORK NAME]`, `[PAYMENT PARTNER]` (per branch in `branches.json`), social links in `restaurant.social` (platform home pages for now) | The restaurant's real details.                                                                          |

## Project layout

```
src/api/          Data access: backend contract, transport (fetch or mock), typed endpoints, TanStack Query queries,
                  hooks and mutations, adapters, build-time helpers; mock/ is the in-browser mock server
src/app/          Routes: thin server pages that set metadata and render one view
src/components/   ui/ (design system), layout/, home/, menu/, cart/, checkout/, order/, service/, status/
src/context/      Client state providers (guest session and table, cart, checkout, service requests…)
src/hooks/        Client hooks (useCart, useTable, useOrderingAvailability, useOnlineStatus…)
src/lib/          Pure logic: pricing, formatting, cart lines, menu queries, checkout, orders, restaurant status
src/styles/       tokens.css, globals.css, patterns.module.css
public/api/       Dummy API responses (JSON)
tests/            unit/ (Vitest) and e2e/ (Playwright)
```
