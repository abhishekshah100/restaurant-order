'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOrderHistory } from '@/api/hooks';
import { useOrders } from '@/context/OrdersContext';
import { TRACK_REFRESH_MS, findOrder, isFinished, myOrders, simulateOrder } from '@/lib/orders';
import type { Order } from '@/types/order';

/**
 * The current time: null until mounted (so prerendered markup never shows a stale time),
 * then refreshed every 30s while `ticking`.
 */
function useNow(ticking: boolean): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const id = ticking ? window.setInterval(tick, TRACK_REFRESH_MS) : undefined;
    // Background tabs throttle timers: refresh as soon as the guest comes back.
    const onVisible = () => {
      if (ticking && document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ticking]);
  return now;
}

/** Orders placed on this device move along the simulated kitchen; drawn mock orders keep their status. */
function live(order: Order, placed: readonly Order[], now: Date): Order {
  return placed.some((o) => o.id === order.id) ? simulateOrder(order, now) : order;
}

const isLive = (order: Order, placed: readonly Order[]) =>
  placed.some((o) => o.id === order.id) && !isFinished(order);

export type OrderLookup =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'found'; order: Order; now: Date; live: boolean };

/** One order by id, live-updated while it's being made. */
export function useLiveOrder(id: string): OrderLookup {
  const { placed, hydrated } = useOrders();
  const history = useOrderHistory();
  const raw = hydrated ? findOrder(id, placed, history) : undefined;
  // Tick while the order (as last computed) is still moving; the first tick sets the time.
  const [ticking, setTicking] = useState(false);
  const now = useNow(ticking);
  const order = raw && now ? live(raw, placed, now) : undefined;
  const isTicking = order ? isLive(order, placed) : false;
  if (isTicking !== ticking) setTicking(isTicking);

  if (!hydrated || !now) return { state: 'loading' };
  if (!order) return { state: 'missing' };
  return { state: 'found', order, now, live: isTicking };
}

/** The guest's orders (this device + order history), newest first, live-updated. */
export function useLiveOrderList(): { orders: Order[]; now: Date } | null {
  const { placed, hydrated } = useOrders();
  const history = useOrderHistory();
  const [ticking, setTicking] = useState(false);
  const now = useNow(ticking);
  const orders = useMemo(
    () => (hydrated && now ? myOrders(placed, history).map((o) => live(o, placed, now)) : null),
    [hydrated, now, placed, history],
  );
  const anyLive = orders?.some((o) => isLive(o, placed)) ?? false;
  if (anyLive !== ticking) setTicking(anyLive);
  return orders && now ? { orders, now } : null;
}
