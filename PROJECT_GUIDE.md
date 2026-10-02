# The Olive Table: project guide

This guide explains how the codebase is put together, so you can find your way around and change it safely. For setup and scripts, see [README.md](README.md).

## What this is

The Olive Table is a QR-code ordering site for a restaurant. A guest scans the code on their table (for example `/?table=12`), browses the menu, builds a cart and checks out with name, mobile number and OTP. They pay online or at the counter, then follow their order.

- **Stack:** Next.js 16 (App Router), React 19 and TypeScript 7.
- **Hosting:** exported as a fully static site (`out/`). There's no server, no API routes and no backend. All data is mock data in `src/data/`, and all state lives in the browser.
- **Design source of truth:** `../the-olive-table-ui`. The `screens/*.html` files and `png/*.png` are the reference for every page. The `w*` and `ws*` screens are the desktop layout (1024px and up); `01–21` and `s*` are the mobile layout.

## Status

| Phase | Scope                                                                                              | State                  |
| ----- | -------------------------------------------------------------------------------------------------- | ---------------------- |
| 1     | Tooling, tokens, fonts, Icon, `ui/` kit, `/styleguide`                                             | Done                   |
| 2     | Layout shell, Welcome, Menu, Category, Search, Food detail, Quick-add                              | Done                   |
| 3     | Cart, Checkout (details, OTP, payment, processing, failed, cancelled), order confirmation          | Done                   |
| 4     | Order tracking, order details, My orders, Help, waiter, bill                                       | Placeholder pages only |
| 5     | Restaurant state screens (closed, paused, offline), full responsive and accessibility pass, README | To do                  |

## Routes

Every route is prerendered at build time. Dynamic segments list their pages with `generateStaticParams` and set `dynamicParams = false`.

| Route                                                  | Screen(s)                                                                             | Component                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| `/`                                                    | 01 · w01 Welcome                                                                      | `components/home/Welcome`                    |
| `/menu`                                                | 02 · w02 Menu home                                                                    | `components/menu/MenuHome`                   |
| `/menu/[category]`                                     | 03 · w03 Category (6 pages)                                                           | `components/menu/CategoryView`               |
| `/dish/[slug]`                                         | 06 · w06 Food detail (54 pages); `?edit=<lineKey>` edits a cart line                  | `components/menu/DishDetail`                 |
| `/search`                                              | 04, 05, s04, s05 · w04, w05, ws04, ws05; `?q=`                                        | `components/menu/SearchView`                 |
| `/cart`                                                | 08 · w08, empty s06 · ws06                                                            | `components/cart/CartView`                   |
| `/checkout/details`                                    | 09 · w09                                                                              | `components/checkout/DetailsStep`            |
| `/checkout/verify`                                     | 10, s07 · w10, ws07                                                                   | `components/checkout/VerifyStep`             |
| `/checkout/payment`                                    | 11 · w11                                                                              | `components/checkout/PaymentStep`            |
| `/checkout/processing`                                 | 12, s08, s09 · w12, ws08, ws09; `?state=payment-failed` or `?state=payment-cancelled` | `components/checkout/ProcessingStep`         |
| `/order/[id]/confirmed`                                | 13 · w13                                                                              | `components/order/OrderConfirmed`            |
| `/order/[id]`, `/order/[id]/track`, `/orders`, `/help` | Phase 4                                                                               | `components/layout/ComingSoon` (placeholder) |
| `/styleguide`                                          | Design-system board (ds01 / ds02)                                                     | `app/styleguide/Styleguide`                  |

The quick-add sheet and modal (07 · w07) isn't a route. It's a dialog opened from any menu list through `QuickAddContext`.

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
    order/        Order confirmation (more in Phase 4).
    home/         Welcome screen.
  context/        React Context providers (cart, table, toasts, filters, search, checkout, orders, quick-add).
  hooks/          Reusable client hooks (useCart, useTable, useMediaQuery, useCountdown, useDishConfig…).
  lib/            Pure logic, no React: pricing, formatting, cart-line identity, cart reducer, menu queries,
                  checkout validation, order building, safe storage.
  data/           Mock data: restaurant.ts, menu.ts, orders.ts.
  types/          Domain types: Dish, Variant, AddOn, CartLine, Order, OrderStatus…
  styles/         tokens.css (design tokens) and globals.css (base styles, typography, utilities).
  fonts/          Manrope and Newsreader .woff2 files, loaded with next/font/local.
tests/
  unit/           Vitest + React Testing Library.
  e2e/            Playwright smoke tests (mobile 390px and desktop 1280px).
```

### Rules of thumb

- **Pages are thin.** A file in `app/` exports `metadata`, maybe `generateStaticParams`, and renders a single view component.
- **Logic lives in `lib/` and hooks.** Components receive data and call callbacks. For example, price maths is in `lib/pricing.ts`, the cart line description ("Full · 10 pcs, Medium spicy…") is in `lib/cartLine.ts`, and filtering, sorting and search are in `lib/menu.ts`.
- **Use `'use client'` only where needed.** Components that use state, context or browser APIs are client components. Small presentational pieces (`DishRow`, `DishCard`, `PriceSummary`, `Tag`…) don't declare it themselves.

## How a request becomes a screen

1. `app/layout.tsx` loads the fonts, sets `<html lang="en">`, the theme colour and the skip link, and wraps everything in `AppProviders`.
2. `AppProviders` nests the providers in this order: Toast, Table, Cart, Orders, Checkout, Filters, Search, QuickAdd.
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

- **Tokens:** `src/styles/tokens.css` holds the `:root` variables from `olive-core.css` with their original names (`--brand-600`, `--ink-2`, `--r-lg`, `--sh-1`…). `--f-ui` and `--f-display` chain the next/font variables. Each font family loads two subsets, latin and latin-ext, because the ₹ glyph is in latin-ext.
- **Global styles:** `globals.css` has the reset, the focus ring (`--focus`), the typography utilities (`.t-display`, `.t-h1`, `.t-body`, `.t-caption`…), `.visually-hidden`, `.hide-mobile` / `.hide-desktop`, and the reduced-motion override.
- **Component styles:** one CSS Module per component, next to it. Class names follow the design classes (`.qty`, `.opt`, `.item`, `.ci`…) so the original CSS is easy to compare against.
- **Not allowed:** Tailwind, `!important`, and inline styles. The only inline styles are truly dynamic values: Skeleton's width and height, and the styleguide's colour swatches.
- **Icons:** `<Icon name="…" />`. The 51 mask SVGs and the typed `IconName` union are generated from `olive-core.css`.

## State

All state is client-side. Anything that reads the browser (localStorage, sessionStorage, the URL) loads **after hydration**, so the prerendered HTML and the first client render are identical and there are no hydration warnings.

| State                                                        | Where                                                      | Persistence                                                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Cart (lines and kitchen note)                                | `context/CartContext`, using `useReducer(lib/cartReducer)` | localStorage `olive.cart.v1`. Re-priced against the menu on load and synced across tabs. |
| Table number                                                 | `context/TableContext` (`useSyncExternalStore`)            | Read from `?table=` and stored in localStorage. Defaults to 12.                          |
| Checkout session (name, phone, OTP attempts, payment window) | `context/CheckoutContext`                                  | sessionStorage (this tab only).                                                          |
| Orders placed on this device                                 | `context/OrdersContext`                                    | localStorage `olive.orders.v1`.                                                          |
| Menu filters and sort                                        | `context/FiltersContext`                                   | Memory, for the current visit.                                                           |
| Search query (shared by the header box and the search page)  | `context/SearchContext`                                    | `?q=` in the URL, debounced by 250ms.                                                    |
| Recent searches                                              | `hooks/useRecentSearches`                                  | localStorage.                                                                            |
| Toasts ("Added · Undo")                                      | `context/ToastContext`                                     | Memory. Shown in a polite live region.                                                   |

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
2. **Verify:** the mock OTP is `123456`. A wrong code shows the error with the attempts left (3 in total). Resend unlocks after 30 seconds or after an error.
3. **Payment:** **Pay online** opens a 4:32 mock UPI window on `/checkout/processing`. **Pay at the counter** places the order immediately.
4. **Processing:** the "Prototype: success" and "Prototype: failure" links simulate the result. The request also fails by itself when the timer runs out. **Cancel payment** goes to the cancelled state.
5. **On success:** `usePlaceOrder` creates the order and redirects to `/order/<id>/confirmed`. The confirmation page then empties the cart (`useFinishPlacedOrder`). On failure or cancel, the cart is never touched.

`useCheckoutGuard` redirects a guest who lands mid-flow: an empty cart goes to /cart, a missing number goes to details, and an unverified number goes to verify.

New orders take IDs from a pre-rendered pool (`A105`–`A124` in `data/orders.ts`), because a static export can only serve pages that exist at build time.

## Data

- **`data/restaurant.ts`:** name, opening hours, status (`open` / `closed` / `paused`), the bracketed placeholders (`[RESTAURANT PHONE]`, `[PAYMENT PARTNER]`, `[NETWORK NAME]`, `[RESTAURANT ADDRESS]`), the mock OTP and the timers.
- **`data/menu.ts`:** 6 categories and 54 dishes. Every dish, price and option shown in the designs is reproduced exactly. Dishes marked `// filler` aren't in the designs; they bring each category up to the counts the designs show (8 / 12 / 6 / 9 / 5 / 14). Also defines `chefsPicks` (the order of the picks rail), `popularSearches` and the empty-cart suggestions.
- **`data/orders.ts`:** the mock orders drawn in the designs (A104, A097, A101, A098, A061, A033, A029) and the new-order ID pool.

To add a dish, add an object to the right category array in `menu.ts`. The list order sets its "Recommended" rank. A dish with `variants`, `optionGroups` or `addOns` counts as customisable:

- With an `image`, its ADD button opens the food-detail page.
- Without an image, ADD opens the quick-add sheet or modal.
- A dish with no options is added straight away with an Undo toast.

## Accessibility notes

- **Semantics:** real `<button>` and `<a>` elements throughout; every input has a label; icon buttons need a `label` prop (it's required in the types).
- **Focus and touch:** visible focus rings (`--focus`); touch targets of at least 44px (small controls extend their hit area with `::before`).
- **Option controls:** variant and add-on rows use `role="radio"` / `role="checkbox"` with `aria-checked`, as in the design markup. Radio groups support the arrow keys.
- **Veg / non-veg:** always shown by shape (a dot or a triangle) as well as colour, and announced as "Vegetarian" or "Non-vegetarian".
- **Live regions:** toasts, the OTP resend timer, quantity changes and filter result counts use `aria-live`.
- **Motion:** `prefers-reduced-motion` turns off animations.
- **Contrast:** disabled button text uses `--disabled-ink` (4.8:1) instead of the design's #9A8A80 (2.7:1).

## Testing

| Command            | What it runs                                                                                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`         | Vitest: pricing, formatting, cart reducer, cart-line descriptions, menu queries and search, checkout validation, OtpInput, QuantityStepper.                                                                                                                                  |
| `npm run test:e2e` | Playwright against the built `out/` folder, at 390px and 1280px: happy path (menu → dish → cart → checkout → confirmation), a failed payment keeps the cart, and quick-add. Run `npm run build` first. It uses the installed Google Chrome; set `PW_CHANNEL=chromium` on CI. |

## Where the build differs from the design

1. **Categories:** the mobile tabs in the designs (Breads, Rice) and the web sidebar (Pizza, Breads & Rice) disagree. The web set is used everywhere.
2. **Filler dishes:** dishes added so the counts match the designs are marked `// filler` in `menu.ts`.
3. **Margherita:** the Wood-fired Margherita stays under Mains, as drawn in 03 / w03.
4. **Past orders:** in the mock orders, line prices are chosen so the drawn totals come out exactly (₹318, ₹756…). Every menu price ends in 9, so those totals can't be made from current prices.
5. **Disabled buttons:** the text colour is darker, for contrast.
6. **+91 box:** the country-code box has no dropdown chevron, because +91 is the only option.
7. **OTP screen:** a dashed "Prototype: the code is 123456" line. It follows the style of the design's own "Prototype: success / failure" links.
8. **After adding from food detail:** the guest returns to where they came from, with an Undo toast, instead of jumping to the cart as the static prototype links do.
9. **Mobile sort:** sorting on mobile opens a bottom sheet, so the scrolling chip row doesn't clip the menu. On desktop it's a dropdown.
