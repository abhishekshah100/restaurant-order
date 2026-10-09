import { createClock } from '@/lib/clock';
import type { Branch } from '@/types/branch';
import type { ApiOrder, Order, OrderHistory, OrdersResponse } from '@/types/order';

/*
 * Response → app-model conversions. Keep API quirks here so the rest of the app only sees
 * its own types.
 */

/**
 * An order with a real ISO `placedAt` and its mode. A `placedAt` from the API is passed through
 * untouched; a relative mock time is dated on the branch's day, in its time zone. Orders from
 * before order modes were dine-in.
 */
export function toOrder(raw: ApiOrder, branch: Branch, now: Date = new Date()): Order {
  const mode = raw.mode ?? 'dineIn';
  if (raw.placedAt !== null) {
    const { placedRelative: _none, ...order } = raw;
    return { ...order, mode, placedAt: raw.placedAt };
  }
  const { placedRelative, ...order } = raw;
  const { daysAgo, time } = placedRelative;
  return { ...order, mode, placedAt: createClock(branch).localTimestamp(daysAgo, time, now) };
}

/** GET /orders as one branch sees it: its own history, dated against `now` (default: the current time). */
export function toOrderHistory(
  raw: OrdersResponse,
  branch: Branch,
  now: Date = new Date(),
): OrderHistory {
  return {
    history: raw.history
      .filter((o) => o.branchId === branch.id)
      .map((o) => toOrder(o, branch, now)),
  };
}
