'use client';

import { useQueries, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useAdminToken } from '@/hooks/useAdminSession';
import { createClock, type Clock } from '@/lib/clock';
import { createMenuCatalog, type MenuCatalog } from '@/lib/menu';
import { createMoney, type Money } from '@/lib/money';
import { withLiveStatus } from '@/lib/restaurantStatus';
import { resolveBranch } from '@/lib/scan';
import type { Branch, MobileRules } from '@/types/branch';
import type { HelpTopics } from '@/types/help';
import type { BranchPromotions } from '@/types/promotion';
import type { Restaurant } from '@/types/restaurant';
import { useActiveBranchId } from './activeBranch';
import { isMockApi } from './config';
import type { AdminSignInRequest, OrderLineRequest } from './contracts';
import {
  BRANCH_STATUS_REFRESH_MS,
  adminBranchesQuery,
  branchStatusQuery,
  branchMenuQuery,
  branchOrdersQuery,
  branchSettingsQuery,
  floorLayoutQuery,
  floorPlanQuery,
  tableDetailQuery,
  tableQrCodesQuery,
  reservationsQuery,
  branchPromotionsQuery,
  branchServiceQuery,
  branchesQuery,
  contentQuery,
  deliveryQuoteQuery,
  helpQuery,
  orderQuery,
  promoQuoteQuery,
  restaurantQuery,
  serviceRequestsQuery,
  sessionOrdersQuery,
  tableOrdersQuery,
  type ContentMap,
  type ContentNamespace,
} from './queries';
import { createTranslator, type Translator } from './translator';

/*
 * The root layout prefetches the reference data at build time (the default branch's menu and
 * promotions; the help layout adds the Help topics), and GuestSessionProvider switches to
 * another branch only once its menu and promotions are loaded (useBranchDataLoaded), so the
 * suspense hooks never wait on the network in practice: they read the TanStack Query cache,
 * and `data` is never undefined. Server-owned reads (orders, service requests) load on the client and
 * return the TanStack result (pending until the first response).
 */

/** Screen copy for one area: `const t = useContent('checkout'); t('verify.title')`. */
export function useContent<N extends ContentNamespace>(ns: N): Translator<ContentMap[N]> {
  const { data } = useSuspenseQuery(contentQuery(ns));
  return useMemo(() => createTranslator(data), [data]);
}

/** The brand: name, tagline, social links and the default branch. */
export function useRestaurant(): Restaurant {
  return useSuspenseQuery(restaurantQuery()).data;
}

/** Every branch. */
export function useBranches(): Branch[] {
  return useSuspenseQuery(branchesQuery()).data;
}

/**
 * The branch the guest is at (their session's): hours, live status and region rules. The
 * default branch until the session has been read, so prerendered HTML matches the first
 * client render.
 */
export function useBranch(): Branch {
  const { data: branches, dataUpdatedAt: listedAt } = useSuspenseQuery(branchesQuery());
  const { defaultBranchId } = useRestaurant();
  const branch = resolveBranch(branches, useActiveBranchId() ?? defaultBranchId);
  // Its latest status, when a page polls it (BranchStatusWatch); this only reads the cache.
  const { data: live, dataUpdatedAt: liveAt } = useQuery({
    ...branchStatusQuery(branch.id),
    enabled: false,
  });
  return useMemo(
    () => withLiveStatus(branch, listedAt, live, liveAt),
    [branch, listedAt, live, liveAt],
  );
}

/**
 * Keeps the guest's branch status fresh while mounted: GET /branches/:id/status every minute
 * (not in a background tab). For pages where guests order; mount it once per page.
 */
export function useBranchStatusPolling(): void {
  const { defaultBranchId } = useRestaurant();
  const branchId = useActiveBranchId() ?? defaultBranchId;
  useQuery({ ...branchStatusQuery(branchId), refetchInterval: BRANCH_STATUS_REFRESH_MS });
}

/** The active branch's menu with its lookups (getDish, dishesIn, searchDishes…). The same object until the menu changes. */
export function useMenu(): MenuCatalog {
  const { data } = useSuspenseQuery(branchMenuQuery(useBranch().id));
  return useMemo(() => createMenuCatalog(data), [data]);
}

/**
 * The active branch's menu without waiting for it: read when `needed` (and kept fresh like
 * useMenu), else whatever is already cached; null until then. For code on every page (the cart),
 * so a page that doesn't show the menu never waits for it or downloads it.
 */
export function useMenuIfNeeded(needed: boolean): MenuCatalog | null {
  const { data } = useQuery({ ...branchMenuQuery(useBranch().id), enabled: needed });
  return useMemo(() => (data ? createMenuCatalog(data) : null), [data]);
}

/**
 * Reads the active branch's menu once the browser is idle, so the guest's next page (almost
 * always the menu) opens at once without this page waiting for it.
 */
export function usePrefetchMenuWhenIdle(): void {
  const branchId = useBranch().id;
  const queryClient = useQueryClient();
  useEffect(() => {
    const prefetch = () => void queryClient.prefetchQuery(branchMenuQuery(branchId));
    if (typeof window.requestIdleCallback !== 'function') {
      const timer = window.setTimeout(prefetch, 1500);
      return () => window.clearTimeout(timer);
    }
    const idle = window.requestIdleCallback(prefetch, { timeout: 3000 });
    return () => window.cancelIdleCallback(idle);
  }, [branchId, queryClient]);
}

/**
 * Whether a branch's menu and promotions are in the cache (or failed to load, for the suspense
 * hooks to throw to the error page), so it can become the active branch without suspending.
 * Only the default branch's are built into the page; another's are read here first.
 */
export function useBranchDataLoaded(branchId: string): boolean {
  return useQueries({
    // Any copy will do (the one built into the page too): this only waits for one to exist.
    // Pages that show the menu read it again when they open; others never download it.
    queries: [
      { ...branchMenuQuery(branchId), staleTime: Infinity },
      { ...branchPromotionsQuery(branchId), staleTime: Infinity },
    ],
    combine: (results) => results.every((r) => r.data !== undefined || r.isError),
  });
}

/** The active branch's promo codes and automatic offers (GET /branches/:id/promotions). */
export function usePromotions(): BranchPromotions {
  return useSuspenseQuery(branchPromotionsQuery(useBranch().id)).data;
}

/** How the active branch writes money, times and mobile numbers. */
export interface Region {
  money: Money;
  clock: Clock;
  mobile: MobileRules;
}

/** Money, clock and mobile-number rules of the active branch. */
export function useRegion(): Region {
  const branch = useBranch();
  return useMemo(
    () => ({ money: createMoney(branch), clock: createClock(branch), mobile: branch.mobile }),
    [branch],
  );
}

/** The Help page topics, by id. */
export function useHelpTopics(): HelpTopics {
  return useSuspenseQuery(helpQuery()).data;
}

/* ---------- Server-owned reads ---------- */

/** GET /orders/:id: one order with its live status, polled while the kitchen moves it; idle without an id. */
export const useOrder = (id: string | undefined) => useQuery(orderQuery(id));

/** GET /sessions/:id/orders: the guest's orders; idle until there's a session. */
export const useSessionOrders = (sessionId: string | undefined) =>
  useQuery(sessionOrdersQuery(sessionId));

/** GET /tables/:branchId/:table/orders: this visit's orders at the table; idle until `enabled`. */
export const useTableOrders = (branchId: string, table: number, enabled: boolean) =>
  useQuery(tableOrdersQuery(branchId, table, enabled));

/** GET /sessions/:id/service-requests: this guest's pending requests; idle until there's a session. */
export const useServiceRequests = (sessionId: string | undefined) =>
  useQuery(serviceRequestsQuery(sessionId));

/**
 * GET /admin/branches: the branches the signed-in admin manages (`data` is the list), read
 * with the session on this device; idle while signed out.
 */
export const useAdminBranches = () => useQuery(adminBranchesQuery(useAdminToken()));

/**
 * GET /admin/branches/:branchId/service: the branch's open requests, today's orders and tables,
 * with the signed-in admin's session; polled every 15 s and refetched on returning to the tab.
 */
export const useBranchService = (branchId: string | undefined) =>
  useQuery(branchServiceQuery(useAdminToken(), branchId));

/** GET /admin/branches/:branchId/orders: today's orders in full; polled like the service. */
export const useBranchOrders = (branchId: string | undefined) =>
  useQuery(branchOrdersQuery(useAdminToken(), branchId));

/** GET /admin/branches/:branchId/tables: every area with its tables; polled like the service. */
export const useFloorPlan = (branchId: string | undefined) =>
  useQuery(floorPlanQuery(useAdminToken(), branchId));

/** GET /admin/branches/:branchId/reservations: bookings from today on; polled like the floor. */
export const useReservations = (branchId: string | undefined) =>
  useQuery(reservationsQuery(useAdminToken(), branchId));

/** GET /admin/branches/:branchId/settings: the branch's settings, to edit, and their choices. */
export const useBranchSettings = (branchId: string | undefined) =>
  useQuery(branchSettingsQuery(useAdminToken(), branchId));

/** GET /admin/branches/:branchId/floors: the floor plan as staff set it up, to edit. */
export const useFloorLayout = (branchId: string | undefined) =>
  useQuery(floorLayoutQuery(useAdminToken(), branchId));

/** GET /admin/branches/:branchId/tables/qr-codes: the link to print on each table. */
export const useTableQrCodes = (branchId: string | undefined) =>
  useQuery(tableQrCodesQuery(useAdminToken(), branchId));

/** GET /admin/branches/:branchId/tables/:table: one table's open orders and requests. */
export const useTableDetail = (branchId: string | undefined, table: number) =>
  useQuery(tableDetailQuery(useAdminToken(), branchId, table));

/** POST /delivery/quote at the active branch: idle until there's an area. */
export function useDeliveryQuote(area: string | undefined, itemTotal: number) {
  return useQuery(deliveryQuoteQuery(useBranch().id, area, itemTotal));
}

/** POST /promos/validate for the guest's session: idle until there's a session and a code. */
export function usePromoQuote(
  sessionId: string | undefined,
  code: string | undefined,
  lines: readonly OrderLineRequest[],
) {
  return useQuery(promoQuoteQuery(sessionId, code, lines));
}

/**
 * The mock server's demo staff login, for testers: null until loaded (after hydration) and
 * always null with a real backend (NEXT_PUBLIC_API_MOCK=false), which never loads the mock.
 */
export function useDemoAdminAccount(): AdminSignInRequest | null {
  const [account, setAccount] = useState<AdminSignInRequest | null>(null);
  useEffect(() => {
    if (!isMockApi()) return;
    let active = true;
    void import('./mock/demoAdmin').then(({ DEMO_ADMIN }) => {
      if (active) setAccount({ identity: DEMO_ADMIN.email, password: DEMO_ADMIN.password });
    });
    return () => {
      active = false;
    };
  }, []);
  return account;
}
