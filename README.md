# The Olive Table

A QR-code ordering web app for a multi-branch restaurant brand. Guests scan the code on their
table, order from their phone and pay online or in person; staff run the floor and the kitchen
from the same app; Settings configure each branch.

- **Stack:** Next.js 16 (App Router, static export), React 19, TypeScript, CSS Modules, TanStack
  Query. No UI framework.
- **Backend:** `restaurant-backend`. All data goes through a typed API layer (`src/api`) over the
  contract in `src/api/contracts.ts`; built with `NEXT_PUBLIC_BACKEND_URL`, every server-owned
  endpoint goes to the backend and staff screens get live updates over Server-Sent Events.
  Without it, an in-browser mock server (`src/api/mock`) answers the same contract.
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
| `npm run build`      | Static export to `out/`                               |
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

| Variable                          | Default   | Purpose                                                 |
| --------------------------------- | --------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_BACKEND_URL`         | unset     | restaurant-backend (`…/v1`) for the endpoints it serves |
| `NEXT_PUBLIC_API_MOCK`            | on        | `false` sends every request to the real backend         |
| `NEXT_PUBLIC_API_BASE_URL`        | `/api`    | Base URL of the API                                     |
| `NEXT_PUBLIC_API_SUFFIX`          | `.json`   | Appended to endpoint paths; set to empty for a real API |
| `NEXT_PUBLIC_API_MOCK_LATENCY_MS` | `200-400` | Mock response time: a range or a single number          |

Connecting restaurant-backend while it's being built (copy `.env.example` to `.env.local`):
[docs/data-and-api.md](docs/data-and-api.md#connecting-restaurant-backend-area-by-area).

## Apps and entry points

| App      | Routes                                                          | Documentation                          |
| -------- | --------------------------------------------------------------- | -------------------------------------- |
| Guest    | `/`, `/start`, `/menu`, `/cart`, `/checkout`, `/order`, `/help` | [docs/guest-app.md](docs/guest-app.md) |
| Staff    | `/admin/login`, `/admin/dashboard/*`                            | [docs/staff-app.md](docs/staff-app.md) |
| Kitchen  | `/admin/kitchen-dashboard/*`                                    | [docs/staff-app.md](docs/staff-app.md) |
| Settings | `/admin/dashboard/settings/*`                                   | [docs/settings.md](docs/settings.md)   |

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

- URLs use trailing slashes (`/menu/`); every page is an `index.html` in its own folder. Serve
  `404.html` for unknown paths.
- Images are served as they are (`images.unoptimized`).
- **The host must send the security headers**, because a static export cannot:
  `Content-Security-Policy` (scripts and styles from `'self'`; Next's inline bootstrap scripts
  need a hash or `'unsafe-inline'`), `Strict-Transport-Security`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera,
  microphone, geolocation off) and `frame-ancestors 'none'`.
- Cache `/_next/static/*` as immutable; keep HTML short-lived.

## Status

The UI is complete for guests, staff, the kitchen and Settings, and runs on `restaurant-backend`.
Reports are next; the admin dashboard redesign, role-based access and the kitchen's hold and fire
come later. See [docs/roadmap.md](docs/roadmap.md) for the production checklist and known
issues.
