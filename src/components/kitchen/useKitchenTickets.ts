'use client';

import { useCallback, useMemo } from 'react';
import { useBranchMenu } from '@/api/adminDashboard';
import { useBranchOrders } from '@/api/hooks';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { kitchenTickets, type CategoryOf } from '@/lib/kitchenBoard';
import { prepMinutes } from '@/lib/prepTime';

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

  const dishOf = useCallback((slug: string) => menu?.getDish(slug), [menu]);
  // A round is due when its slowest dish is done (the menu's prep times).
  const tickets = useMemo(
    () =>
      data
        ? kitchenTickets(data, region, (slug) => prepMinutes(dishOf(slug)?.prepTime))
        : undefined,
    [data, region, dishOf],
  );
  const categoryOf: CategoryOf = useCallback((slug) => dishOf(slug)?.categoryId, [dishOf]);
  const categories = menu?.categories ?? [];

  return {
    tickets,
    categories,
    categoryOf,
    dishOf,
    isError: orders.isError && !data,
    /** The last read failed (the tickets shown are from `updatedAt`). */
    failing: orders.isError,
    /** When the tickets were last read (ms since epoch); 0 before the first. */
    updatedAt: orders.dataUpdatedAt,
    isFetching: orders.isFetching,
    refetch: orders.refetch,
  };
}
