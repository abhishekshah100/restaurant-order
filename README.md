# The Olive Table: QR ordering web app

Guests scan the QR code on their table (`/?table=12`), browse the menu, build a cart and check out with their name, mobile number and an OTP. They pay online or at the counter, then follow their order, call a waiter or ask for the bill, all from their phone.

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, CSS Modules. No UI framework, no Tailwind.
- **Output:** a fully static site (`out/`). There is no server and no backend yet. All data is fetched through an API layer (`src/api`, TanStack Query) from dummy JSON endpoints in `public/api/`, and all other state lives in the browser (localStorage and sessionStorage).
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

Every piece of data (restaurant profile and status, menu, order history, help topics, screen copy) comes from an endpoint. Until the backend exists, the endpoints are the JSON files in `public/api/`, served by the static site as `/api/restaurant.json`, `/api/menu.json`, `/api/orders.json`, `/api/help.json` and `/api/content/<area>.json`. Edit those files to change the dummy data.

| Environment variable       | Default | Use                                                                        |
| -------------------------- | ------- | -------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `/api`  | Base URL of the API. Set it to the backend's URL.                          |
| `NEXT_PUBLIC_API_SUFFIX`   | `.json` | Appended to every endpoint path. Set it to an empty string for a real API. |

Both are read at build time (`next build`), like every `NEXT_PUBLIC_` variable. See [PROJECT_GUIDE.md › Data](PROJECT_GUIDE.md#data) for the query keys, hooks and what else changes with a real backend.

## Routes

Every route is prerendered at build time. Dynamic routes list their pages with `generateStaticParams` (`dynamicParams = false`), so only the menu's dishes and categories and the order IDs in `public/api/orders.json` (history plus the `newOrderIds` pool) exist.

| Route                                                                                | Screen                                                                                               |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `/`                                                                                  | Welcome and table confirmation; the closed / paused / offline screen when ordering is unavailable    |
| `/menu`                                                                              | Menu home                                                                                            |
| `/menu/[category]`                                                                   | Category                                                                                             |
| `/dish/[slug]`                                                                       | Food detail (`?edit=<line key>` edits a cart line)                                                   |
| `/search`                                                                            | Search (`?q=`)                                                                                       |
| `/cart`                                                                              | Cart and empty cart                                                                                  |
| `/checkout/details`, `/checkout/verify`, `/checkout/payment`, `/checkout/processing` | Checkout steps. Show the restaurant-state screen instead while ordering is closed, paused or offline |
| `/order/[id]/confirmed`                                                              | Order confirmation                                                                                   |
| `/order/[id]`, `/order/[id]/track`                                                   | Order details and live tracking                                                                      |
| `/orders`                                                                            | My orders                                                                                            |
| `/help`, `/help/bill`, `/help/bill-requested`, `/help/waiter-requested`              | Service: help, request the bill, request confirmations                                               |
| `/styleguide`                                                                        | Design-system board                                                                                  |

## Preview parameters

The prototype's states can be opened directly, for demos, reviews and tests:

| Parameter                                           | Where                  | Effect                                                                                                           |
| --------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `?table=NN&qr=TOKEN`                                | Any page (the QR link) | Starts a guest session at table NN (1–`MAX_TABLE`); see [QR link](#qr-link). `&qr=` is optional for now.         |
| `?status=closed`                                    | Any page               | Restaurant closed: the welcome page shows the closed screen, the menu is read-only and checkout is blocked.      |
| `?status=paused`                                    | Any page               | Ordering paused: banner on the menu and cart, the cart still works, checkout shows "Our kitchen needs a moment". |
| `?status=offline`                                   | Any page               | Simulates a lost connection (banner, checkout blocked). **Try again** ends it.                                   |
| `?status=open`                                      | Any page               | Ends a `?status` preview.                                                                                        |
| `?state=payment-failed`, `?state=payment-cancelled` | `/checkout/processing` | Payment failed / cancelled outcomes.                                                                             |

A `?status` preview is kept in sessionStorage, so it stays on while you browse in that tab. Without one, the status comes from `status` in GET /restaurant (`public/api/restaurant.json`), and the offline state follows the browser's real connection (`navigator.onLine` and the `online` / `offline` events).

### QR link

Each table's QR code opens `/?table=12&qr=<token>`. `table` is the table number; `qr` is reserved for a signed table token (so guests can't just edit the number) and is passed on with the session but not checked yet. Every guest who scans gets their own **guest session** at that table, so several people at one table can order separately: their own cart, checkout, waiter and bill requests, and "Just my orders" on the bill. Re-scanning the same table (or refreshing) keeps the session; scanning another table, or coming back after `TABLE_SESSION_HOURS` (6), starts a new one. A link without `?table` reuses the current session, or starts one at the restaurant's `defaultTable`. See "Guest sessions" in [PROJECT_GUIDE.md](PROJECT_GUIDE.md).

## Testing

```bash
npm test                 # unit tests
npm run build
npm run test:e2e         # Playwright at 390px (mobile) and 1280px (desktop)
```

The end-to-end tests serve `out/` on port 4173 and use the installed Google Chrome. On CI, set `PW_CHANNEL=chromium` (and run `npx playwright install chromium`). Specs live in `tests/e2e/`: the happy path (menu, food detail, cart, checkout, confirmation), failed payment and quick-add, orders and tracking, service requests, guest sessions (`sessions.spec.ts`: two guests at one table) and the restaurant states (`states.spec.ts`).

## Deploying

`npm run build` writes a self-contained static site to `out/`. Upload that folder to any static host or CDN (S3 + CloudFront, Netlify, Vercel static, Nginx…).

- URLs use trailing slashes (`/menu/`), and every page is an `index.html` in its own folder. Serve `404.html` for unknown paths.
- Images are not optimised at runtime (`images.unoptimized`); the files in `public/images` are served as they are.
- **Security headers must be set by the host**, because a static export can't send them: a Content-Security-Policy (scripts and styles from `'self'`; Next's inline bootstrap scripts need a hash or `'unsafe-inline'`), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone and geolocation off) and `frame-ancestors 'none'` (or `X-Frame-Options: DENY`).
- Cache `/_next/static/*` as immutable; keep HTML short-lived so menu updates show up straight away.

## What is mock, and must be replaced before production

This is a front-end prototype. Before real guests use it:

| Mock                        | Where                                                                                                                                                                       | Replace with                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| OTP (always `123456`)       | `MOCK_OTP` in `src/lib/constants.ts`, `lib/checkout.ts`                                                                                                                     | An SMS OTP service, verified on a server, with rate limiting.                                           |
| Payment                     | `/checkout/processing` ("Prototype: success / failure" links, 4:32 timer)                                                                                                   | The payment partner's checkout or UPI intent flow, with server-side confirmation and webhooks.          |
| Order IDs                   | Pre-rendered pool `A105`–`A124` (`newOrderIds` in `public/api/orders.json`)                                                                                                 | IDs from the order API, and order pages that fetch by ID (a static export can only serve IDs it built). |
| Orders, tracking, requests  | localStorage / sessionStorage on the guest's device                                                                                                                         | An order and service-request API, with live status updates (polling, SSE or WebSockets).                |
| Table token, guest sessions | `?table=NN` trusted as-is (`&qr=` is kept but not checked); sessions made in the browser (`src/api/session.ts`)                                                             | `POST /sessions` with a signed, expiring table token checked by the server, so tables can't be guessed. |
| Restaurant status and hours | `status`, hours and `pausedForMinutes` in `public/api/restaurant.json`                                                                                                      | A live status from the restaurant system. Remove or protect the `?status` preview.                      |
| Menu and prices             | `public/api/menu.json` (dishes not in the designs pad the design's counts)                                                                                                  | The restaurant's menu and stock feed; prices must be re-checked by the server when an order is placed.  |
| Placeholders                | `[RESTAURANT PHONE]`, `tel:+910000000000`, `[RESTAURANT ADDRESS]`, `[NETWORK NAME]`, `[PAYMENT PARTNER]`, social links in `restaurant.social` (platform home pages for now) | The restaurant's real details.                                                                          |

## Project layout

```
src/api/          Data access: endpoint config, fetch client, TanStack Query queries and hooks, adapters, build-time helpers
src/app/          Routes: thin server pages that set metadata and render one view
src/components/   ui/ (design system), layout/, home/, menu/, cart/, checkout/, order/, service/, status/
src/context/      Client state providers (guest session and table, cart, orders, checkout, service requests…)
src/hooks/        Client hooks (useCart, useTable, useOrderingAvailability, useOnlineStatus…)
src/lib/          Pure logic: pricing, formatting, cart lines, menu queries, checkout, orders, restaurant status
src/styles/       tokens.css, globals.css, patterns.module.css
public/api/       Dummy API responses (JSON)
tests/            unit/ (Vitest) and e2e/ (Playwright)
```
