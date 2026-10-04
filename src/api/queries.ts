import { queryOptions, skipToken } from '@tanstack/react-query';
import { TRACK_REFRESH_MS } from '@/lib/orders';
import type { Branch } from '@/types/branch';
import type { HelpTopics } from '@/types/help';
import type { MenuData } from '@/types/menu';
import type { OrdersResponse } from '@/types/order';
import type { Restaurant } from '@/types/restaurant';
import { apiGet } from './client';
import { api } from './endpoints';
import type common from '../../public/api/content/common.json';
import type home from '../../public/api/content/home.json';
import type menu from '../../public/api/content/menu.json';
import type cart from '../../public/api/content/cart.json';
import type checkout from '../../public/api/content/checkout.json';
import type orders from '../../public/api/content/orders.json';
import type service from '../../public/api/content/service.json';
import type status from '../../public/api/content/status.json';

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

/** GET /branches: every location with its hours, region rules and live status, which can change at any time. */
export const branchesQuery = () =>
  queryOptions({
    queryKey: ['branches'] as const,
    queryFn: () => apiGet<Branch[]>('branches'),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

/** GET /branches/:id/menu: one branch's categories, dishes (in its currency) and curated lists. */
export const branchMenuQuery = (branchId: string) =>
  queryOptions({
    queryKey: ['branches', branchId, 'menu'] as const,
    queryFn: () => apiGet<MenuData>(`branches/${branchId}/menu`),
    staleTime: Infinity,
  });

/**
 * GET /orders: the drawn order history (each order names its branch) and the id pool for new
 * orders. It's the mock server's seed (api/mock/seed), not read by screens: they read orders
 * through the server-owned endpoints below. Also lists the order pages to prerender.
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

/** GET /orders/:id: one order with its live status; polled every 30 s while `live`. */
export const orderQuery = (id: string) =>
  queryOptions({
    queryKey: ['orders', 'detail', id] as const,
    queryFn: () => api.getOrder(id),
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

/** GET /sessions/:id/service-requests: this guest's pending waiter and bill requests. */
export const serviceRequestsQuery = (sessionId: string | undefined) =>
  queryOptions({
    queryKey: ['service-requests', sessionId] as const,
    queryFn: sessionId ? () => api.serviceRequests(sessionId) : skipToken,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
