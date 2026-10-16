import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { cartLineLabels } from '@/hooks/useCartLineLabels';
import { createClock } from '@/lib/clock';
import { createMenuCatalog, type MenuCatalog } from '@/lib/menu';
import { createMoney } from '@/lib/money';
import type { FloorPlanLayout } from '@/types/admin';
import type { Branch } from '@/types/branch';
import type { MenuData } from '@/types/menu';
import type { OrdersResponse } from '@/types/order';
import type { BranchPromotions } from '@/types/promotion';
import {
  branchFloorsQuery,
  branchPromotionsQuery,
  contentQuery,
  orderHistoryQuery,
  restaurantQuery,
} from '../queries';
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
  /** GET /branches: the dummy JSON with the status staff set on top. */
  branches(): Promise<Branch[]>;
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
  db: Pick<MockDb, 'menuChanges' | 'branchStatus' | 'floorLayouts'>,
  now: () => number = Date.now,
): MockSeed {
  const branches = async () => {
    const at = new Date(now());
    const changes = db.branchStatus.read();
    const layouts = db.floorLayouts.read();
    return (await client.ensureQueryData(branchesBaseQuery())).map((b) =>
      withTables(withStatus(b, changes[b.id], at, createClock(b)), layouts[b.id]),
    );
  };
  const menuData = async (branchId: string) => {
    const [base, all] = await Promise.all([
      client.ensureQueryData(menuBaseQuery(branchId)),
      client.ensureQueryData(branchesBaseQuery()),
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
  const content = <N extends 'orders' | 'common' | 'cart'>(ns: N) =>
    client.ensureQueryData(contentQuery(ns)).then(createTranslator);
  return {
    branches,
    defaultBranchId: async () => (await client.ensureQueryData(restaurantQuery())).defaultBranchId,
    menuData,
    menu: async (branchId) => createMenuCatalog(await menuData(branchId)),
    promotions: (branchId) => client.ensureQueryData(branchPromotionsQuery(branchId)),
    floors: async (branchId) =>
      db.floorLayouts.read()[branchId] ?? client.ensureQueryData(branchFloorsQuery(branchId)),
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
