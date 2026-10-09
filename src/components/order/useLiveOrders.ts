'use client';

import { useBranch, useOrder, useSessionOrders } from '@/api/hooks';
import { useGuestSession } from '@/context/GuestSessionContext';
import type { Order } from '@/types/order';

export type OrderLookup =
  | { state: 'loading' }
  | { state: 'missing' }
  /** `now`: when the server reported this status. `live`: it's still being polled. */
  | { state: 'found'; order: Order; now: Date; live: boolean };

/**
 * One order by id (GET /orders/:id) with its live status, polled every 30 s while the kitchen
 * moves it. An order from another branch than the guest's isn't shown here. `id` is undefined
 * while it isn't known yet (loading) and null when there's none (missing).
 */
export function useLiveOrder(id: string | null | undefined): OrderLookup {
  const session = useGuestSession();
  const branch = useBranch();
  const { data: order, isError, dataUpdatedAt } = useOrder(id ?? undefined);
  if (id === null) return { state: 'missing' };
  // Wait for the session too: until then the active branch is only the default one.
  if (id === undefined || !session || (!order && !isError)) return { state: 'loading' };
  if (!order || order.branchId !== branch.id) return { state: 'missing' };
  return { state: 'found', order, now: new Date(dataUpdatedAt), live: Boolean(order.live) };
}

/** The guest's orders (GET /sessions/:id/orders), newest first, polled while any is live. */
export function useLiveOrderList(): { orders: Order[]; now: Date } | null {
  const { data, dataUpdatedAt } = useSessionOrders(useGuestSession()?.id);
  return data ? { orders: data.orders, now: new Date(dataUpdatedAt) } : null;
}
