import type { ApiOrder, Order, OrderHistory, OrdersResponse } from '@/types/order';

/*
 * Response → app-model conversions. Keep API quirks here so the rest of the app only sees
 * its own types.
 */

const istDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DAY_MS = 86_400_000;

/** `daysAgo` restaurant days (IST) before `now`, at 24-hour "HH:MM": "2026-10-03T19:42:00+05:30". */
function istTimestamp(daysAgo: number, time: string, now: Date): string {
  return `${istDay.format(new Date(now.getTime() - daysAgo * DAY_MS))}T${time}:00+05:30`;
}

/** An order with a real ISO `placedAt`. A `placedAt` from the API is passed through untouched. */
export function toOrder(raw: ApiOrder, now: Date = new Date()): Order {
  if (raw.placedAt !== null) return raw;
  const { placedRelative, ...order } = raw;
  return { ...order, placedAt: istTimestamp(placedRelative.daysAgo, placedRelative.time, now) };
}

/** GET /orders as the app uses it. Dates relative orders against `now` (default: the current time). */
export function toOrderHistory(raw: OrdersResponse, now: Date = new Date()): OrderHistory {
  return { history: raw.history.map((o) => toOrder(o, now)), newOrderIds: raw.newOrderIds };
}
