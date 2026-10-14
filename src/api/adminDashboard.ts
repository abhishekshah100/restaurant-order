'use client';

import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { toOrderHistory } from '@/api/adapters';
import { branchMenuQuery, orderHistoryQuery, serviceRequestsQuery } from '@/api/queries';
import { useTableOrders } from '@/api/hooks';
import { createMenuCatalog } from '@/lib/menu';
import type { Branch } from '@/types/branch';
import type { Order, OrdersResponse } from '@/types/order';

/*
 * Reads for the admin sections that haven't been redesigned yet (Tables, Orders, Menu,
 * Payments). They show the drawn order history, as before; the waiter home reads the floor
 * through GET /admin/branches/:branchId/service instead (useBranchService).
 */

/** The branch's drawn orders, newest first, without duplicate ids. */
export function branchOrders(raw: OrdersResponse, branch: Branch): Order[] {
  const history = toOrderHistory(raw, branch).history;
  return [...new Map(history.map((order) => [order.id, order])).values()].sort(
    (a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt),
  );
}

/** The dine-in tables those orders mention, in order. */
export function orderTables(orders: readonly Order[]): number[] {
  return [
    ...new Set(
      orders
        .filter(
          (order): order is Order & { table: number } =>
            order.mode === 'dineIn' && order.table !== undefined,
        )
        .map((order) => order.table),
    ),
  ].sort((a, b) => a - b);
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

/** One table's orders today and the open requests of the sessions behind them. */
export function useTableDetail(branch: Branch, table: number | undefined) {
  const ordersQuery = useTableOrders(branch.id, table ?? 0, table !== undefined);
  const orders = ordersQuery.data?.orders ?? [];
  const sessionIds = [
    ...new Set(orders.map((order) => order.sessionId).filter((id): id is string => !!id)),
  ];
  const requestQueries = useQueries({
    queries: sessionIds.map((sessionId) => serviceRequestsQuery(sessionId)),
  });
  return {
    orders,
    ordersLoading: ordersQuery.isPending,
    ordersError: ordersQuery.error,
    sessionIds,
    requests: requestQueries.flatMap((query) => query.data?.requests ?? []),
    requestsLoading: requestQueries.some((query) => query.isPending),
    requestsError: requestQueries.find((query) => query.error)?.error,
  };
}
