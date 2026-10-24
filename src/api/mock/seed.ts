import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { cartLineLabels } from '@/hooks/useCartLineLabels';
import { joinBranch } from '@/lib/branchParts';
import { createClock } from '@/lib/clock';
import { createMenuCatalog, type MenuCatalog } from '@/lib/menu';
import { createMoney } from '@/lib/money';
import type { FloorPlanLayout } from '@/types/admin';
import type { Branch, BranchConfig, BranchSummary } from '@/types/branch';
import type { MenuData } from '@/types/menu';
import type { OrdersResponse } from '@/types/order';
import type { BranchPromotions } from '@/types/promotion';
import { branchFloorsQuery, contentQuery, orderHistoryQuery, restaurantQuery } from '../queries';
import { isBackendEnabled } from '../backend';
import { apiGet, staticGet } from '../client';
import { createTranslator } from '../translator';
import type { MockDb } from './db';
import { withStatus } from './branchStatus';
import { applyMenuChanges } from './menuChanges';
import type { OrderLabels } from './orderBuilder';

/**
 * What the mock server knows besides its own tables: the reference data a backend keeps in
 * its database (branches, menus, the drawn order history and the riders) and the copy
 * it writes into orders. It's the dummy JSON from public/api, read through the app's query
 * cache, so it's normally already there (prefetched at build time) and costs no request.
 */
export interface MockSeed {
  /**
   * GET /branches: the branches as staff set them up (branches.json with their changes, the
   * ones they added, less the ones they removed), with the status their week and staff set.
   */
  branches(): Promise<Branch[]>;
  /** The same branches before the status: what staff saved. */
  branchConfigs(): Promise<Branch[]>;
  /**
   * The table numbers a branch's QR links may carry (what a backend stores per branch), widened
   * to every table on the floor plan staff saved. Guests aren't sent it.
   */
  tables(branchId: string): Promise<{ first: number; last: number }>;
  defaultBranchId(): Promise<string>;
  /** GET /branches/:id/menu: the dummy JSON with staff changes on top. */
  menuData(branchId: string): Promise<MenuData>;
  /** The same menu, as a catalog to look dishes up in. */
  menu(branchId: string): Promise<MenuCatalog>;
  /** GET /branches/:id/promotions: the branch's promo codes and automatic offers. */
  promotions(branchId: string): Promise<BranchPromotions>;
  /** GET /branches/:id/floors: the branch's areas and tables, as staff last saved them. */
  floors(branchId: string): Promise<FloorPlanLayout>;
  /** GET /orders as sent: the drawn history (every branch) and the riders. */
  orders(): Promise<OrdersResponse>;
  /** The words a new order at this branch is written with. */
  orderLabels(branch: Branch): Promise<OrderLabels>;
}

/**
 * How the mock reads the data it builds on. On its own: the dummy JSON as published, read once.
 * With the backend serving branches and menus (NEXT_PUBLIC_BACKEND_URL): the backend's, live,
 * so what the mock still serves (orders, the kitchen, the floor) prices and checks dishes as
 * staff left them there — a dish sold out on the backend is refused in an order here too.
 */
const seedSource = <T>(path: string) =>
  isBackendEnabled()
    ? { queryFn: () => apiGet<T>(path), staleTime: BACKEND_SEED_STALE_MS }
    : { queryFn: () => staticGet<T>(path), staleTime: Infinity };

/** How long the mock reuses what it read from the backend (the guest app's own menu polls a minute). */
const BACKEND_SEED_STALE_MS = 15_000;

/**
 * MOCK ONLY: a branch's menu before the mock's own staff changes (none once the backend owns the
 * menu). Always read over HTTP (the app's GET /branches/:id/menu is the mock's own, unless the
 * backend serves it).
 */
export const menuBaseQuery = (branchId: string) =>
  queryOptions({
    queryKey: ['mock', 'menu-base', branchId] as const,
    ...seedSource<MenuData>(`branches/${branchId}/menu`),
  });

/**
 * MOCK ONLY: the branches before the status the mock's staff set (none once the backend owns
 * them). Always read over HTTP, like the menu.
 */
export const branchesBaseQuery = () =>
  queryOptions({
    queryKey: ['mock', 'branches-base'] as const,
    // The published file has whole branches; the backend sends each one's rules on their own.
    ...(isBackendEnabled()
      ? {
          queryFn: async () => {
            const summaries = await apiGet<BranchSummary[]>('branches');
            return Promise.all(
              summaries.map(async (s) =>
                joinBranch(s, await apiGet<BranchConfig>(`branches/${s.id}/config`)),
              ),
            );
          },
          staleTime: BACKEND_SEED_STALE_MS,
        }
      : { queryFn: () => staticGet<Branch[]>('branches'), staleTime: Infinity }),
  });

/**
 * MOCK ONLY: a branch's promotions, as published or (with the backend) as the backend has them,
 * so the orders the mock still prices take the same discounts the backend's quotes do. Read over
 * HTTP, like the menu.
 */
export const promotionsBaseQuery = (branchId: string) =>
  queryOptions({
    queryKey: ['mock', 'promotions-base', branchId] as const,
    ...seedSource<BranchPromotions>(`branches/${branchId}/promotions`),
  });

/**
 * MOCK ONLY: the table numbers each demo branch's QR links may carry, as a backend stores them
 * per branch (its floor plan widens them). A branch staff add gets the default.
 */
const TABLE_RANGES: Record<string, { first: number; last: number }> = {
  'blr-indiranagar': { first: 1, last: 999 },
  'ktm-thamel': { first: 1, last: 40 },
};
const DEFAULT_TABLE_RANGE = { first: 1, last: 40 };

export function querySeed(
  client: QueryClient,
  db: Pick<MockDb, 'menuChanges' | 'branchStatus' | 'floorLayouts' | 'branchSetup'>,
  now: () => number = Date.now,
): MockSeed {
  /** The branch in branches.json a branch builds on (itself, or the one it was copied from). */
  const sourceOf = (branchId: string) =>
    db.branchSetup.read().added.find((a) => a.id === branchId)?.copiedFrom ?? branchId;
  const branchConfigs = async () => {
    const base = await client.fetchQuery(branchesBaseQuery());
    const { saved, added, removed } = db.branchSetup.read();
    const gone = new Set(removed);
    return [
      ...base.filter((b) => !gone.has(b.id)).map((b) => saved[b.id] ?? b),
      ...added.flatMap((a) => (saved[a.id] && !gone.has(a.id) ? [saved[a.id]] : [])),
    ];
  };
  const branches = async () => {
    const at = new Date(now());
    const changes = db.branchStatus.read();
    return (await branchConfigs()).map((b) => withStatus(b, changes[b.id], at));
  };
  const floors = async (branchId: string) =>
    db.floorLayouts.read()[branchId] ??
    client.ensureQueryData(branchFloorsQuery(sourceOf(branchId)));
  const menuData = async (branchId: string) => {
    const [base, all] = await Promise.all([
      client.fetchQuery(menuBaseQuery(sourceOf(branchId))),
      branchConfigs(),
    ]);
    const branch = all.find((b) => b.id === branchId);
    if (!branch) return base;
    return applyMenuChanges(
      base,
      db.menuChanges.read()[branchId],
      new Date(now()),
      createClock(branch),
    );
  };
  function content<N extends 'orders' | 'common' | 'cart' | 'status'>(ns: N) {
    return client.ensureQueryData(contentQuery(ns)).then(createTranslator);
  }
  return {
    branches,
    branchConfigs,
    defaultBranchId: async () => {
      const [{ defaultBranchId }, configs] = await Promise.all([
        client.ensureQueryData(restaurantQuery()),
        branchConfigs(),
      ]);
      // The brand's default branch, or the first one left if staff removed it.
      return configs.some((b) => b.id === defaultBranchId)
        ? defaultBranchId
        : (configs[0]?.id ?? defaultBranchId);
    },
    menuData,
    menu: async (branchId) => createMenuCatalog(await menuData(branchId)),
    promotions: (branchId) => client.fetchQuery(promotionsBaseQuery(sourceOf(branchId))),
    floors,
    tables: async (branchId) => {
      const base = TABLE_RANGES[sourceOf(branchId)] ?? DEFAULT_TABLE_RANGE;
      const numbers = (await floors(branchId)).floors.flatMap((f) => f.tables.map((t) => t.number));
      return {
        first: Math.min(base.first, ...numbers),
        last: Math.max(base.last, ...numbers),
      };
    },
    orders: () => client.ensureQueryData(orderHistoryQuery()),
    orderLabels: async (branch) => {
      const [orders, common, cart] = await Promise.all([
        content('orders'),
        content('common'),
        content('cart'),
      ]);
      return {
        paidOnline: orders('payment.paidOnline'),
        payInPerson: {
          counter: orders('payment.payAtCounter'),
          pickup: orders('payment.payAtPickup'),
          cod: orders('payment.cashOnDelivery'),
        },
        onBill: orders('payment.onBill'),
        takenBy: (name) => orders('payment.takenBy', { name }),
        atTableName: (method) => common(`paymentMethods.${method}`),
        cancelReason: (reason) => orders(`restaurantCancel.${reason}`),
        methodName: (method) => common(`paymentMethods.${method}`),
        lineLabels: cartLineLabels(cart, createMoney(branch)),
        estimate: common('prepTime', branch.prepMinutes),
      };
    },
  };
}
