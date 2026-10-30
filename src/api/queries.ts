import { queryOptions, skipToken } from '@tanstack/react-query';
import { TRACK_REFRESH_MS } from '@/lib/orders';
import type { FloorPlanLayout } from '@/types/admin';
import type { BranchConfig, BranchLiveStatus, BranchSummary } from '@/types/branch';
import type { HelpTopics } from '@/types/help';
import type { MenuData } from '@/types/menu';
import type { OrdersResponse } from '@/types/order';
import type { BranchPromotions } from '@/types/promotion';
import type { Restaurant } from '@/types/restaurant';
import { apiGet } from './client';
import type {
  AdminBranchesResponse,
  AdminOrdersFilter,
  OrderLineRequest,
  ReservationsFilter,
} from './contracts';
import { api } from './endpoints';
import { liveRefresh } from './liveState';
import type common from '../../public/api/content/common.json';
import type home from '../../public/api/content/home.json';
import type menu from '../../public/api/content/menu.json';
import type cart from '../../public/api/content/cart.json';
import type checkout from '../../public/api/content/checkout.json';
import type orders from '../../public/api/content/orders.json';
import type service from '../../public/api/content/service.json';
import type status from '../../public/api/content/status.json';
import type kitchen from '../../public/api/content/kitchen.json';

/* ---------- Screen copy: GET /content/<namespace> ---------- */

/** Every piece of on-screen text, grouped by area. Each is one endpoint (public/api/content). */
export const CONTENT_NAMESPACES = [
  'common',
  'home',
  'menu',
  'cart',
  'checkout',
  'orders',
  'service',
  'status',
  'kitchen',
] as const;
export type ContentNamespace = (typeof CONTENT_NAMESPACES)[number];

/** The shape of each namespace, taken from its JSON so keys are checked at compile time. */
export interface ContentMap {
  common: typeof common;
  home: typeof home;
  menu: typeof menu;
  cart: typeof cart;
  checkout: typeof checkout;
  orders: typeof orders;
  service: typeof service;
  status: typeof status;
  kitchen: typeof kitchen;
}

export const contentQuery = <N extends ContentNamespace>(ns: N) =>
  queryOptions({
    queryKey: ['content', ns] as const,
    queryFn: () => apiGet<ContentMap[N]>(`content/${ns}`),
    // Copy changes only with a deploy.
    staleTime: Infinity,
  });

/* ---------- Domain data ---------- */

/** GET /restaurant: the brand (name, tagline, social links, default branch). */
export const restaurantQuery = () =>
  queryOptions({
    queryKey: ['restaurant'] as const,
    queryFn: () => apiGet<Restaurant>('restaurant'),
    staleTime: Infinity,
  });

/**
 * GET /branches: every location in brief (where, its week and status, its modes). Read once per
 * visit (again after 10 minutes, or when the guest comes back to the tab); the status, which
 * staff change during service, is polled on its own (branchStatusQuery).
 */
export const branchesQuery = () =>
  queryOptions({
    queryKey: ['branches'] as const,
    queryFn: () => apiGet<BranchSummary[]>('branches'),
    staleTime: BRANCHES_REFRESH_MS,
    refetchOnWindowFocus: true,
  });

/**
 * GET /branches/:id/config: one branch's rules for ordering there (money, taxes, payments, each
 * mode's rules), read for the guest's own branch only, and trusted as long as the list.
 */
export const branchConfigQuery = (branchId: string) =>
  queryOptions({
    queryKey: ['branches', branchId, 'config'] as const,
    queryFn: () => apiGet<BranchConfig>(`branches/${branchId}/config`),
    staleTime: BRANCHES_REFRESH_MS,
    refetchOnWindowFocus: true,
  });

/** How long the branches' details are trusted before they're read again. */
export const BRANCHES_REFRESH_MS = 10 * 60_000;

/**
 * GET /branches/:id/status: just whether the branch is open, paused or closed, and until when.
 * Pages where guests order poll it (BranchStatusWatch), so a pause reaches them within a minute.
 */
export const branchStatusQuery = (branchId: string) =>
  queryOptions({
    queryKey: ['branches', branchId, 'status'] as const,
    queryFn: () => apiGet<BranchLiveStatus>(`branches/${branchId}/status`),
    staleTime: BRANCH_STATUS_REFRESH_MS,
  });

/**
 * How often pages where guests order check the branch's status, for what staff change without
 * notice (a pause, a close). Scheduled changes (last orders, the next session) are checked at
 * their time (useBranchStatusPolling).
 */
export const BRANCH_STATUS_REFRESH_MS = 3 * 60_000;

/** GET /branches/:id/menu: one branch's categories, dishes (in its currency) and curated lists. */
export const branchMenuQuery = (branchId: string) =>
  queryOptions({
    queryKey: ['branches', branchId, 'menu'] as const,
    queryFn: () => apiGet<MenuData>(`branches/${branchId}/menu`),
    // Staff mark dishes sold out and back during service: read again after a minute.
    staleTime: MENU_REFRESH_MS,
    refetchOnWindowFocus: true,
  });

/** How long a menu read is trusted before it's read again (sold out, back on, new dishes). */
export const MENU_REFRESH_MS = 60_000;

/**
 * GET /branches/:id/promotions: one branch's promo codes and automatic offers (happy hour).
 * They can change during the day, so they're re-read after a minute like the branches.
 */
export const branchPromotionsQuery = (branchId: string) =>
  queryOptions({
    queryKey: ['branches', branchId, 'promotions'] as const,
    queryFn: () => apiGet<BranchPromotions>(`branches/${branchId}/promotions`),
    staleTime: 60_000,
  });

/**
 * GET /branches/:id/floors: the branch's areas and tables. The mock server's seed for the
 * floor plan (api/mock/seed); staff screens read GET /admin/branches/:branchId/tables.
 */
export const branchFloorsQuery = (branchId: string) =>
  queryOptions({
    queryKey: ['branches', branchId, 'floors'] as const,
    queryFn: () => apiGet<FloorPlanLayout>(`branches/${branchId}/floors`),
    staleTime: 60_000,
  });

/**
 * GET /orders: the drawn order history (each order names its branch) and the delivery riders.
 * It's the mock server's seed (api/mock/seed), not read by screens: they read orders through
 * the server-owned endpoints below.
 */
export const orderHistoryQuery = () =>
  queryOptions({
    queryKey: ['orders', 'history'] as const,
    queryFn: () => apiGet<OrdersResponse>('orders'),
    staleTime: Infinity,
  });

/** GET /help: the Help page topics that open in a dialog. */
export const helpQuery = () =>
  queryOptions({
    queryKey: ['help'] as const,
    queryFn: () => apiGet<HelpTopics>('help'),
    staleTime: Infinity,
  });

/* ---------- Server-owned reads (api/contracts) ---------- */

/*
 * These change on the server (orders move along, other tabs pay or ask for the bill), so they
 * are never stale for long: refetched on mount and when the guest comes back to the tab.
 * Keys start with 'orders' / 'service-requests' so a write can invalidate them together.
 */

/** GET /orders/:id: one order with its live status; polled every 30 s while `live`; idle without an id. */
export const orderQuery = (id: string | undefined) =>
  queryOptions({
    queryKey: ['orders', 'detail', id] as const,
    queryFn: id ? () => api.getOrder(id) : skipToken,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data?.live ? TRACK_REFRESH_MS : false),
  });

/** GET /sessions/:id/orders: the guest's orders (My orders); polled while any is live. */
export const sessionOrdersQuery = (sessionId: string | undefined) =>
  queryOptions({
    queryKey: ['orders', 'session', sessionId] as const,
    queryFn: sessionId ? () => api.sessionOrders(sessionId) : skipToken,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (query) =>
      query.state.data?.orders.some((o) => o.live) ? TRACK_REFRESH_MS : false,
  });

/** GET /tables/:branchId/:table/orders: this visit's orders at the table (the bill). */
export const tableOrdersQuery = (branchId: string, table: number, enabled: boolean) =>
  queryOptions({
    queryKey: ['orders', 'table', branchId, table] as const,
    queryFn: enabled ? () => api.tableOrders(branchId, table) : skipToken,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

/**
 * POST /delivery/quote: the fee, minimum order and ETA of delivering an item total to an area.
 * A calculation the server owns, read like a query: idle until there's an area, and the last
 * quote for the same area is shown while the total changes.
 */
export const deliveryQuoteQuery = (branchId: string, area: string | undefined, itemTotal: number) =>
  queryOptions({
    queryKey: ['delivery-quote', branchId, area, itemTotal] as const,
    queryFn: area ? () => api.quoteDelivery({ branchId, area, itemTotal }) : skipToken,
    staleTime: 60_000,
    placeholderData: (previous) => (previous?.area === area ? previous : undefined),
  });

/**
 * POST /promos/validate: what a promo code takes off the cart's lines. A calculation the server
 * owns, read like a query: idle without a code, re-read when the lines change (the last answer
 * for the same code is shown meanwhile), and a "no" (an error code) isn't retried.
 */
export const promoQuoteQuery = (
  sessionId: string | undefined,
  code: string | undefined,
  lines: readonly OrderLineRequest[],
) =>
  queryOptions({
    queryKey: ['promo-quote', sessionId, code, lines] as const,
    queryFn:
      sessionId && code
        ? () => api.validatePromo({ sessionId, code, lines: [...lines] })
        : skipToken,
    staleTime: 60_000,
    placeholderData: (previous) => (previous?.code === code ? previous : undefined),
  });

const adminBranchList = (data: AdminBranchesResponse) => data.branches;

/**
 * GET /admin/branches: the branches the signed-in admin manages, keyed by their session token
 * (another sign-in reads them afresh); idle while signed out.
 */
export const adminBranchesQuery = (token: string | null) =>
  queryOptions({
    queryKey: ['admin', 'branches', token] as const,
    queryFn: token ? () => api.adminBranches(token) : skipToken,
    staleTime: 60_000,
    select: adminBranchList,
  });

/** GET /sessions/:id/service-requests: this guest's pending waiter and bill requests. */
export const serviceRequestsQuery = (sessionId: string | undefined) =>
  queryOptions({
    queryKey: ['service-requests', sessionId] as const,
    queryFn: sessionId ? () => api.serviceRequests(sessionId) : skipToken,
    staleTime: 0,
    refetchOnWindowFocus: true,
    // So the guest sees staff on the way, and the request clear once it's dealt with.
    refetchInterval: SERVICE_REQUESTS_REFRESH_MS,
  });

/** A guest's open requests are read again this often (staff on the way, dealt with). */
export const SERVICE_REQUESTS_REFRESH_MS = 15_000;

/** The waiter home polls the floor this often (and on returning to the tab). */
export const BRANCH_SERVICE_REFRESH_MS = 15_000;

/**
 * GET /admin/branches/:branchId/service: what the branch's floor staff need to act on now.
 * Polled every 15 s; idle while signed out or without a branch.
 */
export const branchServiceQuery = (token: string | null, branchId: string | undefined) =>
  queryOptions({
    queryKey: ['admin', 'service', branchId, token] as const,
    queryFn: token && branchId ? () => api.branchService(token, branchId) : skipToken,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: liveRefresh(BRANCH_SERVICE_REFRESH_MS),
  });

/*
 * The floor plan and one table. Their keys start like the service's, so Done and Mark served
 * (which refresh ['admin', 'service']) refresh them too. Polled like the service.
 */

/** GET /admin/branches/:branchId/tables; idle while signed out or without a branch. */
export const floorPlanQuery = (token: string | null, branchId: string | undefined) =>
  queryOptions({
    queryKey: ['admin', 'service', 'tables', branchId, token] as const,
    queryFn: token && branchId ? () => api.floorPlan(token, branchId) : skipToken,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: liveRefresh(BRANCH_SERVICE_REFRESH_MS),
  });

/** GET /admin/branches/:branchId/tables/:table; idle while signed out or without a branch. */
export const tableDetailQuery = (
  token: string | null,
  branchId: string | undefined,
  table: number,
) =>
  queryOptions({
    queryKey: ['admin', 'service', 'table', branchId, table, token] as const,
    queryFn: token && branchId ? () => api.tableDetail(token, branchId, table) : skipToken,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: liveRefresh(BRANCH_SERVICE_REFRESH_MS),
  });

/**
 * GET /admin/branches/:branchId/orders: today's orders, or the filter's days and table; idle
 * while signed out or without a branch. Polled while `live` (the days reach today); past days
 * don't change on their own, so they're read once and kept.
 */
export const branchOrdersQuery = (
  token: string | null,
  branchId: string | undefined,
  filter: AdminOrdersFilter = {},
  live = true,
) =>
  queryOptions({
    queryKey: ['admin', 'service', 'orders', branchId, token, filter] as const,
    queryFn: token && branchId ? () => api.branchOrders(token, branchId, filter) : skipToken,
    staleTime: live ? 0 : PAST_ORDERS_STALE_MS,
    refetchOnWindowFocus: live,
    refetchInterval: live ? liveRefresh(BRANCH_SERVICE_REFRESH_MS) : false,
  });

/** How long past days' orders are trusted (a refund there is refetched by the mutation). */
const PAST_ORDERS_STALE_MS = 5 * 60_000;

/**
 * GET /admin/branches/:branchId/reservations: bookings from today on. Keyed like the floor, so
 * a booking seated or changed refreshes the floor plan and the other way round. Polled like it.
 */
export const reservationsQuery = (token: string | null, branchId: string | undefined) =>
  queryOptions({
    queryKey: ['admin', 'service', 'reservations', branchId, token] as const,
    queryFn: token && branchId ? () => api.reservations(token, branchId) : skipToken,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: liveRefresh(BRANCH_SERVICE_REFRESH_MS),
  });

/**
 * GET /admin/branches/:branchId/reservations?from=&to=: the bookings on past days (Reservations ›
 * History). Under the same key as the live list, so a booking changed refreshes it too; not
 * polled (past days don't change on their own).
 */
export const reservationHistoryQuery = (
  token: string | null,
  branchId: string | undefined,
  filter: ReservationsFilter,
) =>
  queryOptions({
    queryKey: ['admin', 'service', 'reservations', branchId, token, filter] as const,
    queryFn: token && branchId ? () => api.reservations(token, branchId, filter) : skipToken,
    staleTime: PAST_ORDERS_STALE_MS,
  });

/** GET /admin/branches/:branchId/offers: every automatic offer, to manage (Settings › Offers). */
export const adminOffersQuery = (token: string | null, branchId: string | undefined) =>
  queryOptions({
    queryKey: ['admin', 'offers', branchId, token] as const,
    queryFn: token && branchId ? () => api.offers(token, branchId) : skipToken,
  });

/** GET /admin/branches/:branchId/floors: the floor plan to edit; it changes rarely. */
export const floorLayoutQuery = (token: string | null, branchId: string | undefined) =>
  queryOptions({
    queryKey: ['admin', 'floor-layout', branchId, token] as const,
    queryFn: token && branchId ? () => api.floorLayout(token, branchId) : skipToken,
    staleTime: 60_000,
  });

/** GET /admin/branches/:branchId/settings: what the Settings pages edit; it changes rarely. */
export const branchSettingsQuery = (token: string | null, branchId: string | undefined) =>
  queryOptions({
    queryKey: ['admin', 'settings', branchId, token] as const,
    queryFn: token && branchId ? () => api.branchSettings(token, branchId) : skipToken,
    staleTime: 60_000,
  });

/** GET /admin/branches/:branchId/tables/qr-codes: the links to print; they change rarely. */
export const tableQrCodesQuery = (token: string | null, branchId: string | undefined) =>
  queryOptions({
    queryKey: ['admin', 'qr-codes', branchId, token] as const,
    queryFn: token && branchId ? () => api.tableQrCodes(token, branchId) : skipToken,
    staleTime: 10 * 60_000,
  });
