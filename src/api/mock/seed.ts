import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { cartLineLabels } from '@/hooks/useCartLineLabels';
import { withSchedule, type ScheduleLabels } from '@/lib/branchHours';
import { createClock } from '@/lib/clock';
import { createMenuCatalog, type MenuCatalog } from '@/lib/menu';
import { createMoney } from '@/lib/money';
import type { FloorPlanLayout } from '@/types/admin';
import type { Branch } from '@/types/branch';
import type { MenuData } from '@/types/menu';
import type { OrdersResponse } from '@/types/order';
import type { BranchPromotions } from '@/types/promotion';
import { branchFloorsQuery, contentQuery, orderHistoryQuery, restaurantQuery } from '../queries';
import { staticGet } from '../client';
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
   * ones they added, less the ones they removed), with today's hours from each one's week and
   * the status staff set on top.
   */
  branches(): Promise<Branch[]>;
  /** The same branches before today's hours and the status: what staff saved. */
  branchConfigs(): Promise<Branch[]>;
  /**
   * The published branch one builds on: its own entry in branches.json, or for a branch staff
   * added, the one it was copied from (its menu, promotions, floor plan and payment methods).
   */
  baseBranch(branchId: string): Promise<Branch | undefined>;
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
 * MOCK ONLY: a branch's menu JSON as published, before staff changes. Always read over HTTP
 * (the app's GET /branches/:id/menu is the mock's own, with the changes on).
 */
export const menuBaseQuery = (branchId: string) =>
  queryOptions({
    queryKey: ['mock', 'menu-base', branchId] as const,
    queryFn: () => staticGet<MenuData>(`branches/${branchId}/menu`),
    staleTime: Infinity,
  });

/**
 * MOCK ONLY: the branches JSON as published, before the status staff set. Always read over HTTP
 * (the app's GET /branches is the mock's own, with the status on).
 */
export const branchesBaseQuery = () =>
  queryOptions({
    queryKey: ['mock', 'branches-base'] as const,
    queryFn: () => staticGet<Branch[]>('branches'),
    staleTime: Infinity,
  });

/**
 * MOCK ONLY: a branch's promotions JSON as published. Always read over HTTP (the app's GET
 * /branches/:id/promotions is the mock's own, so branches staff add have promotions too).
 */
export const promotionsBaseQuery = (branchId: string) =>
  queryOptions({
    queryKey: ['mock', 'promotions-base', branchId] as const,
    queryFn: () => staticGet<BranchPromotions>(`branches/${branchId}/promotions`),
    staleTime: Infinity,
  });

/**
 * A branch whose table numbers (the ones guests can scan, `tables`) take in every table on the
 * floor plan staff saved, so a table added in Settings works with its QR code at once, and
 * say which are out of service.
 */
function withTables(branch: Branch, layout: FloorPlanLayout | undefined): Branch {
  const tables = layout?.floors.flatMap((f) => f.tables) ?? [];
  if (tables.length === 0) return branch;
  const numbers = tables.map((t) => t.number);
  const outOfService = tables.filter((t) => t.disabled).map((t) => t.number);
  return {
    ...branch,
    tables: {
      ...branch.tables,
      first: Math.min(branch.tables.first, ...numbers),
      last: Math.max(branch.tables.last, ...numbers),
      ...(outOfService.length > 0 ? { outOfService } : {}),
    },
  };
}

export function querySeed(
  client: QueryClient,
  db: Pick<MockDb, 'menuChanges' | 'branchStatus' | 'floorLayouts' | 'branchSetup'>,
  now: () => number = Date.now,
): MockSeed {
  /** The branch in branches.json a branch builds on (itself, or the one it was copied from). */
  const sourceOf = (branchId: string) =>
    db.branchSetup.read().added.find((a) => a.id === branchId)?.copiedFrom ?? branchId;
  const branchConfigs = async () => {
    const base = await client.ensureQueryData(branchesBaseQuery());
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
    const layouts = db.floorLayouts.read();
    const [configs, status] = await Promise.all([branchConfigs(), content('status')]);
    const labels: ScheduleLabels = {
      lastOrdersNote: (minutes) => status('hours.lastOrdersNote', { minutes }),
      closedToday: status('hours.closedToday'),
    };
    return configs.map((b) =>
      withTables(
        withStatus(withSchedule(b, at, labels), changes[b.id], at, createClock(b)),
        layouts[b.id],
      ),
    );
  };
  const menuData = async (branchId: string) => {
    const [base, all] = await Promise.all([
      client.ensureQueryData(menuBaseQuery(sourceOf(branchId))),
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
    baseBranch: async (branchId) =>
      (await client.ensureQueryData(branchesBaseQuery())).find((b) => b.id === sourceOf(branchId)),
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
    promotions: (branchId) => client.ensureQueryData(promotionsBaseQuery(sourceOf(branchId))),
    floors: async (branchId) =>
      db.floorLayouts.read()[branchId] ??
      client.ensureQueryData(branchFloorsQuery(sourceOf(branchId))),
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
        estimate: branch.prepTime,
      };
    },
  };
}
