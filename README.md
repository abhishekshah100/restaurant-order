# The Olive Table

A QR-code ordering web app for a multi-branch restaurant brand. Guests scan the code on their
table, order from their phone and pay online or in person; staff run the floor, the kitchen, the
cash register, stock and purchasing from the same app; managers read the Sales report; Settings
configure each branch, its staff and their roles.

- **Stack:** Next.js 16 (App Router, static export), React 19, TypeScript, CSS Modules, TanStack
  Query. No UI framework.
- **Backend:** `restaurant-backend`. All data goes through a typed API layer (`src/api`) over the
  contract in `src/api/contracts/` (one file per area); built with `NEXT_PUBLIC_BACKEND_URL`,
  every server-owned endpoint goes to the backend and staff screens get live updates over
  Server-Sent Events. Without it, an in-browser mock server (`src/api/mock`) answers the guest
  and floor screens; newer staff areas (cash, inventory, sales…) need the backend.
- **Branches:** Udyog Vihar, Gurgaon (India, default; id `blr-indiranagar`) and Thamel, Kathmandu
  (Nepal; id `ktm-thamel`). Currency, time zone, taxes, phone rules and payment methods are per
  branch and editable in Settings.

**Documentation:** [docs/README.md](docs/README.md) is the entry point (architecture, conventions,
each app area, the API contract, how-to recipes and the roadmap).

## Contents

- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Configuration](#configuration)
- [Apps and entry points](#apps-and-entry-points)
- [Preview parameters](#preview-parameters)
- [Project layout](#project-layout)
- [Deploying](#deploying)
- [Status](#status)

## Getting started

Requires Node.js 20.9 or later.

```bash
npm install
npm run dev
```

| Open                               | For                                                 |
| ---------------------------------- | --------------------------------------------------- |
| http://localhost:3000/?table=12    | Guest at table 12 of the default branch             |
| http://localhost:3000/start/       | Guest without a table: choose outlet and order type |
| http://localhost:3000/admin/login/ | Staff: choose **Use demo account**                  |
| http://localhost:3000/styleguide/  | Design-system board                                 |

The OTP in development is `123456` (backend and mock). In a mock-only build, data lives in the
browser's storage: clear site data to reset it.

## Scripts

| Script               | What it does                                          |
| -------------------- | ----------------------------------------------------- |
| `npm run dev`        | Dev server with hot reload                            |
| `npm run build`      | Static export to `out/`, then adds the CSP to pages   |
| `npm start`          | Serves `out/` on http://localhost:3000                |
| `npm run typecheck`  | TypeScript, no emit                                   |
| `npm run lint`       | ESLint, zero warnings allowed                         |
| `npm run format`     | Prettier (write); `npm run format:check` only checks  |
| `npm test`           | Vitest unit and mock-server tests (`tests/unit`)      |
| `npm run test:watch` | Vitest in watch mode                                  |
| `npm run test:e2e`   | Playwright against `out/` (run `npm run build` first) |

End-to-end tests can also run against the backend (`E2E_BACKEND=true`, its own database): see
[docs/testing.md](docs/testing.md#end-to-end-tests-against-the-backend).

Before opening a pull request: `npm run typecheck && npm run lint && npm run format:check && npm
test`. See [docs/testing.md](docs/testing.md).

## Configuration

All variables are read at build time, like every `NEXT_PUBLIC_` variable.

| Variable                            | Default   | Purpose                                                   |
| ----------------------------------- | --------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_BACKEND_URL`           | unset     | restaurant-backend (`…/v1`) for the endpoints it serves   |
| `NEXT_PUBLIC_API_MOCK`              | on        | `false` sends every request to the real backend           |
| `NEXT_PUBLIC_API_BASE_URL`          | `/api`    | Base URL of the API                                       |
| `NEXT_PUBLIC_API_SUFFIX`            | `.json`   | Appended to endpoint paths; set to empty for a real API   |
| `NEXT_PUBLIC_API_MOCK_LATENCY_MS`   | `200-400` | Mock response time: a range or a single number            |
| `NEXT_PUBLIC_PAYMENT_TEST_CONTROLS` | on        | `false` hides the payment test buttons (live site only)   |
| `NEXT_PUBLIC_ADMIN_DEMO`            | on in dev | `false` hides the mock's sample floor under `npm run dev` |
| `CSP_EXTRA_ORIGINS`                 | unset     | More origins the build's CSP allows (space-separated)     |

Connecting restaurant-backend while it's being built (copy `.env.example` to `.env.local`):
[docs/data-and-api.md](docs/data-and-api.md#connecting-restaurant-backend-area-by-area).

## Apps and entry points

| App      | Routes                                                                                   | Documentation                          |
| -------- | ---------------------------------------------------------------------------------------- | -------------------------------------- |
| Guest    | `/`, `/start`, `/menu`, `/cart`, `/checkout`, `/order`, `/help`                          | [docs/guest-app.md](docs/guest-app.md) |
| Staff    | `/admin/login`, `/admin/dashboard/*` (floor, cash, inventory, purchasing, sales, audit…) | [docs/staff-app.md](docs/staff-app.md) |
| Kitchen  | `/admin/kitchen-dashboard/*`                                                             | [docs/staff-app.md](docs/staff-app.md) |
| Settings | `/admin/dashboard/settings/*`                                                            | [docs/settings.md](docs/settings.md)   |

## Preview parameters

States that are hard to reach by hand can be opened directly, for demos and reviews:

| Parameter                           | Where                  | Effect                                    |
| ----------------------------------- | ---------------------- | ----------------------------------------- |
| `?branch=ID&table=NN`               | Any guest page         | Starts a guest session at that table      |
| `?mode=takeaway` / `?mode=delivery` | Any guest page         | Starts ordering in that mode              |
| `?status=closed` / `paused`         | Any guest page         | Shows the closed or paused state          |
| `?status=offline`                   | Any guest page         | Simulates a lost connection               |
| `?status=open`                      | Any guest page         | Ends a `?status` preview                  |
| `?state=payment-failed`             | `/checkout/processing` | Failed payment (`payment-cancelled` also) |

A `?status` preview is kept for the browser tab (sessionStorage). Without one, the status comes
from the branch data and the browser's real connection.

## Project layout

```
src/app/         Routes: thin pages that set metadata and render one view
src/components/  ui/ (design system) and one folder per area (menu, cart, checkout, admin, kitchen…)
src/api/         Backend contract, transport, endpoints, queries, hooks, mutations; mock/ = mock server
src/config/      Master values (masters/) and per-country presets (regions.ts)
src/context/     Client state providers (guest session, cart, checkout, service requests…)
src/hooks/       Client hooks
src/lib/         Pure logic: pricing, fulfilment, orders, settings rules, formatting
src/types/       Domain types
src/styles/      Design tokens and global styles
public/api/      Dummy reference data and all screen copy (content/*.json)
tests/           unit/ (Vitest) and e2e/ (Playwright)
docs/            Developer documentation
```

Details: [docs/architecture.md](docs/architecture.md).

## Deploying

`npm run build` writes a self-contained static site to `out/`. Host it on any static host or CDN.
Production: the web app on **Vercel**, the API on **Render**, the database on **Neon** and Redis
on **Upstash**. Pushing `main` deploys both apps; database migrations are not run by the deploy
and go on Neon by hand (`prisma migrate status`, then `prisma migrate deploy`, from
`restaurant-backend`).

- URLs use trailing slashes (`/menu/`); every page is an `index.html` in its own folder. Serve
  `404.html` for unknown paths.
- Images are served as they are (`images.unoptimized`).
- **Security headers.** A static export cannot send headers, so the build adds a
  `Content-Security-Policy` `<meta>` to every page (`scripts/add-csp.mjs`: scripts from `'self'`
  plus the hash of each inline script; requests and images only to the site and the API). The
  rest come from the host: [`vercel.json`](vercel.json) sends `frame-ancestors 'none'`,
  `X-Frame-Options`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin` and `Permissions-Policy`. Another host needs
  the same headers, and `Strict-Transport-Security` (Vercel sends it already).
- `vercel.json` also publishes `out/` itself (`framework: null`, `outputDirectory: out`), not
  Next's own output.
- Cache `/_next/static/*` as immutable; keep HTML short-lived.

## Status

The guest app, the staff app, the kitchen and Settings are built and run on `restaurant-backend`,
with roles and permissions, the cash register, shifts and attendance, inventory and purchasing,
GST / VAT tax invoices, the audit log and the Sales report. Next: tax classes per dish, a live
payment gateway and SMS OTP, then more reports. See [docs/roadmap.md](docs/roadmap.md) for what
is next, the production checklist and known issues.
