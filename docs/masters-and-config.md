# Masters and configuration

Every fixed list the app, the mock server and a future backend check against lives in one place:
the masters in `src/config/masters/`. This page lists each master, its codes, where its words live
in content and which app types and lists derive from it, then covers the per-country presets, the
other app constants and the per-branch reference data.

## Contents

- [How masters work](#how-masters-work)
- [Orders](#orders)
- [Payments](#payments)
- [Tax](#tax)
- [Discounts and offers](#discounts-and-offers)
- [Floor service and reservations](#floor-service-and-reservations)
- [Units](#units)
- [Notifications](#notifications)
- [Regions, locales and currencies](#regions-locales-and-currencies)
- [Region presets](#region-presets)
- [Business names and codes](#business-names-and-codes)
- [Defined but not yet used](#defined-but-not-yet-used)
- [Other app constants](#other-app-constants)
- [Branch reference data](#branch-reference-data)
- [Checklist: adding a value to a master](#checklist-adding-a-value-to-a-master)
- [Checklist: adding a country or currency](#checklist-adding-a-country-or-currency)
- [Related](#related)

## How masters work

- A master is a `const` array (or a `const` object keyed by code) with a type derived from it,
  for example `ORDER_STATUSES` and `OrderStatusCode`. App types alias these types instead of
  repeating the union, so a code is added once.
- Masters hold **codes only**. The words for each code are in `public/api/content/*.json`; each
  master file names the content path in its header comment.
- Import from `@/config/masters` (the barrel
  [`src/config/masters/index.ts`](../src/config/masters/index.ts)), never from the individual
  files.
- `MASTERS` in `index.ts` maps a name to every list. It is the shape a future `GET /masters`
  endpoint would answer; the codes would not change.
- `isMasterValue(name, value)` is a type guard that checks a value against one list. Use it to
  validate what a form or request sent:

```ts
import { isMasterValue } from '@/config/masters';

if (!isMasterValue('locales', draft.locale)) errors.push('locale');
```

The test [`tests/unit/masters.test.ts`](../tests/unit/masters.test.ts) keeps three things in sync:

- every master code has its words in content;
- the app's own lists (`ORDER_MODES`, `CANCEL_REASONS`, `PAYMENT_METHODS`, …) equal the masters;
- the dummy data in `public/api/` (branches, promotions) uses master codes only.

## Orders

Defined in [`src/config/masters/orders.ts`](../src/config/masters/orders.ts).

| Master                 | Codes                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| `ORDER_TYPES`          | `dineIn`, `takeaway`, `delivery`                                 |
| `SERVICE_TYPES`        | Same array as `ORDER_TYPES` (one list for both)                  |
| `ORDER_STATUSES`       | `received`, `preparing`, `ready`, `served`, `pickedUp`, …        |
| `ITEM_STATUSES`        | `queued`, `preparing`, `ready`, `served`                         |
| `CANCELLATION_REASONS` | `outOfStock`, `guestLeft`, `kitchenIssue`, `duplicate`, `other`  |
| `REJECTION_REASONS`    | `outOfStock`, `ingredientUnavailable`, `equipmentIssue`, `other` |
| `REFUND_REASONS`       | `complaint`, `wrongItem`, `overcharged`, `goodwill`, `other`     |

`ORDER_STATUSES` in full: `received`, `preparing`, `ready`, `served`, `pickedUp`,
`outForDelivery`, `delivered`, `cancelled`. `ORDER_FLOWS` gives the steps per order type:

- `dineIn`: `received` → `preparing` → `ready` → `served`
- `takeaway`: `received` → `preparing` → `ready` → `pickedUp`
- `delivery`: `received` → `preparing` → `outForDelivery` → `delivered`
- `cancelled` can happen at any step.

Words:

- Order types: `common › modes`.
- Order statuses: `common › orderStatus`.
- Cancellation reasons: `common › adminOrder.cancel.reasons` (what staff pick) and
  `orders › restaurantCancel` (what the guest is told).
- Rejection reasons: `common › masters.rejectionReasons`.
- Refund reasons: `common › adminPayments.entry.reasons`. That object also has `cancelled` and
  `changed`, which are not in the master (they label refunds the system records itself).

Derived from these masters:

- `OrderMode` in [`src/types/branch.ts`](../src/types/branch.ts) is `OrderType`.
- `ORDER_MODES` and `isOrderMode` in [`src/lib/fulfilment.ts`](../src/lib/fulfilment.ts) are
  `ORDER_TYPES`.
- `OrderStatus`, `ItemStatus` and `RefundReason` in
  [`src/types/order.ts`](../src/types/order.ts) are `OrderStatusCode`, `ItemStatusCode` and
  `RefundReasonCode`.
- `TRACK_STEPS` in [`src/lib/orders.ts`](../src/lib/orders.ts) is `ORDER_FLOWS`.
- `CancelReason` in [`src/types/admin.ts`](../src/types/admin.ts) is `CancellationReason`;
  `CANCEL_REASONS` in [`src/lib/adminOrders.ts`](../src/lib/adminOrders.ts) is
  `CANCELLATION_REASONS`.
- `REFUND_REASONS` in [`src/lib/adminPayments.ts`](../src/lib/adminPayments.ts) is the master
  `REFUND_REASONS`.

## Payments

Defined in [`src/config/masters/payments.ts`](../src/config/masters/payments.ts).

| Master                     | Codes                                                    |
| -------------------------- | -------------------------------------------------------- |
| `PAYMENT_INSTRUMENTS`      | `cash`, `upi`, `card`, `onlineProvider`                  |
| `PAYMENT_SETTLEMENTS`      | `online`, `counter`, `pickup`, `cod`                     |
| `PAYMENT_METHOD_MASTER`    | `online`, `upi`, `card`, `esewa`, `khalti`, `fonepay`, … |
| `PAYMENT_STATUSES`         | `unpaid`, `paid`, `refund-started`, `refunded`           |
| `PAYMENT_REQUEST_STATUSES` | `pending`, `succeeded`, `failed`, `expired`              |
| `PAYMENT_PURPOSES`         | `order`, `bill`, `round`, `change`                       |

`PAYMENT_METHOD_MASTER` is keyed by method code (`online`, `upi`, `card`, `esewa`, `khalti`,
`fonepay`, `counter`, `pickup`, `cod`). Each entry records:

- `instrument`: what the guest pays with (`any` for the in-person methods);
- `settlement`: `online` (paid in the app now) or `counter`, `pickup`, `cod` (paid in person);
- `approval` (online methods only): `app` (approved in an app) or `bank` (a bank page).

`PAYMENT_METHOD_CODES` is the list of its keys. A branch offers a subset of these methods; see
[Region presets](#region-presets).

Words:

- Method names: `common › paymentMethods`.
- Instruments: `common › masters.paymentInstruments`.
- Order payment status: `common › adminDashboard.paymentStatus`.
- Payment request status: `common › masters.paymentRequestStatuses`.

Derived from these masters:

- `PAYMENT_METHODS` in [`src/lib/payments.ts`](../src/lib/payments.ts) is built from
  `PAYMENT_METHOD_CODES` and `PAYMENT_METHOD_MASTER`, adding an icon per method. `ICONS` there is
  typed `Record<PaymentMethodId, IconName>`, so a new method fails to compile until it has an
  icon.
- `PaymentMethodId` in [`src/types/branch.ts`](../src/types/branch.ts) is `PaymentMethodCode`.
- `PaymentMethod` and `PaymentStatus` in [`src/types/order.ts`](../src/types/order.ts) are
  `PaymentSettlement` and `PaymentStatusCode`.
- `PaymentPurpose` and `PaymentStatus` in [`src/api/contracts.ts`](../src/api/contracts.ts) are
  `PaymentPurposeCode` and `PaymentRequestStatus`.
- The mock database ([`src/api/mock/db.ts`](../src/api/mock/db.ts)) validates stored rows with
  sets built from `PAYMENT_SETTLEMENTS`, `PAYMENT_PURPOSES` and `PAYMENT_REQUEST_STATUSES`.

## Tax

Defined in [`src/config/masters/tax.ts`](../src/config/masters/tax.ts).

| Master      | Codes                                      |
| ----------- | ------------------------------------------ |
| `TAX_BASES` | `items`, `itemsPlusService`, `deliveryFee` |
| `TAX_TYPES` | `gst`, `vat`, `serviceCharge`              |

Each entry in `TAX_TYPES` records its `kind` (`tax` or `charge`), the `countries` it applies in
(empty means anywhere), what it may be charged on (`appliesTo`), optional bill `parts` (GST is
shown as `cgst` + `sgst`) and its `rates` over time in basis points (500 = 5%).

| Code            | Kind     | Countries | Rate | From         |
| --------------- | -------- | --------- | ---- | ------------ |
| `gst`           | `tax`    | `IN`      | 500  | `2024-04-01` |
| `vat`           | `tax`    | `NP`      | 1300 | `2024-04-01` |
| `serviceCharge` | `charge` | any       | 1000 | `2024-04-01` |

Helpers: `taxRateOn(type, day)` returns the rate in force on a `YYYY-MM-DD` day (or `null`);
`taxTypesFor(country)` lists the taxes and charges that can apply in a country.

This master is a **catalogue**. A bill never reads it: it uses the tax lines in the branch's own
`tax` configuration (`GET /branches`, edited in Settings › Tax & service charge), which start from
the country's [region preset](#region-presets). The effective dates are placeholders
(`2024-04-01`, when the app's configuration starts), not legal dates.

Words: bill lines in `cart › priceSummary.lines`; type names in `common › masters.taxTypes`; bases
in `common › masters.taxBases`.

## Discounts and offers

Defined in [`src/config/masters/discounts.ts`](../src/config/masters/discounts.ts).

| Master                      | Codes                                      |
| --------------------------- | ------------------------------------------ |
| `DISCOUNT_TYPES`            | `percent`, `flat`, `priceOverride`         |
| `PROMO_CODE_DISCOUNT_TYPES` | `percent`, `flat`                          |
| `AUTO_OFFER_DISCOUNT_TYPES` | Same as `DISCOUNT_TYPES`                   |
| `ELIGIBILITY_RULES`         | `minOrder`, `maxDiscount`, `orderTypes`, … |

`ELIGIBILITY_RULES` in full: `minOrder`, `maxDiscount`, `orderTypes`, `schedule`, `validity`,
`perGuestLimit`, `scope`. `ELIGIBILITY_BY_KIND` says which rules each kind of discount may use:

- `promoCode`: `minOrder`, `maxDiscount`, `orderTypes`, `validity`, `perGuestLimit`;
- `autoOffer`: `schedule`, `scope`.

Words: `common › masters.discountTypes` and `common › masters.eligibility`.

Derived: [`src/types/promotion.ts`](../src/types/promotion.ts) uses `DiscountType`,
`PROMO_CODE_DISCOUNT_TYPES` and `WeekdayCode`. The masters test checks every promo code and offer
in `public/api/branches/<id>/promotions.json` against `discountTypes`, `orderTypes` and
`weekdays`.

## Floor service and reservations

Defined in [`src/config/masters/service.ts`](../src/config/masters/service.ts).

| Master                   | Codes                                         |
| ------------------------ | --------------------------------------------- |
| `SERVICE_REQUEST_KINDS`  | `waiter`, `bill`                              |
| `WAITER_REQUEST_REASONS` | `waiter`, `water`, `cutlery`, `other`         |
| `CUSTOMER_REQUEST_TYPES` | `waiter`, `water`, `cutlery`, `other`, `bill` |
| `BILL_SCOPES`            | `mine`, `table`                               |
| `RESERVATION_STATUSES`   | `booked`, `seated`, `cancelled`, `noShow`     |

`CUSTOMER_REQUEST_TYPES` is every request as staff see it: a waiter call by reason, or the bill.
`MASTERS.customerRequestTypes` holds its ids.

Words:

- Waiter reasons: `service › waiterDialog.reasons` (guest) and `common › adminHome.queue.reasons`
  (staff).
- Customer request types: `common › masters.customerRequestTypes`.
- Reservation statuses: `common › adminReservations.state`. Its keys are display states, not
  codes: `booked` is shown as `upcoming`, `arriving` or `late` depending on the time.

Derived:

- `WaiterReason`, `ServiceRequestKind` and `BillScopeCode` are used in
  [`src/types/service.ts`](../src/types/service.ts).
- `WAITER_REASONS` and `WAITER_REASON_IDS` in [`src/lib/service.ts`](../src/lib/service.ts) are
  built from `WAITER_REQUEST_REASONS` (adding an icon per reason).
- `ReservationStatus` in [`src/types/admin.ts`](../src/types/admin.ts) is
  `ReservationStatusCode`; the mock database validates stored bookings against
  `RESERVATION_STATUSES`.

## Units

Defined in [`src/config/masters/units.ts`](../src/config/masters/units.ts). `UNITS` is keyed by
code, each with a `dimension` (`count`, `volume`, `weight`) and `toBase` (how many of the
dimension's base unit one of it is).

| Dimension | Codes                                       | Base |
| --------- | ------------------------------------------- | ---- |
| `count`   | `piece`, `plate`, `bowl`, `glass`, `bottle` | 1    |
| `volume`  | `ml`, `litre`                               | `ml` |
| `weight`  | `g`, `kg`                                   | `g`  |

`convertUnit(amount, from, to)` converts within a measured dimension and returns `null` across
dimensions or between two different count units. Words: `common › masters.units` (`name` and
`short` per code).

## Notifications

Defined in [`src/config/masters/notifications.ts`](../src/config/masters/notifications.ts).

- `NOTIFICATION_AUDIENCES`: `kitchen`, `floor`, `cashier`, `guest`.
- `NOTIFICATION_PRIORITIES`: `low`, `normal`, `high`.
- `NOTIFICATION_TYPES`, keyed by code, each with a `group` (`order`, `kitchen`, `payment`,
  `service`), its `audiences` and a `priority`. Codes: `newOrder`, `orderDelayed`,
  `orderCancelled`, `itemReady`, `itemRejected`, `paymentReceived`, `paymentFailed`,
  `refundIssued`, `serviceRequest`.
- `notificationsFor(audience)` lists the types one audience receives.

Words: `common › masters.notificationTypes`.

## Regions, locales and currencies

Defined in [`src/config/masters/regions.ts`](../src/config/masters/regions.ts).

| Master            | Codes                                    |
| ----------------- | ---------------------------------------- |
| `COUNTRY_CODES`   | `IN`, `NP`                               |
| `WEEKDAYS`        | `mon` … `sun` (Monday first)             |
| `BRANCH_STATUSES` | `open`, `closed`, `paused`               |
| `LOCALES`         | `en-IN`, `en-NP`, `en-GB`, `en-US`       |
| `CURRENCIES`      | `INR`, `NPR`, `USD`, `EUR`, `GBP`, `AED` |

- `LOCALES` entries may name a `fallback`: `en-NP` falls back to `en-IN` where the runtime has no
  number data for it. `withRegion` copies it to the branch as `localeFallback`.
- `CURRENCIES` entries give the `symbol` shown (instead of Intl's), `minorUnit` per major unit and
  `nameKey` for the spoken name in `common › currencyNames`.
- `COUNTRY_DEFAULTS` gives each country's usual `timezone`, `locale` and `currency`
  (`IN`: `Asia/Kolkata`, `en-IN`, `INR`; `NP`: `Asia/Kathmandu`, `en-NP`, `NPR`). Settings ›
  Branch details and the Add branch dialog apply them when staff pick a country.
- `isTimeZone(value)` checks an IANA zone against the runtime.
- `timeZonesWith(first)` lists every zone the runtime knows, with `first` at the top (the time
  zone picker).

Words: countries in `common › countryNames`; days in `common › adminSettings.hours.days`; locales
in `common › masters.locales`; currencies in `common › masters.currencies`.

Derived: `CountryCode`, `BranchStatus`, `Weekday` and `WEEKDAYS` in
[`src/types/branch.ts`](../src/types/branch.ts). `detailsErrors` in
[`src/lib/branchSettings.ts`](../src/lib/branchSettings.ts) validates locale and currency with
`isMasterValue` and the time zone with `isTimeZone`. The mock database validates stored branch
statuses against `BRANCH_STATUSES`.

## Region presets

[`src/config/regions.ts`](../src/config/regions.ts) defines `REGION_PRESETS`, typed
`Record<CountryCodeMaster, RegionPreset>`: what each country brings to a branch there.

- `mobile`: dial code, number length, validation `pattern`, digit grouping and separator, and
  whether the dial code is shown (`IN`: `+91`, 10 digits starting 6–9; `NP`: `+977`, 10 digits
  starting 97 or 98).
- `tax`: the branch's `TaxConfig` as a bill works it out: tax `lines` (with `splitInto` parts),
  an optional `serviceCharge`, `pricesIncludeTax`, `discountBeforeTax`, `rounding`, and the
  content keys `compactLabelKey` (`cart › priceSummary.compact`) and `invoiceKey`
  (`service › region.taxInvoice`).
- `payments`: the methods offered on each screen, in order, each a `PaymentOption` with a content
  `labelKey` and an optional `recommended` flag: `checkout`, `bill`, `takeaway`, `delivery`, plus
  `atTable` (how the printed bill can be paid).

India offers `online` and `counter` at checkout and `upi`, `card` for the bill; Nepal offers
`esewa`, `khalti`, `fonepay`, `card` and `counter`.

The presets are used in two places in [`src/lib/branchSettings.ts`](../src/lib/branchSettings.ts):

- `withRegion(branch, { country, timezone, locale, currency })` applies the locale fallback and
  currency from the masters. When the country changes, it also replaces the branch's `mobile`,
  `tax`, `payments` and the takeaway and delivery payment lists with a copy of the new country's
  preset. Menu prices keep their numbers.
- `paymentChoicesFor(country)` returns the methods a branch may offer on each screen (the preset's
  lists without `recommended`). The settings handler sends these as `choices` with
  `GET /admin/branches/:branchId/settings`, and `paymentErrors` refuses any method not in them.

`dialCodeOf(country)` reads the preset's dial code; `detailsErrors` uses it to require the branch
phone to start with the country's code.

## Business names and codes

Business documents and staff use names that differ from the codes. Use the code in code, data and
API calls.

| Area                   | Business name          | Code             |
| ---------------------- | ---------------------- | ---------------- |
| Order status           | Pending                | `received`       |
| Cancellation reason    | Customer request       | `guestLeft`      |
| Cancellation reason    | Item unavailable       | `outOfStock`     |
| Reservation status     | Confirmed              | `booked`         |
| Payment request status | Processing             | `pending`        |
| Payment request status | Paid                   | `succeeded`      |
| Order payment status   | Pending                | `unpaid`         |
| Order payment status   | Refund being processed | `refund-started` |

## Defined but not yet used

These masters exist for upcoming features. They have words in content and are covered by the
masters test, but no screen or handler reads them yet:

- `REJECTION_REASONS` (kitchen rejecting a dish);
- `UNITS` and `convertUnit` (stock and portion units);
- `NOTIFICATION_TYPES` and `notificationsFor` (a notification service);
- `PAYMENT_INSTRUMENTS`, `ELIGIBILITY_RULES`, `ELIGIBILITY_BY_KIND` and
  `CUSTOMER_REQUEST_TYPES` (listed in `MASTERS` only);
- `TAX_TYPES`, `taxRateOn` and `taxTypesFor`: a catalogue only. Bills use each branch's own tax
  settings, and the effective dates are placeholders (`2024-04-01`).

## Other app constants

[`src/lib/constants.ts`](../src/lib/constants.ts) holds UI limits:

| Constant             | Value | Meaning                                  |
| -------------------- | ----- | ---------------------------------------- |
| `MAX_QUANTITY`       | 20    | Highest quantity on one cart line        |
| `SEARCH_DEBOUNCE_MS` | 250   | Debounce for search-as-you-type          |
| `TOAST_MS`           | 2500  | How long a toast stays up                |
| `ACTION_TOAST_MS`    | 3000  | A toast with an action (Undo)            |
| `ERROR_TOAST_MS`     | 4000  | An error toast                           |
| `TOAST_EXIT_MS`      | 180   | Fade-out of a dismissed toast            |
| `ITEM_NOTE_MAX`      | 140   | Longest note on one dish                 |
| `KITCHEN_NOTE_MAX`   | 120   | Longest kitchen note for the whole order |

[`src/api/mock/rules.ts`](../src/api/mock/rules.ts) holds business rules the backend owns. The
mock server applies them; the app only sees their effects in responses (`expiresAt`, `resendAt`),
so changing them never touches a component.

| Constant                 | Value       | Meaning                                      |
| ------------------------ | ----------- | -------------------------------------------- |
| `TABLE_SESSION_HOURS`    | 6           | Guest session lifetime                       |
| `ADMIN_SESSION_HOURS`    | 12          | Staff sign-in lifetime                       |
| `MOCK_OTP`               | `123456`    | OTP accepted at checkout                     |
| `OTP_ATTEMPTS`           | 3           | Wrong codes before a new code is needed      |
| `OTP_RESEND_SECONDS`     | 30          | Wait before another code can be requested    |
| `PAYMENT_WINDOW_SECONDS` | 272         | How long a payment request stays open        |
| `MOCK_TRANSACTION_REF`   | `•••• 4821` | Reference the mock payment partner returns   |
| `SERVICE_REQUEST_TTL_MS` | 30 min      | When a pending waiter or bill request lapses |

Feature modules keep their own limits next to their logic, for example `LIMITS` and
`SLOT_MINUTES` in [`src/lib/branchSettings.ts`](../src/lib/branchSettings.ts) and the booking
limits in [`src/lib/reservations.ts`](../src/lib/reservations.ts).

Environment variables are read in [`src/api/config.ts`](../src/api/config.ts):
`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_API_SUFFIX`, `NEXT_PUBLIC_API_MOCK` and
`NEXT_PUBLIC_API_MOCK_LATENCY_MS`. `NEXT_PUBLIC_ADMIN_DEMO=false` turns off the sample floor
activity shown under `npm run dev` ([`src/api/mock/demoFloor.ts`](../src/api/mock/demoFloor.ts)).

## Branch reference data

Branches are dummy reference data a backend would keep in its database. Each branch is an entry
in [`public/api/branches.json`](../public/api/branches.json) (typed `Branch` in
[`src/types/branch.ts`](../src/types/branch.ts)) plus a folder `public/api/branches/<id>/`.

Per branch, `branches.json` holds:

- identity and contact: `id`, `name`, `shortName`, `city`, `address`, `image`, `mapUrl`, `phone`,
  `phoneHref`, `wifiName`, `paymentPartner`;
- region: `country`, `locale`, `localeFallback`, `currency`, `timezone`, `mobile`;
- hours: `schedule` (the week), plus today's derived fields (`opensAt`, `closesAt`, `hours`,
  `hoursToday`, `lastOrders`, `serviceWindows`, …) and `status`;
- tables: `defaultTable` and `tables` (`first`, `last`, optional `outOfService`);
- money: `tax` and `payments` (initially the country's region preset);
- ordering: `modes` (dine-in, takeaway and delivery with their rules and payment lists),
  `ordering` (dine-in payment timing, cancel window), `dietary` marks and `prepTime`.

The branch folder holds `menu.json` (categories, dishes and curated lists), `promotions.json`
(`codes` and `offers`) and `floors.json` (areas and tables). The default branch is
`defaultBranchId` in [`public/api/restaurant.json`](../public/api/restaurant.json). The drawn
order history in [`public/api/orders.json`](../public/api/orders.json) tags each order with a
`branchId`.

What staff change in Settings is stored by the mock server (`branchSetup` in
[`src/api/mock/db.ts`](../src/api/mock/db.ts)) and applied on top of the JSON; the files
themselves are never written.

## Checklist: adding a value to a master

1. Add the code to the master in `src/config/masters/<area>.ts`. Keep the order meaningful: many
   lists are shown to staff in master order.
2. Add the words at the content path named in the master's header comment (for example
   `common › masters.rejectionReasons.<code>`).
3. Run `npm run typecheck`. Records keyed by the master type (`ICONS` in `lib/payments.ts`,
   `WAITER_REASON_ICONS` in `lib/service.ts`, `REGION_PRESETS`, `COUNTRY_DEFAULTS`) fail until the
   new code has an entry. Fill each one.
4. Update any `switch` or lookup on the code in components and in the mock handlers under
   `src/api/mock/handlers/`.
5. If the value is offered by a branch (a payment method), add it to the relevant region preset or
   the branch's data in `public/api/branches.json`.
6. Document it in the endpoint's JSDoc in [`src/api/contracts.ts`](../src/api/contracts.ts) if the
   API accepts or returns it.
7. Run `npx vitest run tests/unit/masters.test.ts`, then `npm test`.

## Checklist: adding a country or currency

A new currency only (a branch can price in it without a new country):

1. Add the code to `CURRENCIES` with its `symbol`, `minorUnit` and `nameKey`.
2. Add `common › masters.currencies.<CODE>` (picker label) and `common › currencyNames.<nameKey>`
   (spoken name).

A new country:

1. Add the ISO code to `COUNTRY_CODES` in
   [`src/config/masters/regions.ts`](../src/config/masters/regions.ts).
2. Add its `COUNTRY_DEFAULTS` entry (time zone, locale, currency). Add the locale to `LOCALES`
   (with a `fallback` if runtimes lack number data for it) and the currency to `CURRENCIES` if
   they are new, with their words in `common › masters`.
3. Add its `REGION_PRESETS` entry in [`src/config/regions.ts`](../src/config/regions.ts): mobile
   rules, tax configuration and payment methods per screen.
4. Make sure every tax line id in the preset is a `TAX_TYPES` code whose `countries` include the
   new country (the masters test checks this against branch data).
5. Add the words keyed by country or by preset label key:
   - `common › countryNames.<CODE>`;
   - `checkout › details.errors.phonePrefix.<CODE>`;
   - tax line labels in `cart › priceSummary.lines`, the compact label in
     `cart › priceSummary.compact` and the invoice name in `service › region.taxInvoice`;
   - payment labels in `checkout › payment.methods`, `service › payBill.methods` and
     `service › region.atTable` for any new `labelKey`.
6. Run `npm run typecheck` and `npm test`. To exercise the country end to end, add a branch there
   ([how-to](how-to.md#add-a-branchs-reference-data)).

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
