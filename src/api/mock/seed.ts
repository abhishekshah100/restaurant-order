import type { QueryClient } from '@tanstack/react-query';
import { cartLineLabels } from '@/hooks/useCartLineLabels';
import { createMenuCatalog, type MenuCatalog } from '@/lib/menu';
import { createMoney } from '@/lib/money';
import type { Branch } from '@/types/branch';
import type { OrdersResponse } from '@/types/order';
import {
  branchMenuQuery,
  branchesQuery,
  contentQuery,
  orderHistoryQuery,
  restaurantQuery,
} from '../queries';
import { createTranslator } from '../translator';
import type { OrderLabels } from './orderBuilder';

/**
 * What the mock server knows besides its own tables: the reference data a backend keeps in
 * its database (branches, menus, the drawn order history and the order id pool) and the copy
 * it writes into orders. It's the dummy JSON from public/api, read through the app's query
 * cache, so it's normally already there (prefetched at build time) and costs no request.
 */
export interface MockSeed {
  branches(): Promise<Branch[]>;
  defaultBranchId(): Promise<string>;
  menu(branchId: string): Promise<MenuCatalog>;
  /** GET /orders as sent: the drawn history (every branch) and the order id pool. */
  orders(): Promise<OrdersResponse>;
  /** The words a new order at this branch is written with. */
  orderLabels(branch: Branch): Promise<OrderLabels>;
}

export function querySeed(client: QueryClient): MockSeed {
  const content = <N extends 'orders' | 'common' | 'cart'>(ns: N) =>
    client.ensureQueryData(contentQuery(ns)).then(createTranslator);
  return {
    branches: () => client.ensureQueryData(branchesQuery()),
    defaultBranchId: async () => (await client.ensureQueryData(restaurantQuery())).defaultBranchId,
    menu: async (branchId) =>
      createMenuCatalog(await client.ensureQueryData(branchMenuQuery(branchId))),
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
        methodName: (method) => common(`paymentMethods.${method}`),
        lineLabels: cartLineLabels(cart, createMoney(branch)),
        estimate: branch.prepTime,
      };
    },
  };
}
