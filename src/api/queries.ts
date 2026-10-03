import { queryOptions } from '@tanstack/react-query';
import type { HelpTopics } from '@/types/help';
import type { MenuData } from '@/types/menu';
import type { OrdersResponse } from '@/types/order';
import type { Restaurant } from '@/types/restaurant';
import { toOrderHistory } from './adapters';
import { apiGet } from './client';
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

/** GET /restaurant: profile, opening hours and live status. The status can change at any time. */
export const restaurantQuery = () =>
  queryOptions({
    queryKey: ['restaurant'] as const,
    queryFn: () => apiGet<Restaurant>('restaurant'),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

/** GET /menu: categories, dishes and the curated dish lists. */
export const menuQuery = () =>
  queryOptions({
    queryKey: ['menu'] as const,
    queryFn: () => apiGet<MenuData>('menu'),
    staleTime: Infinity,
  });

// A stable reference, so TanStack Query memoises the adapted result.
const selectOrderHistory = (raw: OrdersResponse) => toOrderHistory(raw);

/**
 * GET /orders: the guest's order history and the id pool for new orders. The cache keeps
 * the response as sent; `select` adapts it on read (toOrderHistory), so relative mock
 * dates are worked out in the browser, not frozen at build time.
 */
export const orderHistoryQuery = () =>
  queryOptions({
    queryKey: ['orders', 'history'] as const,
    queryFn: () => apiGet<OrdersResponse>('orders'),
    select: selectOrderHistory,
    staleTime: Infinity,
  });

/** GET /help: the Help page topics that open in a dialog. */
export const helpQuery = () =>
  queryOptions({
    queryKey: ['help'] as const,
    queryFn: () => apiGet<HelpTopics>('help'),
    staleTime: Infinity,
  });
