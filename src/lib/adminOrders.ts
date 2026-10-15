import type { CancelReason } from '@/types/admin';
import type { OrderMode } from '@/types/branch';
import type { Price } from '@/types/menu';
import type { Order, OrderRound } from '@/types/order';
import { amountDue } from './lifecycle';
import { isFinished } from './orders';

/*
 * The Orders page's logic, pure: the status views (with the one in the address), the mode
 * filter, search, today's totals and the one action each order needs next.
 */

export type OrderView = 'active' | 'ready' | 'unpaid' | 'completed' | 'cancelled' | 'all';

export const ORDER_VIEWS: readonly OrderView[] = [
  'active',
  'ready',
  'unpaid',
  'completed',
  'cancelled',
  'all',
];

/** The view named in the address (?view=), else Active. */
export const parseView = (value: string | null): OrderView =>
  ORDER_VIEWS.find((view) => view === value) ?? 'active';

export type ModeFilter = 'all' | OrderMode;

export const MODE_FILTERS: readonly ModeFilter[] = ['all', 'dineIn', 'takeaway', 'delivery'];

const isCancelled = (order: Order) => order.status === 'cancelled';

/** Still to pay on an order that isn't cancelled. */
export const dueOn = (order: Order): Price => (isCancelled(order) ? 0 : amountDue(order));

export function inView(order: Order, view: OrderView): boolean {
  switch (view) {
    case 'active':
      return !isFinished(order);
    case 'ready':
      return order.status === 'ready';
    case 'unpaid':
      return dueOn(order) > 0;
    case 'completed':
      return isFinished(order) && !isCancelled(order);
    case 'cancelled':
      return isCancelled(order);
    case 'all':
      return true;
  }
}

const inMode = (order: Order, mode: ModeFilter) => mode === 'all' || order.mode === mode;

/** The order number ("A105" or "105"), the guest's name or the table number. */
function matchesQuery(order: Order, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    order.id.toLowerCase().includes(q) ||
    order.customerName.toLowerCase().includes(q) ||
    (order.table !== undefined && String(order.table) === q)
  );
}

export interface OrderFilters {
  view: OrderView;
  mode: ModeFilter;
  query: string;
}

/** The orders to list, in the order given (newest first). */
export const filterOrders = (orders: readonly Order[], { view, mode, query }: OrderFilters) =>
  orders.filter((o) => inView(o, view) && inMode(o, mode) && matchesQuery(o, query));

/** Orders in each view, within the mode filter and search. */
export function viewCounts(
  orders: readonly Order[],
  filters: Omit<OrderFilters, 'view'>,
): Record<OrderView, number> {
  const scoped = orders.filter((o) => inMode(o, filters.mode) && matchesQuery(o, filters.query));
  return Object.fromEntries(
    ORDER_VIEWS.map((view) => [view, scoped.filter((o) => inView(o, view)).length]),
  ) as Record<OrderView, number>;
}

/** Orders of each mode in the current view (and search). */
export function modeCounts(
  orders: readonly Order[],
  filters: Omit<OrderFilters, 'mode'>,
): Record<ModeFilter, number> {
  const scoped = orders.filter((o) => inView(o, filters.view) && matchesQuery(o, filters.query));
  return Object.fromEntries(
    MODE_FILTERS.map((mode) => [mode, scoped.filter((o) => inMode(o, mode)).length]),
  ) as Record<ModeFilter, number>;
}

/** Today at a glance: orders (not cancelled), their sales, and what's still to collect. */
export function todayTotals(orders: readonly Order[]) {
  const live = orders.filter((o) => !isCancelled(o));
  return {
    count: live.length,
    sales: live.reduce((sum, o) => sum + o.total, 0),
    toCollect: live.reduce((sum, o) => sum + dueOn(o), 0),
  };
}

/** The one thing an order needs from staff now, if anything. */
export type OrderAction = 'serve' | 'handOver' | 'collect';

export function nextAction(order: Order): OrderAction | null {
  if (order.status === 'ready') return order.mode === 'takeaway' ? 'handOver' : 'serve';
  if (isFinished(order) && dueOn(order) > 0) return 'collect';
  return null;
}

/** Why the restaurant may cancel an order, in the order staff are offered them. */
export const CANCEL_REASONS: readonly CancelReason[] = [
  'outOfStock',
  'guestLeft',
  'kitchenIssue',
  'duplicate',
  'other',
];

/**
 * The round a waiter can still change: the latest one not cancelled, while the kitchen hasn't
 * finished it (received or preparing). An order without rounds is one round. Dine-in only.
 */
export function editableRound(
  order: Order,
): Pick<OrderRound, 'number' | 'items' | 'kitchenNote'> | null {
  if (order.mode !== 'dineIn') return null;
  const rounds = order.rounds ?? [
    { number: 1, status: order.status, items: order.items, kitchenNote: order.kitchenNote },
  ];
  const latest = rounds.filter((r) => r.status !== 'cancelled').at(-1);
  return latest && (latest.status === 'received' || latest.status === 'preparing') ? latest : null;
}
