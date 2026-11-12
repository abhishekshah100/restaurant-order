import type { InvalidateQueryFilters, QueryClient } from '@tanstack/react-query';

/*
 * After X, refresh Y: the one list of what each kind of change makes out of date. Every write
 * (api/mutations) and every branch event (api/liveEvents) names its change here instead of
 * picking caches itself, so a new screen that shows money, stock or the floor is refreshed
 * everywhere by adding it once below. Only reads on screen are fetched again at once; the rest
 * are marked stale and fetched when next shown, so a long list costs nothing.
 */

/** A saved read, as the query-key prefix it lives under (a branch's own, when it has one). */
type Read = (branchId?: string) => InvalidateQueryFilters;

const under =
  (...prefix: string[]): Read =>
  () => ({ queryKey: prefix });
/** A branch's read ("…, branchId, …"), or every branch's when none is given. */
const ofBranch =
  (before: string[], after: string[] = []): Read =>
  (branchId) => ({
    queryKey: branchId ? [...before, branchId, ...after] : before,
    ...(branchId || after.length === 0
      ? {}
      : {
          predicate: ({ queryKey }) =>
            before.every((part, i) => queryKey[i] === part) &&
            after.every((part, i) => queryKey[before.length + 1 + i] === part),
        }),
  });
const whereKey =
  (match: (key: readonly unknown[]) => boolean): Read =>
  () => ({ predicate: ({ queryKey }) => match(queryKey) });

/** Every saved read, by what it shows. */
export const READS = {
  /** Staff: the floor, tables, today's orders and payments, order history, bookings. */
  floor: under('admin', 'service'),
  /** Guests: their orders and the order tracking. */
  guestOrders: under('orders'),
  /** Guests: their waiter and bill requests. */
  guestRequests: under('service-requests'),
  promoQuote: under('promo-quote'),
  requestHistory: under('admin', 'request-history'),
  paymentHistory: under('admin', 'payment-history'),
  cashRegister: under('admin', 'cash-register'),
  cashSession: under('admin', 'cash-session'),
  shifts: under('admin', 'shift'),
  rota: under('admin', 'rota'),
  stock: ofBranch(['admin', 'inventory']),
  purchasing: ofBranch(['admin', 'purchasing']),
  features: ofBranch(['admin', 'features']),
  offers: ofBranch(['admin', 'offers']),
  staff: under('admin', 'staff'),
  roles: under('admin', 'roles'),
  adminBranches: under('admin', 'branches'),
  /** Everything staff read. */
  allAdmin: under('admin'),
  menu: ofBranch(['branches'], ['menu']),
  searchSuggestions: ofBranch(['branches'], ['search-suggestions']),
  cartSuggestions: ofBranch(['branches'], ['cart-suggestions']),
  promotions: ofBranch(['branches'], ['promotions']),
  /** The branches guests pick from (only the list itself). */
  branchList: () => ({ queryKey: ['branches'], exact: true }),
  /** Each branch's open / paused / closed. */
  branchStatus: whereKey((key) => key[0] === 'branches' && key[2] === 'status'),
  /** Each branch's rules (taxes, payments, delivery). */
  branchConfigs: whereKey((key) => key[0] === 'branches' && key[2] === 'config'),
} satisfies Record<string, Read>;

export type ReadName = keyof typeof READS;

/** After this change → read these again. */
export const AFTER = {
  /* Guests */
  /** An order placed, a round added, changed or taken back. */
  guestOrder: ['guestOrders'],
  /** The cart's promo code refused: price it again. */
  promoRefused: ['promoQuote'],
  /** A guest paid online. */
  guestPaid: ['guestOrders', 'guestRequests'],

  /* Service */
  /** A waiter or bill request answered or dealt with. */
  requestHandled: ['floor', 'guestRequests', 'requestHistory'],
  /** Food served at the table. */
  served: ['floor', 'guestOrders'],
  /** The kitchen started or finished a round (stock is used at cooking; dishes can sell out). */
  kitchenStep: ['floor', 'guestOrders', 'stock', 'menu'],
  kitchenMessage: ['floor'],
  /** An order taken, a round added, edited or cancelled, rush, cancelled by staff. */
  orderChanged: ['floor', 'guestOrders', 'stock', 'cashRegister'],
  /** The kitchen ran out of something (the bill comes down; the dish may be off the menu). */
  itemUnavailable: ['floor', 'guestOrders', 'stock', 'menu', 'cashRegister'],
  /** Money taken for an order or a table (a bill request is closed with it). */
  paymentTaken: [
    'floor',
    'guestOrders',
    'guestRequests',
    'paymentHistory',
    'cashRegister',
    'cashSession',
  ],
  /** Money given back. */
  refundGiven: ['floor', 'guestOrders', 'paymentHistory', 'cashRegister', 'cashSession'],
  /** An online refund reached the guest. */
  refundReceived: ['floor', 'guestOrders', 'paymentHistory'],
  /** A booking's deposit taken. */
  depositTaken: ['floor', 'paymentHistory', 'cashRegister', 'cashSession'],
  /** A booking made, changed, seated, cancelled or reminded; the booking rules. */
  bookingChanged: ['floor', 'paymentHistory', 'cashRegister'],
  /** A table freed, given to a waiter, or noted. */
  tableChanged: ['floor', 'guestOrders'],
  /** Floors and tables redrawn: every staff page, and the tables guests can scan. */
  floorPlanChanged: ['allAdmin', 'branchList'],

  /* Team */
  shiftChanged: ['shifts', 'rota', 'floor'],
  rotaChanged: ['rota'],
  staffChanged: ['staff', 'roles'],
  rolesChanged: ['roles'],

  /* Menu */
  menuChanged: ['menu'],
  searchSuggestionsChanged: ['searchSuggestions', 'menu'],
  cartSuggestionsChanged: ['cartSuggestions', 'menu'],
  offersChanged: ['offers', 'promotions'],

  /* Money */
  /** The drawer opened, closed, counted, checked, cash in or out, the day signed off. */
  cashChanged: ['cashRegister', 'cashSession'],

  /* Stock */
  /** Stock moved (counts, wastage, transfers…): dishes can sell out or come back. */
  stockChanged: ['stock', 'menu'],
  recipeChanged: ['stock', 'menu'],
  purchasingChanged: ['purchasing', 'stock', 'menu'],

  /* Branch */
  featuresChanged: ['features', 'adminBranches', 'stock', 'menu'],
  branchStatusChanged: ['adminBranches', 'branchList', 'branchStatus'],
  /** Settings saved, a branch added or removed. */
  branchSetupChanged: ['allAdmin', 'branchList', 'branchConfigs'],

  /* Live events from other devices (api/liveEvents) */
  /** Orders or payments changed on another device. */
  ordersEvent: ['floor', 'paymentHistory', 'cashRegister', 'cashSession'],
  /** Requests changed on another device. */
  serviceEvent: ['floor', 'requestHistory'],
  menuEvent: ['menu', 'stock'],
  stockEvent: ['stock'],
  /** The stream came back after a gap: anything may have changed. */
  resyncEvent: [
    'floor',
    'requestHistory',
    'paymentHistory',
    'cashRegister',
    'cashSession',
    'menu',
    'stock',
  ],
} as const satisfies Record<string, readonly ReadName[]>;

export type Change = keyof typeof AFTER;

/** Reads again everything `change` makes out of date (`branchId`: that branch's; else all). */
export const refreshAfter = (client: QueryClient, change: Change, branchId?: string) =>
  Promise.all(AFTER[change].map((read) => client.invalidateQueries(READS[read](branchId))));

/** The branch a write was for, when its variables name one. */
export const branchOf = (variables: unknown): string | undefined =>
  typeof variables === 'object' &&
  variables !== null &&
  'branchId' in variables &&
  typeof variables.branchId === 'string'
    ? variables.branchId
    : undefined;
