# Testing

How the tests are organised, how to run them, and how to write new ones, in particular tests that
exercise the in-browser mock server, and how to run the browser tests against the backend. Read
it before adding a feature or touching a flow covered by end-to-end tests.

## Contents

- [Overview](#overview)
- [Commands](#commands)
- [Unit tests](#unit-tests)
- [Writing a mock-server test](#writing-a-mock-server-test)
- [Testing hooks and components](#testing-hooks-and-components)
- [End-to-end tests](#end-to-end-tests)
- [End-to-end tests against the backend](#end-to-end-tests-against-the-backend)
- [Known issues](#known-issues)
- [Related](#related)

## Overview

| Layer      | Tool                                  | Location                                      |
| ---------- | ------------------------------------- | --------------------------------------------- |
| Unit       | Vitest, jsdom, React Testing Library  | [`tests/unit`](../tests/unit)                 |
| Helpers    | Fixtures, test mock server, providers | [`tests/apiState.tsx`](../tests/apiState.tsx) |
| Setup      | Global `fetch` stub, cleanup          | [`tests/setup.ts`](../tests/setup.ts)         |
| End-to-end | Playwright, against the static export | [`tests/e2e`](../tests/e2e)                   |

Both layers use the same data as the app: the dummy JSON in `public/api` is the fixture set, and
every server-owned request is answered by the real mock server in `src/api/mock`. There are no
hand-written API mocks.

## Commands

| Command              | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `npm test`           | Runs every unit test once (`vitest run`)                  |
| `npm run test:watch` | Vitest in watch mode                                      |
| `npm run build`      | Static export to `out/`; required before end-to-end tests |
| `npm run test:e2e`   | Playwright, mobile and desktop projects                   |
| `npm run typecheck`  | `tsc --noEmit`                                            |
| `npm run lint`       | ESLint with `--max-warnings=0`                            |

Useful variations:

```bash
npx vitest run tests/unit/floorsServer.test.ts     # one file
npx vitest run -t "saves a layout"                 # tests whose name matches
npx playwright test tests/e2e/promos.spec.ts       # one spec, both projects
npx playwright test --project=mobile               # one project
PW_CHANNEL=chromium npm run test:e2e               # bundled Chromium instead of Google Chrome
```

If `tsc` reports TS2344 in `.next/dev/types/validator.ts` after you add a route `layout.tsx`,
delete the stale `tsconfig.tsbuildinfo` and run the typecheck again.

## Unit tests

Configuration is in [`vitest.config.mts`](../vitest.config.mts):

- `environment: 'jsdom'`, `globals: true`, and the `@/` alias pointing at `src`.
- Only `tests/unit/**/*.test.{ts,tsx}` is collected.
- `NEXT_PUBLIC_API_MOCK_LATENCY_MS` is `0`, so the mock server answers at once.

[`tests/setup.ts`](../tests/setup.ts) runs before every file:

- Registers the `jest-dom` matchers.
- Replaces `fetch` with a stub that serves `/api/<path>.json` from `public/api` and returns 404
  for anything else.
- After each test: unmounts rendered trees, clears `localStorage` and `sessionStorage`, and clears
  the shared query client so no server data leaks between tests.

Test files fall into three groups, by naming convention:

- **`<module>.test.ts`** tests a pure `src/lib` module (`pricing.test.ts`, `money.test.ts`,
  `kitchenBoard.test.ts`). Pass data in; read fixtures with the `test*` helpers.
- **`<area>Server.test.ts`** tests mock-server endpoints end to end through the router
  (`floorsServer.test.ts`, `branchSettingsServer.test.ts`, `promosServer.test.ts`).
- **`<Name>.test.tsx`** tests a component, context or hook inside the app providers
  (`CartContext.test.tsx`, `OtpInput.test.tsx`, `apiHooks.test.tsx`).

### Helpers in `tests/apiState.tsx`

| Helper                              | Returns                                                   |
| ----------------------------------- | --------------------------------------------------------- |
| `readApiJson(endpoint)`             | Any file under `public/api`, parsed                       |
| `testRestaurant()`                  | `restaurant.json`                                         |
| `testBranches()`, `testBranch(id?)` | The branches, or one (default branch when omitted)        |
| `testMenu(branchId?)`               | A `MenuCatalog` (`getDish`, `dishesIn`, search...)        |
| `testPromotions(branchId?)`         | The branch's promotions                                   |
| `testOrderHistory(now?)`            | The drawn order history after the adapter                 |
| `testLineLabels()`                  | Cart-line description words, as the app builds them       |
| `seedGuestSession(over?)`           | Saves a live dine-in session on the device and returns it |
| `createApiState()`                  | A dehydrated cache equal to the one built at build time   |
| `createTestServer(now?, branches?)` | A mock server over Web Storage with predictable ids       |
| `TestProviders`                     | Every app provider with the API data loaded               |
| `ApiTestProvider`                   | Only the query cache with the API data loaded             |

`createTestServer` seeds the mock from the same JSON, runs on a clock you control, and generates
ids `id-1`, `id-2` and so on. The optional `branches` callback lets a test change the branch data
the server is seeded with (for example a different payment rule).

## Writing a mock-server test

Server tests call the mock router directly with `{ method, path, body, headers }` and assert on
`{ status, body }`. They need no rendering and run in milliseconds. Use
[`tests/unit/floorsServer.test.ts`](../tests/unit/floorsServer.test.ts) and
[`tests/unit/branchSettingsServer.test.ts`](../tests/unit/branchSettingsServer.test.ts) as
templates.

1. **Fix the clock.** Declare a mutable `now` and pass `() => now` to `createTestServer`, so tests
   can move time forward (opening hours, windows, expiry).
2. **Wrap the server in a `call` helper** that types the response as `ApiResponse`.
3. **Reset state in `beforeEach`.** Reset `now`, clear both storages, and sign in as the demo
   admin with `DEMO_ADMIN` ([`src/api/mock/demoAdmin.ts`](../src/api/mock/demoAdmin.ts)) when the
   endpoint is under `admin/*`. Keep the `authorization` header for later calls.
4. **Build guest flows through the API**, the same way the app does: `POST sessions`,
   `POST otp`, `POST otp/verify` with the mock code `123456` (`MOCK_OTP` in
   [`src/api/mock/rules.ts`](../src/api/mock/rules.ts)), then `POST orders`.
5. **Assert on status codes and error bodies** (`ApiErrorBody`) as well as the happy path: 401
   without a token, 400 for invalid input, 404 for unknown ids, 409 for conflicts.
6. **Assert on what follows.** After a write, read the affected endpoints (for example
   `GET branches` after saving settings) to check that the change reaches guests and staff.

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiResponse } from '@/api/client';
import type { AdminSignInResponse } from '@/api/contracts';
import type { FloorPlanLayout } from '@/types/admin';
import { DEMO_ADMIN } from '@/api/mock/demoAdmin';
import { createTestServer } from '../apiState';

let now = Date.parse('2026-10-15T13:00:00Z');
const server = createTestServer(() => now);
const call = (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) => server({ method, path, body, headers }) as Promise<ApiResponse>;

const BASE = 'admin/branches/blr-indiranagar';
let admin: Record<string, string>;

beforeEach(async () => {
  now = Date.parse('2026-10-15T13:00:00Z');
  window.localStorage.clear();
  window.sessionStorage.clear();
  const res = await call('POST', 'admin/sessions', {
    identity: DEMO_ADMIN.email,
    password: DEMO_ADMIN.password,
  });
  admin = { authorization: `Bearer ${(res.body as AdminSignInResponse).token}` };
});

describe('GET /admin/branches/:branchId/floors (mock)', () => {
  it('needs a staff session', async () => {
    expect((await call('GET', `${BASE}/floors`)).status).toBe(401);
    const res = await call('GET', `${BASE}/floors`, undefined, admin);
    expect((res.body as FloorPlanLayout).floors.length).toBeGreaterThan(0);
  });
});
```

Header names are lower case (`authorization`), as the transport passes them to the mock.

When you add an endpoint, add its route to `ROUTES` in
[`src/api/mock/server.ts`](../src/api/mock/server.ts), its types to
[`src/api/contracts.ts`](../src/api/contracts.ts), and a server test that covers success, each
error code and the effect on related reads.

## Testing hooks and components

Render inside `TestProviders` so hooks find the query cache, contexts and copy. Mock
`next/navigation` when the code under test navigates. Seed state through the API rather than by
writing storage, except for the guest session (`seedGuestSession`).
[`tests/unit/apiHooks.test.tsx`](../tests/unit/apiHooks.test.tsx) shows the pattern:

```tsx
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { TestProviders, createTestServer, seedGuestSession } from '../apiState';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/help/',
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <TestProviders>{children}</TestProviders>
);

// seedGuestSession(), place an order with createTestServer(), then:
// const { result } = renderHook(() => useLiveOrder(order.id), { wrapper });
// await waitFor(() => expect(result.current...).toBe(...));
```

Use `ApiTestProvider` instead when a provider or hook is tested on its own, without the rest of
the app's providers.

## End-to-end tests

Configuration is in [`playwright.config.ts`](../playwright.config.ts):

- The web server is `npx serve out -l 4173`, so the tests run against the **static export**. Run
  `npm run build` first; a stale `out/` tests stale code. A running server on port 4173 is reused
  outside CI.
- Two projects run every spec: `mobile` (Pixel 7, 390 x 844) and `desktop` (Desktop Chrome,
  1280 x 900).
- The browser channel is the installed Google Chrome. Set `PW_CHANNEL=chromium` on CI.
- On CI, `retries` is 2 and traces are kept on the first retry.

Every flow goes through the mock server with its normal latency (200 to 400 ms per endpoint), so
assertions must wait for results rather than assume them.

Shared helpers are in [`tests/e2e/helpers.ts`](../tests/e2e/helpers.ts):

| Helper                          | Use                                                         |
| ------------------------------- | ----------------------------------------------------------- |
| `scan(page, 'table=12')`        | Opens a table QR link and waits for the guest session       |
| `addDish(page, category, dish)` | Adds a dish from its category page and waits for the save   |
| `waitForSavedCart(page, slug)`  | Waits until the cart with that dish is in storage           |
| `orderAtCounter(page)`          | Checks out with OTP and pays at the counter; returns the id |
| `callWaiter(page)`              | Sends a waiter request from Help                            |
| `adminSignIn(page, branch?)`    | Signs in with the demo account and picks a branch           |
| `expectBranchOpen(page, name)`  | Asserts the staff shell shows that branch                   |
| `visible(page, role, name)`     | First visible match (both headers render on every page)     |

Guidelines:

- A test that needs a dine-in guest must call `scan` first; without a session the app opens the
  start screen.
- After adding to the cart, wait for the save before reloading: a new guest session opens a moment
  after the first page load.
- Use `visible()` or `.filter({ visible: true })` for controls that exist in both the mobile and
  desktop header.
- Use Playwright's clock (`page.clock`) for anything time-based: change windows, happy hour,
  reservations.
- Clear `localStorage` in `beforeEach` when a spec depends on a fresh device.
- Select elements by role and accessible name. The names come from the content JSON, so a copy
  change can break a test; update both together.
- Match order numbers with `/[A-Z]+-?\d+/`: the backend numbers them with the branch's prefix
  (`UDY-001`), the mock `A001` up. Never hard-code one.
- Fake clocks rely on the query client's microtask scheduler
  ([data-and-api.md › Transport](data-and-api.md#transport)); without it, screens stalled after a
  navigation under `installClock` / `fixClock`.

## End-to-end tests against the backend

The same specs run against `restaurant-backend` when the export is built with
`NEXT_PUBLIC_BACKEND_URL`. `againstBackend` (`E2E_BACKEND=true`) in
[`tests/e2e/helpers.ts`](../tests/e2e/helpers.ts) tells a spec which build it runs against;
checks that need the mock's drawn history or its device storage are skipped there.

1. **Database.** Use a database of its own, `olive_table_e2e`, and Redis database 14. Never
   point the tests at the development database `olive_table`: they create orders, bookings and
   settings. Reseed it (and flush Redis database 14) before each spec file, running one file at
   a time with `--workers=1`: the backend keeps data from one test to the next, while the mock
   starts each test afresh.
2. **API.** Start the backend on port 4001 with `TEST_CLOCK=true` (adds `/v1/test/clock`, which
   `installClock`, `fastForward` and `fixClock` drive, so the server's clock and `Date` header
   follow the browser's) and `QR_TOKEN_REQUIRED=false` (the helpers open unsigned `?table=`
   links). The helpers reach it at `E2E_BACKEND_URL` (default `http://localhost:4001/v1`).
3. **Build and run:**

   ```bash
   NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:4001/v1 npm run build
   E2E_BACKEND=true npx playwright test --reporter=list
   ```

   Pass `--reporter=list` so a failure does not wait on the HTML report server.

4. **Stop the API server** when the run ends (by its PID); a server left running keeps the
   output pipe open and the run never returns.

Writing specs that pass on both builds:

- Read order and booking numbers as they come (`/[A-Z]+-?\d+/`, `/R\d+/`) and use a table of
  the spec's own, since earlier tests' data is still there.
- Set times with the clock helpers, never `page.clock` alone, so the server agrees.

Last recorded run against the backend (2026-10-28): 62 passed, 7 skipped, on both the desktop
and mobile projects.

## Known issues

None known. All unit tests pass; the earlier failures (the reservations booking-days test, and
specs still looking for the old default-branch names "Indiranagar" / "Bengaluru") are fixed:
`adminSignIn` defaults to `'Udyog Vihar'`. Remaining mentions of "Bengaluru" in specs are
comments about clock times in `Asia/Kolkata`.

## Related

- [Documentation index](README.md)
- [Architecture](architecture.md)
- [Conventions](conventions.md)
- [Testing](testing.md)
- [Guest app](guest-app.md)
- [Staff app](staff-app.md)
- [Settings](settings.md)
- [Data and API](data-and-api.md)
- [API contract](api-contract.md)
- [Masters and config](masters-and-config.md)
- [How-to guides](how-to.md)
- [Roadmap](roadmap.md)
