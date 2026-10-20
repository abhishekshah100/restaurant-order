# How-to recipes

Step-by-step recipes for the changes most often made to The Olive Table. Each recipe follows an
existing feature in the codebase and names it, so you can open that feature next to the steps.

## Contents

- [Run the app and the tests locally](#run-the-app-and-the-tests-locally)
- [Add a guest page](#add-a-guest-page)
- [Add an admin page in the shell](#add-an-admin-page-in-the-shell)
- [Add a Settings page](#add-a-settings-page)
- [Add an API endpoint](#add-an-api-endpoint)
- [Add or change copy](#add-or-change-copy)
- [Add a master value](#add-a-master-value)
- [Add a branch's reference data](#add-a-branchs-reference-data)
- [Related](#related)

## Run the app and the tests locally

Requires Node.js 20.9 or later (`engines` in [`package.json`](../package.json)).

1. Install dependencies: `npm install`.
2. Start the dev server: `npm run dev`, then open `http://localhost:3000`. The mock server answers
   every server-owned endpoint in the browser; no backend is needed.
3. Sign in to the staff app at `/admin/login/` with the demo account in
   [`src/api/mock/demoAdmin.ts`](../src/api/mock/demoAdmin.ts). Under `npm run dev` the staff
   pages show sample floor activity and bookings; set `NEXT_PUBLIC_ADMIN_DEMO=false` to turn it
   off.
4. Before pushing, run the checks:

| Script                 | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `npm run lint`         | ESLint with zero warnings allowed                      |
| `npm run typecheck`    | `tsc --noEmit`                                         |
| `npm run format:check` | Prettier check (`npm run format` rewrites)             |
| `npm test`             | Vitest unit tests in `tests/unit/` (jsdom, no latency) |
| `npm run test:watch`   | Vitest in watch mode                                   |
| `npm run build`        | Static export to `out/`                                |
| `npm start`            | Serves `out/` on port 3000                             |
| `npm run test:e2e`     | Playwright tests in `tests/e2e/` against `out/`        |

End-to-end tests serve the static export, so run `npm run build` first. They use the installed
Google Chrome by default; set `PW_CHANNEL=chromium` to use Playwright's Chromium (see
[`playwright.config.ts`](../playwright.config.ts)). A single unit test file runs with
`npx vitest run tests/unit/<name>.test.ts`.

Mock behaviour is configured with environment variables read in
[`src/api/config.ts`](../src/api/config.ts), for example
`NEXT_PUBLIC_API_MOCK_LATENCY_MS=0` for instant responses.

## Add a guest page

The app is a static export (`output: 'export'` in [`next.config.ts`](../next.config.ts)), so every
route must be known at build time. Choose one of two patterns.

**Pattern A: a fixed set of paths** (for example `/dish/[slug]/`, `/menu/[category]/`). Use it
when the values come from reference data available at build time.

1. Create `src/app/<segment>/[param]/page.tsx`.
2. Export `dynamicParams = false` and `generateStaticParams`, reading the dummy JSON through a
   build-time reader in [`src/api/server.ts`](../src/api/server.ts) (add one beside
   `getDishSlugsServer` if needed).
3. Export `generateMetadata`, taking words from content with `getContent`.
4. Render a client component from `src/components/<area>/` and pass it the param. Branch-specific
   data (prices, availability) is read on the client.

Following [`src/app/(guest)/dish/[slug]/page.tsx`](<../src/app/(guest)/dish/[slug]/page.tsx>):

```tsx
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getDishSlugsServer()).map((slug) => ({ slug }));
}

export default async function DishPage({ params }: Props) {
  return <DishDetail slug={(await params).slug} />;
}
```

**Pattern B: one page that reads a query string** (for example `/order/track/?id=A105`,
`/admin/dashboard/tables/view/?table=5`). Use it when the value is created at run time (order ids,
tables added in Settings), so no new build is needed.

1. Create `src/app/<segment>/page.tsx` with `generateMetadata` and a client component, as in
   [`src/app/(guest)/order/track/page.tsx`](<../src/app/(guest)/order/track/page.tsx>).
2. In the component, read the value with `useQueryParam(name)` from
   [`src/hooks/useQueryParam.ts`](../src/hooks/useQueryParam.ts). It returns `null` during
   prerender and hydration, so the page needs no `Suspense` boundary (which `useSearchParams`
   would require). Handle `null` as "not yet known".
3. Add a path helper that builds the URL with its query string, as `tablePath` and
   `reservationsPath` do in [`src/lib/adminNav.ts`](../src/lib/adminNav.ts).

For either pattern:

- Add the page's title and description to the namespace's `meta` object in content (for
  example `orders › meta.tracking`).
- Shared data (content, branches) is already in the query cache: the root layout calls
  `prefetchAppData`; guest pages also get the default branch's menu (`prefetchGuestData`, in
  `app/(guest)/layout.tsx`). A guest page goes under `src/app/(guest)/`.
- `trailingSlash: true` is set, so link to paths ending in `/`.
- Add an end-to-end test under `tests/e2e/`.

## Add an admin page in the shell

Every route under `/admin/dashboard/` is rendered inside `AdminShell` by
[`src/app/admin/dashboard/layout.tsx`](../src/app/admin/dashboard/layout.tsx). The shell does the
access check (signed in, branch selected), the navigation and the top bar. Follow the Reservations
page.

1. Create `src/app/admin/dashboard/<page>/page.tsx`:

   ```tsx
   import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
   import { ReservationsBoard } from '@/components/admin/reservations/ReservationsBoard';

   export const generateMetadata = () => adminMetadata('reservations');

   export default function AdminReservationsPage() {
     return <ReservationsBoard />;
   }
   ```

2. Add the page id to the `AdminPage` union in
   [`src/app/admin/dashboard/adminMetadata.ts`](../src/app/admin/dashboard/adminMetadata.ts) and
   its title to `common › adminShell.meta.<page>` in
   [`public/api/content/common.json`](../public/api/content/common.json). `adminMetadata` also
   marks the page `noindex`.
3. Build the page component in `src/components/admin/<area>/` as a client component. Read the
   branch with `useAdminWorkspace()` from
   [`src/components/admin/shell/AdminWorkspace.tsx`](../src/components/admin/shell/AdminWorkspace.tsx),
   data with the hooks in [`src/api/hooks.ts`](../src/api/hooks.ts) and words with
   `useContent('common')` under a new `common › admin<Area>` key.
4. If the page belongs in the navigation, add its id to `AdminNavId` and an entry to `ADMIN_NAV`
   in [`src/lib/adminNav.ts`](../src/lib/adminNav.ts) (`tab: true` puts it on the mobile tab bar,
   otherwise it goes under More; `badge` adds a live count). Add the label to
   `common › adminShell.nav.<id>`. If other pages link to it, add the path to `ADMIN_LINKS` or a
   path helper there.
5. Put pure logic (filters, views, totals) in `src/lib/admin<Area>.ts` with a unit test in
   `tests/unit/`, and add an end-to-end test `tests/e2e/admin-<area>.spec.ts`.

Kitchen pages follow the same pattern under `src/app/admin/kitchen-dashboard/`, with
`kitchenMetadata` and the navigation in [`src/lib/kitchenNav.ts`](../src/lib/kitchenNav.ts).

## Add a Settings page

A Settings page edits one section of the branch's settings: it holds a draft, checks it, and saves
it with `PATCH /admin/branches/:branchId/settings`. The Services page is the most recent and
smallest example; this recipe follows how it was added. Replace `services` with your section id.

**Types and logic**

1. Add the section's type to [`src/types/branchSettings.ts`](../src/types/branchSettings.ts) and a
   field to `BranchSettings`. `BranchSettingsSection` is `keyof BranchSettings`, and
   `UpdateBranchSettingsRequest` is `Partial<BranchSettings>`, so both follow.

   ```ts
   /** Settings › Services: the ways guests can order at the branch (at least one). */
   export type ServicesSettings = Record<OrderMode, boolean>;
   ```

2. In [`src/lib/branchSettings.ts`](../src/lib/branchSettings.ts):
   - add a reader (`servicesOf(branch)`) and call it from `settingsOf`;
   - add a checker (`servicesErrors(...)`) that returns `SettingsError[]`, adding any new error
     codes to the `SettingsError` union;
   - add a writer (`withServices(branch, value)`) and call it from `applySettings`.

**Mock server**

3. In [`src/api/mock/handlers/adminSettings.ts`](../src/api/mock/handlers/adminSettings.ts):
   - add a body reader (`servicesBody`) that checks the shape only and calls `bad()` (400) on
     anything wrong;
   - add the section id to the `known` set in `updateBranchSettings`;
   - add a block that reads the body, runs the same checker from `lib/branchSettings` (refusing
     with `bad()` on any error) and calls `apply({ services })`.
4. Update the JSDoc of `BranchSettingsResponse` in [`src/api/contracts.ts`](../src/api/contracts.ts)
   with the new section and checker.

**Page**

5. Add the section id to `SettingsSectionId` and an entry to `SETTINGS_GROUPS` in
   [`src/lib/adminSettings.ts`](../src/lib/adminSettings.ts):

   ```ts
   { id: 'services', href: settingsPath('services'), icon: 'cutlery' },
   ```

6. Create the editor in `src/components/admin/settings/<page>/` using `SettingsEditor` from
   [`src/components/admin/settings/shared/SettingsEditor.tsx`](../src/components/admin/settings/shared/SettingsEditor.tsx).
   `section` picks the settings section; `check` returns the errors that block saving. The render
   function receives the draft `value` and `set`. Following
   [`ServicesEditor.tsx`](../src/components/admin/settings/services/ServicesEditor.tsx):

   ```tsx
   <SettingsEditor
     section="services"
     title={t('adminSettings.sections.services.title')}
     subtitle={t('adminSettings.services.subtitle')}
     check={(value, data) => servicesErrors(value, data.settings.delivery.zones.length)}
   >
     {({ value, set }) => <SettingsCard title={t('adminSettings.services.card')}>…</SettingsCard>}
   </SettingsEditor>
   ```

   The editor handles loading, the save bar, the first error message, saving through
   `useUpdateBranchSettings` and the leave guard. Reuse `SettingsCard`, `ToggleRow`, `FieldGrid`,
   `SettingsNote` and the number helpers from the same file.

7. Create `src/app/admin/dashboard/settings/<page>/page.tsx`; the settings layout wraps it in
   `SettingsFrame`, which lists `SETTINGS_GROUPS` beside the page:

   ```tsx
   export const generateMetadata = () => adminMetadata('services');

   export default function AdminServicesPage() {
     return <ServicesEditor />;
   }
   ```

8. Add the page id to `AdminPage` in `adminMetadata.ts`.
9. Optionally add a one-line summary for the overview card in `useSummaries` in
   [`src/components/admin/settings/SettingsHome.tsx`](../src/components/admin/settings/SettingsHome.tsx).

**Copy** (all in [`public/api/content/common.json`](../public/api/content/common.json))

10. Add:
    - `adminShell.meta.<page>` (browser title);
    - `adminSettings.sections.<id>.title`, `.description` and any summary strings;
    - `adminSettings.<id>.*` for the page's own words;
    - `adminSettings.errors.<code>` for each new `SettingsError`.

**Tests**

11. Add cases to [`tests/unit/branchSettings.test.ts`](../tests/unit/branchSettings.test.ts) (the
    reader, checker and writer; the test that lists every section key in `settingsOf` must include
    the new one) and to
    [`tests/unit/branchSettingsServer.test.ts`](../tests/unit/branchSettingsServer.test.ts) (saved
    through the mock server, refused with 400 when invalid). Add a flow to
    [`tests/e2e/admin-settings.spec.ts`](../tests/e2e/admin-settings.spec.ts).

## Add an API endpoint

The contract is the source of truth: the app calls the endpoint through typed functions, and the
mock server implements it until a backend does. Follow the reservations endpoints. The names
below (`notes`, `NoteInput`) are placeholders.

1. **Contract.** In [`src/api/contracts.ts`](../src/api/contracts.ts), add the request and
   response types under the right section comment, with JSDoc stating the method and path, who is
   authorised, the success status and body, every error status and code, and any mock-only
   behaviour. Reuse domain types from `src/types/` and master types from `@/config/masters`.
2. **Endpoint function.** Add a function to the `api` object in
   [`src/api/endpoints.ts`](../src/api/endpoints.ts), using `apiGet`, `apiPost`, `apiPatch` or
   `apiDelete`, `seg` for path segments and `bearer(token)` for staff endpoints:

   ```ts
   reservations: (token: string, branchId: string) =>
     apiGet<ReservationsResponse>(`admin/branches/${seg(branchId)}/reservations`, bearer(token)),
   ```

3. **Reads.** Add a `queryOptions` factory to [`src/api/queries.ts`](../src/api/queries.ts). Use
   `skipToken` while a token or id is missing; choose `staleTime` and polling to match how often
   the data changes. Keys start with `'admin'` for staff data; keys under
   `['admin', 'service', …]` are refreshed together after floor changes.

   ```ts
   export const reservationsQuery = (token: string | null, branchId: string | undefined) =>
     queryOptions({
       queryKey: ['admin', 'service', 'reservations', branchId, token] as const,
       queryFn: token && branchId ? () => api.reservations(token, branchId) : skipToken,
       staleTime: 0,
       refetchInterval: BRANCH_SERVICE_REFRESH_MS,
     });
   ```

   Then expose a hook in [`src/api/hooks.ts`](../src/api/hooks.ts):

   ```ts
   export const useReservations = (branchId: string | undefined) =>
     useQuery(reservationsQuery(useAdminToken(), branchId));
   ```

4. **Writes.** Add a mutation hook to [`src/api/mutations.ts`](../src/api/mutations.ts). Use
   `requireToken(token)` for staff calls. Invalidate (or set) every query the change affects in
   `onSuccess` or `onSettled`; reuse helpers such as `refreshFloor` and `refreshBranches`. A
   simplified `useSaveReservation`:

   ```ts
   export function useSaveReservation() {
     const client = useQueryClient();
     const token = useAdminToken();
     return useMutation({
       mutationFn: ({ branchId, body }: { branchId: string; body: ReservationInput }) =>
         api.createReservation(requireToken(token), branchId, body),
       onSettled: () => refreshFloor(client),
     });
   }
   ```

5. **Mock handler.** Add a `Handler` in `src/api/mock/handlers/<area>.ts`. A handler receives
   `(ctx, { params, body, headers })` and returns `ok(body, status)`; it refuses with
   `fail(status, code)` from [`src/api/mock/context.ts`](../src/api/mock/context.ts). Authorise
   staff calls with `adminBranch(ctx, headers, params.branchId)` from `handlers/adminSessions`.
   Put shared rules in `src/lib/` so the page and the handler apply the same checks, and
   backend-owned constants in [`src/api/mock/rules.ts`](../src/api/mock/rules.ts).
6. **Route.** Register it in `ROUTES` in [`src/api/mock/server.ts`](../src/api/mock/server.ts).
   Routes match in order, so put a specific path before a parameterised one that would also match
   it.

   ```ts
   ['GET', 'admin/branches/:branchId/reservations', listReservations],
   ```

7. **Storage (if it stores data).** In [`src/api/mock/db.ts`](../src/api/mock/db.ts), add a key to
   `MOCK_KEYS` (versioned, for example `olive.mock.notes.v1`), a runtime guard for the stored
   shape, a field on `MockDb` and its `table(...)` in `createStorageDb`. Validate codes against
   master sets, as `RESERVATION_STATUS_SET` does.
8. **Test.** Add `tests/unit/<area>Server.test.ts` using `createTestServer` from
   [`tests/apiState.tsx`](../tests/apiState.tsx), as
   [`tests/unit/reservationsServer.test.ts`](../tests/unit/reservationsServer.test.ts) does: sign
   in with `DEMO_ADMIN`, call the route, and assert statuses and bodies for the success and every
   documented error.

Reference data that never changes at run time (a new JSON file under `public/api/`) needs no
handler: requests the mock server does not route fall through to the static files.

## Add or change copy

All on-screen text lives in `public/api/content/<namespace>.json`. ESLint
(`react/jsx-no-literals` and a `no-restricted-syntax` rule for text props such as `aria-label`,
`title`, `placeholder`) rejects hard-coded strings in `.tsx` files.

1. Add or edit the string in the namespace's JSON. Keys are typed from the JSON itself
   (`ContentMap` in [`src/api/queries.ts`](../src/api/queries.ts)), so a misspelled key fails
   `npm run typecheck`.
2. Read it in a client component with `useContent(namespace)`, or in a server component
   (`generateMetadata`) with `getContent(namespace)` from
   [`src/api/server.ts`](../src/api/server.ts). Both return the same translator
   ([`src/api/translator.ts`](../src/api/translator.ts)):

   | Need          | JSON                                    | Call                              |
   | ------------- | --------------------------------------- | --------------------------------- |
   | Placeholder   | `"title": "Table {table}"`              | `t('title', { table })`           |
   | Plural        | `"count": { "one": "…", "other": "…" }` | `t.plural('count', n)`            |
   | Rich text     | `"lede": "Sent to <b>{phone}</b>"`      | `t.rich('lede', { b: (c) => … })` |
   | List or group | any array or object                     | `t.get('faqs.items')`             |
   - `t.plural` picks `one` when the count is 1, otherwise `other`, and fills `{count}`.
   - `t.rich` turns each `<tag>…</tag>` into the element its renderer returns; tags do not nest.
     See [`WaiterRequestDialog.tsx`](../src/components/service/WaiterRequestDialog.tsx).
   - Unknown placeholders are left as they are.

3. Words that differ by country go under a key per country code (for example
   `checkout › details.errors.phonePrefix.<CODE>`) or come from `useRegionCopy()` in
   [`src/hooks/useRegionCopy.ts`](../src/hooks/useRegionCopy.ts) as placeholders
   (`{currencyName}`, `{taxInvoice}`, `{paymentMethods}`).
4. To add a namespace, create `public/api/content/<ns>.json`, add `<ns>` to
   `CONTENT_NAMESPACES` and a `typeof` import to `ContentMap` in `src/api/queries.ts`.
   `prefetchAppData` then builds it into every page.
5. Words for a master code go at the path named in the master's header comment; see
   [Masters and configuration](masters-and-config.md).

## Add a master value

The full checklist is in
[Masters and configuration](masters-and-config.md#checklist-adding-a-value-to-a-master). In short:

1. Add the code to the master in `src/config/masters/<area>.ts`.
2. Add its words at the content path named in that file's header comment.
3. Run `npm run typecheck` and fill every record keyed by the master's type that now fails.
4. Update handlers, presets or branch data that offer the value.
5. Run `npx vitest run tests/unit/masters.test.ts`.

## Add a branch's reference data

Branches are dummy reference data in `public/api/`. Staff can also add branches at run time in
Settings › Branches (stored by the mock server); this recipe adds one to the data itself.

1. Add an entry to [`public/api/branches.json`](../public/api/branches.json). Copy an existing
   branch in the same country and change its `id` (lower-case, hyphenated, for example
   `ktm-thamel`), identity, contact and hours. Keep `country`, `locale`, `currency`, `timezone`,
   `mobile`, `tax` and `payments` consistent with the country's entry in
   [`src/config/regions.ts`](../src/config/regions.ts) and `COUNTRY_DEFAULTS`.
2. Create `public/api/branches/<id>/` with:
   - `menu.json`: categories, dishes and the curated lists (`chefsPicks`, `cartSuggestions`, …);
     copy a branch's and adjust prices;
   - `promotions.json`: `{ "codes": [], "offers": [] }` at minimum;
   - `floors.json`: the areas and tables, numbered within the branch's `tables` range.
3. Optionally add orders with `"branchId": "<id>"` to
   [`public/api/orders.json`](../public/api/orders.json) for order history.
4. To make it the default branch, set `defaultBranchId` in
   [`public/api/restaurant.json`](../public/api/restaurant.json).
5. To let the demo admin manage it, add its id to `branchIds` in
   [`src/api/mock/demoAdmin.ts`](../src/api/mock/demoAdmin.ts).
6. Run `npm test`. [`tests/unit/masters.test.ts`](../tests/unit/masters.test.ts) checks that the
   branch and its promotions use master codes only (country, status, tax lines allowed in the
   country, payment methods, discount types, order types, weekdays). Then run `npm run build`:
   `/dish/[slug]/` and `/menu/[category]/` are generated from every branch's menu.

## Related

- [README](README.md)
- [Architecture](architecture.md)
- [Conventions](conventions.md)
- [Testing](testing.md)
- [Guest app](guest-app.md)
- [Staff app](staff-app.md)
- [Settings](settings.md)
- [Data and API](data-and-api.md)
- [API contract](api-contract.md)
- [Masters and configuration](masters-and-config.md)
- [How-to recipes](how-to.md)
- [Roadmap](roadmap.md)
