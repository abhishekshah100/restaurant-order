# Conventions

The coding standards every change to The Olive Table must follow: styling, copy, accessibility,
naming, where logic lives, comment style and the definition of done. Most of these rules are
enforced by ESLint, TypeScript or tests; the rest are enforced in code review.

## Contents

- [Styling](#styling)
- [Copy and content](#copy-and-content)
- [Accessibility](#accessibility)
- [Naming and file organisation](#naming-and-file-organisation)
- [Logic and data](#logic-and-data)
- [Comments](#comments)
- [Definition of done](#definition-of-done)
- [Related](#related)

## Styling

The app uses plain CSS Modules on top of a small set of global files. There is no UI framework and
no Tailwind.

### Design tokens

[`src/styles/tokens.css`](../src/styles/tokens.css) defines every colour, radius, shadow,
z-index layer, duration, easing and type shorthand as a `:root` custom property. Always use a
token instead of a raw value.

| Group      | Examples                                                    |
| ---------- | ----------------------------------------------------------- |
| Colour     | `--bg`, `--surface`, `--ink`, `--ink-2`, `--brand-600`      |
| Ink alphas | `--ink-a18`                                                 |
| Radii      | `--r-xs` ... `--r-lg`, `--r-sheet`, `--r-round`             |
| Shadows    | `--sh-1`, `--sh-2-up`, `--halo`, `--focus`, `--focus-inset` |
| Layers     | `--z-nav`, `--z-dialog`, `--z-toast`                        |
| Motion     | `--dur-fast`, `--ease-emphasized`                           |
| Type       | `font: var(--font-label)`, `--f-ui`, `--f-display`          |

Custom properties cannot be used inside `@media`, so breakpoints follow the convention documented
at the top of `tokens.css`: 360, 768, 1024 and 1280px, with `max-width` values ending in `.98`
(`max-width: 1023.98px`) so ranges never overlap.

### One CSS Module per component

- Each component has its own module next to it: `DishRow.tsx` and `DishRow.module.css`. Import it
  as `styles`.
- Write mobile rules first, then desktop rules under `@media (min-width: 1024px)`.
- Class names are short and camelCase, and follow the original design classes where one exists
  (`.qty`, `.opt`, `.item`), so the code can be compared with the design CSS.
- Combine classes with `cx()` from [`src/lib/cx.ts`](../src/lib/cx.ts).
- Reuse shared blocks from [`src/styles/patterns.module.css`](../src/styles/patterns.module.css)
  (`clamp`, `chipRail`, `noScrollbar`, `hr`, `textLink`, `hitArea`, `checkbox`, `cover`) with
  `composes:` in a single-class rule:

```css
.step {
  composes: hitArea from '@/styles/patterns.module.css';
}
```

### Global styles

[`src/styles/globals.css`](../src/styles/globals.css) holds the reset, the focus ring, the
typography utilities (`.t-display`, `.t-h1`, `.t-body`, `.t-caption`), `.visually-hidden`,
`.hide-mobile` and `.hide-desktop`, and the reduced-motion and forced-colours overrides. It is
imported first in [`src/app/layout.tsx`](../src/app/layout.tsx), so a module rule beats a utility
class of equal specificity. To change a utility's colour or margin inside a component, do it in
the module.

### Rules

- Wrap `:hover` rules in `@media (hover: hover)` so touch screens do not get sticky hover states.
- A component whose own `box-shadow` would hide the global focus ring sets an explicit
  `:focus-visible` rule.
- No `!important`. The accepted exceptions are the reduced-motion and forced-colours overrides in
  `globals.css` and the print-only rules in the print sheets.
- No inline styles except for truly dynamic values, such as a skeleton's size or a bar chart's
  width. Prefer setting a custom property (`style={{ '--value': '40%' }}`) and using it in the
  module.
- Icons are `<Icon name="..." />` from `components/ui`. Names are the typed `IconName` union; a
  new icon needs a mask SVG in the same 24px, 1.8 stroke style.

## Copy and content

No user-visible or screen-reader string is written in a component. All copy lives in
`public/api/content/<namespace>.json` and is served like any other endpoint.

- **Namespaces:** `common`, `home`, `menu`, `cart`, `checkout`, `orders`, `service`, `status`,
  `kitchen` (`CONTENT_NAMESPACES` in [`src/api/queries.ts`](../src/api/queries.ts)).
- **Client components** use `useContent(ns)` from [`src/api/hooks.ts`](../src/api/hooks.ts).
- **Server code** (metadata) uses `await getContent(ns)` from
  [`src/api/server.ts`](../src/api/server.ts).
- **Typed keys:** `ContentMap` takes each namespace's type from its JSON file, and the translator
  ([`src/api/translator.ts`](../src/api/translator.ts)) only accepts dot paths that exist. A typo
  or a removed key is a type error.

```tsx
// Examples from src/components/checkout/VerifyStep.tsx
const t = useContent('checkout');

t('verify.didntGetIt'); // a plain string
t('verify.toast.resent', { phone }); // {placeholders} filled in
t.rich('verify.resendIn', { b: (chunks) => <b>{chunks}</b> }, { time }); // <b> spans as elements
t.plural('verify.errors.wrong', attemptsLeft); // { one, other } chosen by count
```

`t.get(key)` returns a raw value (a list or group), for example a list of FAQ entries to map over.

Enforcement, from [`eslint.config.mjs`](../eslint.config.mjs), for `src/**/*.tsx` except the
styleguide:

- `react/jsx-no-literals` with `noStrings: true` rejects text in JSX. Only a short list of
  punctuation and symbols is allowed (`·`, `×`, `—`, `…`, `₹`, `/`, `+`, `%`, `:` and
  similar).
- A `no-restricted-syntax` rule rejects string literals in text props: `aria-label`,
  `aria-description`, `title`, `alt`, `placeholder`, `label`, `hint`, `error`, `backLabel`,
  `description`.

Region-specific wording is data too. Copy must read correctly for every branch (India and Nepal);
words that name a region's payment methods or taxes come from the branch record or the masters.
`tests/unit/regionCopy.test.tsx` checks region-neutral copy.

## Accessibility

Accessibility is part of the definition of done, not a later pass.

- **Semantics:** use real `<button>` and `<a>` elements. Every input has a label. Icon buttons
  require a `label` prop (it is required in the `IconButton` types). Decorative icons stay
  `aria-hidden`.
- **Focus and touch:** keep the visible focus ring (`--focus`). Touch targets are at least 44px;
  small controls extend their hit area with `::before` (the `hitArea` pattern).
- **Option controls:** variant and add-on rows use `role="radio"` or `role="checkbox"` with
  `aria-checked`. Radio groups support the arrow keys.
- **Veg and non-veg:** always shown by shape (dot or triangle) as well as colour, and announced as
  "Vegetarian" or "Non-vegetarian".
- **Live regions:** toasts, quantity changes, filter result counts and order status changes use
  `aria-live`. Countdowns are not announced every second: announce when they start and when the
  state changes.
- **Toasts:** a compact pill (icon, message, its action, ✕), one at a time; it can be swiped
  away down or sideways. Hovering or focusing a toast pauses it, so its action (Undo) is
  reachable by keyboard (WCAG 2.2.1). Durations by kind are in `src/lib/constants.ts`.
- **Dialogs:** use `Dialog` from `components/ui`; it provides the focus trap, Escape, scroll lock
  and focus return. Do not build ad-hoc overlays.
- **Motion:** `prefers-reduced-motion` turns animations off globally.
- **Contrast:** every text pairing is at least 4.5:1. Disabled button text uses `--disabled-ink`
  (5.2:1). Check new colour pairings against the tokens before using them.

## Naming and file organisation

| Kind             | Location                    | Naming                                             |
| ---------------- | --------------------------- | -------------------------------------------------- |
| Route            | `src/app/<path>/page.tsx`   | Default export `XxxPage`                           |
| View or part     | `src/components/<area>/`    | `PascalCase.tsx` plus `PascalCase.module.css`      |
| UI primitive     | `src/components/ui/<Name>/` | One folder per primitive, exported from `index.ts` |
| Component hook   | Next to its component       | `useTicketActions.ts`                              |
| Shared hook      | `src/hooks/`                | `useCamelCase.ts`                                  |
| Pure logic       | `src/lib/`                  | `camelCase.ts` by domain (`pricing.ts`)            |
| Types            | `src/types/`                | By domain (`order.ts`, `branch.ts`)                |
| Fixed code lists | `src/config/masters/`       | One file per area                                  |
| Mock handler     | `src/api/mock/handlers/`    | One file per resource                              |
| Unit test        | `tests/unit/`               | `<module>.test.ts`, `<area>Server.test.ts`         |
| End-to-end test  | `tests/e2e/`                | `<flow>.spec.ts`                                   |

- Import with the `@/` alias (`@/lib/pricing`), not long relative paths. Sibling files in the same
  folder use `./`.
- Export components by name; only route files use default exports.
- Props interfaces are named `<Component>Props` and documented field by field.
- Navigation lists live in one place: [`src/lib/adminNav.ts`](../src/lib/adminNav.ts) and
  [`src/lib/kitchenNav.ts`](../src/lib/kitchenNav.ts). Build links with the helpers
  (`orderPath`, `tablePath`), never by string concatenation in a component.
- Storage keys are declared once: `STORAGE_KEYS` in [`src/lib/storage.ts`](../src/lib/storage.ts)
  and `MOCK_KEYS` in [`src/api/mock/db.ts`](../src/api/mock/db.ts). Version the key
  (`.v1`, `.v2`) when the stored shape changes.

## Logic and data

- **Pure functions in `src/lib`.** Files there import no React and no data. Everything they need
  comes in as arguments: a branch, its rules, a `Money` or a `Clock`. This keeps them testable
  without fixtures.
- **No hard-coded region rules.** Currency, locale, time zone, taxes, phone formats, payment
  methods and dietary marks come from the branch record (`public/api/branches.json`, edited in
  Settings). Country presets live in [`src/config/regions.ts`](../src/config/regions.ts) and fixed
  code lists in [`src/config/masters`](../src/config/masters). Never branch on a branch id or a
  country in code.

```ts
// Good: the region comes in as data.
const money = createMoney(branch);
const clock = createClock(branch);

// Bad: a region rule in code.
const symbol = branch.id === 'ktm-thamel' ? 'रू' : '₹';
```

- **Components stay thin.** They receive data and call callbacks; computation belongs in `lib`
  or a hook.
- **Server data only through `src/api`.** Never call `fetch`, read API JSON or keep server data in
  storage from a component. Use the read hooks and the mutation hooks.
- **Validate what you read.** Storage reads go through `readJSON` with a type guard; malformed
  values are dropped, not trusted.
- **Hydration-safe rendering.** Anything that depends on the browser (storage, the URL, media
  queries) renders after hydration (`useHydrated`, or a hook built on `useSyncExternalStore` with
  a server snapshot).

## Comments

The codebase uses comments to explain intent and constraints, not to restate code. Follow the
same style:

- **JSDoc on every export** that is not self-evident: one sentence in plain English, often with an
  example (`/** Full URL of an endpoint path, e.g. "menu" → "/api/menu.json". */`).
- **A block comment at the top of a module** (`/* ... */`) when the file needs context: what it
  stands for, which endpoint or rule it implements, what to change when the backend arrives.
- **Section dividers** in long files: `/* ---------- Session ---------- */`.
- **Inline comments** for the non-obvious why (a workaround, an ordering requirement, a browser
  quirk), for example the note in `layout.tsx` on importing global CSS first.
- Name endpoints and content paths in comments as the code does: `GET /orders/:id`,
  `common › meta.title`, `Settings › Floor plan`.

## Definition of done

A change is done when all of the following pass locally with no new failures:

1. `npm run typecheck`: no TypeScript errors.
2. `npm run lint`: ESLint with `--max-warnings=0`; a warning fails the build.
3. `npm run format:check`: Prettier (`npm run format` fixes it). Settings are in
   [`.prettierrc.json`](../.prettierrc.json): single quotes, semicolons, trailing commas,
   100 columns.
4. `npm test`: Vitest unit tests, including a test for new `lib` logic and new mock endpoints.
5. `npm run build`, then `npm run test:e2e`: Playwright on mobile and desktop for any flow you
   touched.
6. Copy is in `public/api/content`, the page works at 390px and 1280px, and keyboard and screen
   reader behaviour follow [Accessibility](#accessibility).
7. Documentation in `docs/` is updated when you change a route, an endpoint, a storage key or a
   convention.

Known pre-existing test failures are listed in [testing.md](testing.md#known-issues); do not add
to them.

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
