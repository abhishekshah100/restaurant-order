'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toOrderHistory } from '@/api/adapters';
import { branchMenuQuery, orderHistoryQuery } from '@/api/queries';
import { createMenuCatalog } from '@/lib/menu';
import type { Branch } from '@/types/branch';
import type { Order, OrdersResponse } from '@/types/order';

/*
 * Reads for the admin sections that haven't been redesigned yet (Orders, Menu, Payments).
 * They show the drawn order history, as before; the waiter home and the floor plan read
 * GET /admin/branches/:branchId/service and …/tables instead.
 */

/** The branch's drawn orders, newest first, without duplicate ids. */
export function branchOrders(raw: OrdersResponse, branch: Branch): Order[] {
  const history = toOrderHistory(raw, branch).history;
  return [...new Map(history.map((order) => [order.id, order])).values()].sort(
    (a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt),
  );
}

/** The branch's drawn order history. */
export function useBranchOrderHistory(branch: Branch) {
  const query = useQuery(orderHistoryQuery());
  const orders = useMemo(
    () => (query.data ? branchOrders(query.data, branch) : []),
    [branch, query.data],
  );
  return { orders, loading: query.isPending, error: query.error };
}

/** The branch's menu catalog. */
export function useBranchMenu(branch: Branch) {
  const query = useQuery(branchMenuQuery(branch.id));
  const menu = useMemo(
    () => (query.data ? createMenuCatalog(query.data) : undefined),
    [query.data],
  );
  return { menu, loading: query.isPending, error: query.error };
}
