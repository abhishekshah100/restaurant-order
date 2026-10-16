'use client';

import { useCallback, useMemo } from 'react';
import { useBranchMenu } from '@/api/adminDashboard';
import { useBranchOrders } from '@/api/hooks';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { kitchenTickets, type CategoryOf } from '@/lib/kitchenBoard';

/**
 * Today's tickets for the kitchen pages: every round of the branch's orders (GET
 * /admin/branches/:branchId/orders, polled every 15 s, the same read as the Orders page), with
 * the branch's menu for stations (a dish's category). No kitchen data of its own: guests' and
 * waiters' orders are the tickets.
 */
export function useKitchenTickets() {
  const { branch, region } = useAdminWorkspace();
  const orders = useBranchOrders(branch.id);
  const { menu } = useBranchMenu(region);
  const data = orders.data?.orders;

  const tickets = useMemo(() => (data ? kitchenTickets(data, region) : undefined), [data, region]);
  const dishOf = useCallback((slug: string) => menu?.getDish(slug), [menu]);
  const categoryOf: CategoryOf = useCallback((slug) => dishOf(slug)?.categoryId, [dishOf]);
  const categories = menu?.categories ?? [];

  return {
    tickets,
    categories,
    categoryOf,
    dishOf,
    isError: orders.isError && !data,
    isFetching: orders.isFetching,
    refetch: orders.refetch,
  };
}
