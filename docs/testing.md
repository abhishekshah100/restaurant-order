# Testing

How the tests are organised, how to run them, and how to write new ones, in particular tests that
exercise the in-browser mock server. It also lists the known failing tests. Read it before adding
a feature or touching a flow covered by end-to-end tests.

## Contents

- [Overview](#overview)
- [Commands](#commands)
- [Unit tests](#unit-tests)
- [Writing a mock-server test](#writing-a-mock-server-test)
- [Testing hooks and components](#testing-hooks-and-components)
- [End-to-end tests](#end-to-end-tests)
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

## Known issues

These failures exist on `main` and are not caused by your change. Do not add to them, and fix
them when you touch the area.

### Unit: reservations booking days

`tests/unit/reservations.test.ts`, test "offers three days in the branch calendar, a calendar to
60 days ahead, and the day in the address", fails. At 12:30 AM branch time `bookingDays` returns
two days (`2026-10-16`, `2026-10-17`) where the test expects three (up to `2026-10-18`). All other
unit tests pass.

### End-to-end: old default-branch name

Since commit `4a4499a`, the default branch `blr-indiranagar` is shown as **Udyog Vihar**,
**Gurgaon** (`shortName` and `city` in `public/api/branches.json`). The branch id did not change.
About 16 end-to-end tests still look for the old names "Indiranagar" or "Bengaluru" and fail:

- `adminSignIn(page, branch = 'Indiranagar')` in `tests/e2e/helpers.ts` clicks a branch button
  that no longer exists, so every spec that signs in with the default fails at sign-in.
- Specs that assert the old names directly: `admin-login.spec.ts` (the branch heading),
  `admin-select-branch.spec.ts` (the "Indiranagar" card and "Bengaluru, India"),
  `admin-branch-status.spec.ts` ("Indiranagar is open", "is paused until") and `modes.spec.ts`
  ("Takeaway from Indiranagar", "Delivery from Indiranagar").

The fix is to change the default in `adminSignIn` to `'Udyog Vihar'` and update those
assertions. The remaining mentions of "Bengaluru" (in `admin-dashboard.spec.ts`,
`admin-reservations.spec.ts`, `lifecycle.spec.ts`, `modes.spec.ts` and `promos.spec.ts`) are
comments about clock times in the `Asia/Kolkata` time zone, which the branch still uses; they do
not fail but should be reworded to avoid confusion.

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
