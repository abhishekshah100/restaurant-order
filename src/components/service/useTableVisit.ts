'use client';

import { useBranch, useTableOrders } from '@/api/hooks';
import { useGuestSession } from '@/context/GuestSessionContext';
import { useTable } from '@/hooks/useTable';
import { isOwnOrder } from '@/lib/orders';
import type { Order } from '@/types/order';

interface TableVisit {
  table: number;
  /** This guest's session id: decides which orders are "mine" (see lib/orders › isOwnOrder). */
  sessionId: string | undefined;
  /** This visit's orders at the table, newest first (empty until loaded). */
  orders: Order[];
  /** This guest session's latest order today. */
  latest: Order | undefined;
  hydrated: boolean;
}

const NO_ORDERS: Order[] = [];

/** This visit's orders at the current table (GET /tables/:branchId/:table/orders), for the bill. */
export function useTableVisit(): TableVisit {
  const table = useTable();
  const { id: branchId } = useBranch();
  const session = useGuestSession();
  const sessionId = session?.id;
  // Read once the session (and so the guest's branch and table) is known; only at a table.
  const { data } = useTableOrders(branchId, table, session?.mode === 'dineIn');
  const orders = data?.orders ?? NO_ORDERS;
  return {
    table,
    sessionId,
    orders,
    latest: orders.find((o) => isOwnOrder(o, sessionId)),
    hydrated: data !== undefined && sessionId !== undefined,
  };
}
