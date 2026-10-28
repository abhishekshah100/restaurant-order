'use client';

import { useQueries, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useAdminToken } from '@/hooks/useAdminSession';
import { createClock, type Clock } from '@/lib/clock';
import { createMenuCatalog, type MenuCatalog } from '@/lib/menu';
import { createMoney, type Money } from '@/lib/money';
import { withLiveStatus } from '@/lib/restaurantStatus';
import { joinBranch } from '@/lib/branchParts';
import { resolveBranch } from '@/lib/scan';
import type { Branch, BranchConfig, BranchSummary, MobileRules } from '@/types/branch';
import type { HelpTopics } from '@/types/help';
import type { BranchPromotions } from '@/types/promotion';
import type { Restaurant } from '@/types/restaurant';
import { useActiveBranchId } from './activeBranch';
import { isMockApi } from './config';
import type { AdminOrdersFilter, AdminSignInRequest, OrderLineRequest } from './contracts';
import {
  BRANCH_STATUS_REFRESH_MS,
  adminBranchesQuery,
  adminOffersQuery,
  branchConfigQuery,
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

/** Every branch, in brief (GET /branches). */
export function useBranches(): BranchSummary[] {
  return useSuspenseQuery(branchesQuery()).data;
}

/**
 * The branch the guest is at (their session's) in brief: where it is, its week and its live
 * status. The default branch until the session has been read, so prerendered HTML matches the
 * first client render.
 */
export function useBranchSummary(): BranchSummary {
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
 * The guest's branch with its rules (GET /branches/:id/config): money, taxes, payments, each
 * mode's rules. GuestSessionProvider makes a branch active only once its config is read, so this
 * never waits on the network in practice.
 */
export function useBranch(): Branch {
  const summary = useBranchSummary();
  const config = useSuspenseQuery(branchConfigQuery(summary.id)).data;
  return useMemo(() => joinBranch(summary, config), [summary, config]);
}

/** Another branch's rules, read when a screen needs them (the start screen's chosen outlet). */
export function useBranchConfig(branchId: string): BranchConfig {
  return useSuspenseQuery(branchConfigQuery(branchId)).data;
}

/**
 * Whether this visit has read the guest's branch status from the server (the list, or the
 * status poll), not just the copy built into the page, which can be hours old. True as well
 * when reading the list failed: the page goes on with what it has then.
 */
export function useBranchStatusKnown(): boolean {
  const { dataUpdatedAt: listedAt, isError } = useSuspenseQuery(branchesQuery());
  const { defaultBranchId } = useRestaurant();
  const branchId = useActiveBranchId() ?? defaultBranchId;
  const { dataUpdatedAt: liveAt } = useQuery({ ...branchStatusQuery(branchId), enabled: false });
  return listedAt > 0 || liveAt > 0 || isError;
}

/**
 * Keeps the guest's branch status fresh while mounted: GET /branches/:id/status at the time the
 * server says it next changes (`statusUntil`: last orders, the next session, a pause's end; for
 * dine-in, takeaway and delivery), and every 3 minutes for what staff change without notice. Not
 * in a background tab. For pages where guests order; mount it once per page.
 */
export function useBranchStatusPolling(): void {
  const branch = useBranchSummary();
  const { refetch } = useQuery({
    ...branchStatusQuery(branch.id),
    refetchInterval: BRANCH_STATUS_REFRESH_MS,
  });
  const dineIn = branch.statusUntil;
  const takeaway = branch.modeStatus.takeaway.statusUntil;
  const delivery = branch.modeStatus.delivery.statusUntil;
  useEffect(() => {
    // The next scheduled change, of any way of ordering, still to come.
    const now = Date.now();
    const next = [dineIn, takeaway, delivery]
      .map((at) => (at ? Date.parse(at) : NaN))
      .filter((at) => at > now)
      .sort((a, b) => a - b)[0];
    if (next === undefined) return;
    // A second after, so the server's answer has moved on. Timers can't wait beyond ~24 days.
    const timer = window.setTimeout(
      () => void refetch(),
      Math.min(next - now + 1000, 2_147_000_000),
    );
    return () => window.clearTimeout(timer);
  }, [dineIn, takeaway, delivery, refetch]);
}

/** The active branch's menu with its lookups (getDish, dishesIn, searchDishes…). The same object until the menu changes. */
export function useMenu(): MenuCatalog {
  const { data } = useSuspenseQuery(branchMenuQuery(useBranchSummary().id));
  return useMemo(() => createMenuCatalog(data), [data]);
}

/**
 * The active branch's menu without waiting for it: read when `needed` (and kept fresh like
 * useMenu), else whatever is already cached; null until then. For code on every page (the cart),
 * so a page that doesn't show the menu never waits for it or downloads it.
 */
export function useMenuIfNeeded(needed: boolean): MenuCatalog | null {
  const { data } = useQuery({ ...branchMenuQuery(useBranchSummary().id), enabled: needed });
  return useMemo(() => (data ? createMenuCatalog(data) : null), [data]);
}

/**
 * Whether a branch's config, menu (when `withMenu`) and promotions are in the cache (or failed to load,
 * for the suspense hooks to throw to the error page), so it can become the active branch without
 * suspending. Only the default branch's are built into the page; another's are read here first.
 */
export function useBranchDataLoaded(branchId: string, withMenu: boolean): boolean {
  return useQueries({
    // Any copy will do (the one built into the page too): this only waits for one to exist.
    // Pages that show the menu read it again when they open; others never download it.
    queries: [
      { ...branchConfigQuery(branchId), staleTime: Infinity },
      ...(withMenu ? [{ ...branchMenuQuery(branchId), staleTime: Infinity }] : []),
      { ...branchPromotionsQuery(branchId), staleTime: Infinity },
    ],
    combine: (results) => results.every((r) => r.data !== undefined || r.isError),
  });
}

/** The active branch's promo codes and automatic offers (GET /branches/:id/promotions). */
export function usePromotions(): BranchPromotions {
  return useSuspenseQuery(branchPromotionsQuery(useBranchSummary().id)).data;
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

/**
 * GET /admin/branches/:branchId/orders: today's orders in full, or the filter's days and table;
 * polled like the service while `live` (the days reach today).
 */
export const useBranchOrders = (
  branchId: string | undefined,
  filter?: AdminOrdersFilter,
  live?: boolean,
) => useQuery(branchOrdersQuery(useAdminToken(), branchId, filter, live));

/** GET /admin/branches/:branchId/tables: every area with its tables; polled like the service. */
export const useFloorPlan = (branchId: string | undefined) =>
  useQuery(floorPlanQuery(useAdminToken(), branchId));

/** GET /admin/branches/:branchId/offers: the branch's automatic offers, paused ones too. */
export const useAdminOffers = (branchId: string | undefined) =>
  useQuery(adminOffersQuery(useAdminToken(), branchId));

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
  return useQuery(deliveryQuoteQuery(useBranchSummary().id, area, itemTotal));
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
