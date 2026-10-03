'use client';

import { useMemo, useState } from 'react';
import { useOrderHistory } from '@/api/hooks';
import { useGuestSession } from '@/context/GuestSessionContext';
import { useOrders } from '@/context/OrdersContext';
import { useTable } from '@/hooks/useTable';
import { allOrders } from '@/lib/orders';
import { latestOwnOrder, tableOrders } from '@/lib/service';
import type { Order } from '@/types/order';

interface TableOrders {
  table: number;
  /** This guest's session id: decides which orders are "mine" (see lib/orders › isOwnOrder). */
  sessionId: string | undefined;
  /** This visit's orders at the table, newest first (empty until hydrated). */
  orders: Order[];
  /** This guest session's latest order today. */
  latest: Order | undefined;
  hydrated: boolean;
}

/** Orders at the current table today: placed on this device plus the order history. */
export function useTableOrders(): TableOrders {
  const table = useTable();
  const sessionId = useGuestSession()?.id;
  const { placed, hydrated: ordersHydrated } = useOrders();
  const history = useOrderHistory();
  // "Today" is fixed when the screen opens; only read once orders have hydrated on the client.
  const [now] = useState(() => Date.now());
  const hydrated = ordersHydrated && sessionId !== undefined;
  return useMemo(() => {
    if (!hydrated) return { table, sessionId, orders: [], latest: undefined, hydrated };
    const all = allOrders(placed, history);
    return {
      table,
      sessionId,
      orders: tableOrders(all, table, now),
      latest: latestOwnOrder(all, table, now, sessionId),
      hydrated,
    };
  }, [table, sessionId, placed, history, hydrated, now]);
}
