import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { toOrderHistory } from '@/api/adapters';
import { branchMenuQuery, orderHistoryQuery, serviceRequestsQuery } from '@/api/queries';
import { useTableOrders } from '@/api/hooks';
import type { Branch } from '@/types/branch';
import { createMenuCatalog } from '@/lib/menu';
import type { Order, OrdersResponse } from '@/types/order';

export type DashboardSection = 'dashboard' | 'tables' | 'orders' | 'menu' | 'requests' | 'payments';

/** Keep the dashboard scoped to the selected branch and remove duplicate fixture ids. */
export function branchOrders(raw: OrdersResponse, branch: Branch): Order[] {
  const history = toOrderHistory(raw, branch).history;
  return [...new Map(history.map((order) => [order.id, order])).values()].sort(
    (a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt),
  );
}

/** Fixture table references only; they do not indicate a live table/session state. */
export function fixtureTables(orders: readonly Order[]): number[] {
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

export function recentOrderActivity(orders: readonly Order[]) {
  return orders
    .flatMap((order) =>
      order.timeline.map((event, index) => ({
        id: `${order.id}:${index}`,
        order,
        status: event.status,
        time: event.time,
        note: event.note,
        sortAt: Date.parse(order.placedAt) + index,
      })),
    )
    .sort((a, b) => b.sortAt - a.sortAt);
}

export function useAdminDashboardData(
  branch?: Branch,
  selectedTable?: number,
  section: DashboardSection = 'dashboard',
) {
  const menuRequired = section === 'dashboard' || section === 'menu';
  const ordersRequired =
    section === 'dashboard' ||
    section === 'tables' ||
    section === 'orders' ||
    section === 'payments';
  const menuQuery = useQuery({
    ...branchMenuQuery(branch?.id ?? ''),
    enabled: Boolean(branch && menuRequired),
  });
  const ordersQuery = useQuery({
    ...orderHistoryQuery(),
    enabled: Boolean(branch && ordersRequired),
  });
  const menu = useMemo(
    () => (menuQuery.data ? createMenuCatalog(menuQuery.data) : undefined),
    [menuQuery.data],
  );
  const orders = useMemo(
    () => (branch && ordersQuery.data ? branchOrders(ordersQuery.data, branch) : []),
    [branch, ordersQuery.data],
  );
  const tableOrdersQuery = useTableOrders(
    branch?.id ?? '',
    selectedTable ?? 0,
    Boolean(branch && section === 'tables' && selectedTable !== undefined),
  );
  const sessionIds = [
    ...new Set(
      (tableOrdersQuery.data?.orders ?? [])
        .map((order) => order.sessionId)
        .filter((id): id is string => id !== undefined),
    ),
  ];
  const requestQueries = useQueries({
    queries: sessionIds.map((sessionId) => serviceRequestsQuery(sessionId)),
  });
  const tableRequests = requestQueries.flatMap((query) => query.data?.requests ?? []);

  return {
    menu,
    menuLoading: menuQuery.isPending,
    menuError: menuQuery.error,
    orders,
    ordersLoading: ordersQuery.isPending,
    ordersError: ordersQuery.error,
    tables: fixtureTables(orders),
    activity: recentOrderActivity(orders),
    tableOrders: tableOrdersQuery.data?.orders ?? [],
    tableOrdersLoading: tableOrdersQuery.isPending,
    tableOrdersError: tableOrdersQuery.error,
    sessionIds,
    tableRequests,
    requestsLoading: requestQueries.some((query) => query.isPending),
    requestsError: requestQueries.find((query) => query.error)?.error,
  };
}
