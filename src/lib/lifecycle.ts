import type { LineConfig } from '@/types/cart';
import type { Dish, Price } from '@/types/menu';
import type { Order, OrderItem, OrderRound } from '@/types/order';
import { defaultConfig, isValidConfig } from './cartLine';
import { isAvailable, type MenuCatalog } from './menu';
import { normaliseConfig } from './options';
import { isOwnOrder } from './orders';

/*
 * After an order is placed: its rounds (a dine-in running order), the window in which the guest
 * can change or cancel it, what's been paid and is still due, and ordering it again. The server
 * applies the same rules (api/mock/handlers/orderChanges); data comes in as arguments.
 */

/* ---------- Rounds ---------- */

/** The rounds still on the order (not cancelled), oldest first; none on the drawn history. */
export const activeRounds = (order: Pick<Order, 'rounds'>): OrderRound[] =>
  (order.rounds ?? []).filter((r) => r.status !== 'cancelled');

/** The round a change or cancellation applies to: the latest one still on the order. */
export function latestRound(order: Pick<Order, 'rounds'>): OrderRound | undefined {
  const rounds = activeRounds(order);
  return rounds[rounds.length - 1];
}

/** A running order that has had more than one round (cancelled ones too): shown round by round. */
export const hasRounds = (order: Pick<Order, 'rounds'>) => (order.rounds?.length ?? 0) > 1;

/**
 * The guest's running dine-in order in this session (the newest), which their next round
 * goes on without a new checkout; null when they haven't ordered at this table yet.
 */
export function openTab(orders: readonly Order[], sessionId: string | undefined): Order | null {
  return (
    orders.find(
      (o) => isOwnOrder(o, sessionId) && o.mode === 'dineIn' && o.status !== 'cancelled',
    ) ?? null
  );
}

/* ---------- Change / cancel window ---------- */

export type ChangeWindow =
  /** The latest round can still be changed or cancelled, until `closesAt` (epoch ms). */
  | { open: true; round: OrderRound; closesAt: number }
  /** Too late: the kitchen has started on it, or the window has passed. */
  | { open: false; round: OrderRound; reason: 'started' | 'expired' };

/**
 * Whether the guest can still change or cancel the order's latest round at `now` (epoch ms):
 * while the kitchen hasn't started on it and within the branch's window
 * (`ordering.cancelWindowSeconds`). Null for cancelled orders and for orders that never could
 * be (the drawn history).
 */
export function changeWindow(
  order: Pick<Order, 'rounds' | 'status'>,
  now: number,
): ChangeWindow | null {
  const round = latestRound(order);
  if (order.status === 'cancelled' || !round) return null;
  const closesAt = Date.parse(round.changeableUntil);
  if (round.status !== 'received') return { open: false, round, reason: 'started' };
  if (!(now < closesAt)) return { open: false, round, reason: 'expired' };
  return { open: true, round, closesAt };
}

/* ---------- Payment ---------- */

/** What has been paid for the order so far (a running order can be paid in part). */
export function paidAmount({ payment, total }: Pick<Order, 'payment' | 'total'>): Price {
  if (payment.paid !== undefined) return payment.paid;
  return payment.status === 'paid' ? total : 0;
}

/** What is still to pay for the order: nothing once it's paid or cancelled. */
export const amountDue = (order: Pick<Order, 'payment' | 'total' | 'status'>): Price =>
  order.status === 'cancelled' ? 0 : Math.max(0, order.total - paidAmount(order));

/* ---------- Order again ---------- */

/** One cart line to add when ordering again: the dish as on today's menu, and how many. */
export interface ReorderLine {
  dish: Dish;
  config: LineConfig;
  quantity: number;
}

/** The size an item recorded only by name ("Full") was ordered in. */
const variantNamed = (dish: Dish, name: string | undefined) =>
  dish.variants?.find((v) => v.name.split(' · ')[0] === name)?.id;

/**
 * The configuration an item was ordered with, made consistent with today's menu (choices no
 * longer offered fall back to the default); null when its size isn't offered any more.
 */
function itemConfig(item: OrderItem, dish: Dish): LineConfig | null {
  const fallback = defaultConfig(dish);
  const recorded: LineConfig = item.config
    ? { ...item.config, dishSlug: dish.slug }
    : { ...fallback, variantId: variantNamed(dish, item.variant) ?? fallback.variantId };
  const variant = dish.variants?.find((v) => v.id === recorded.variantId);
  if (dish.variants?.length && (!variant || variant.available === false)) return null;
  const config = normaliseConfig(dish, recorded);
  return isValidConfig(dish, config) ? config : null;
}

/**
 * An order's items as cart lines on today's menu: the same size, choices, add-ons, removals and
 * instructions, priced by the cart from the current menu. Items that can't be ordered now (not
 * on this menu, sold out, unavailable today, or their size gone) are skipped and named.
 */
export function reorderLines(
  items: readonly OrderItem[],
  menu: MenuCatalog,
): { lines: ReorderLine[]; skipped: string[] } {
  const lines: ReorderLine[] = [];
  const skipped = new Set<string>();
  for (const item of items) {
    const dish = menu.getDish(item.dishSlug);
    const config = dish && isAvailable(dish) ? itemConfig(item, dish) : null;
    if (dish && config) lines.push({ dish, config, quantity: item.quantity });
    else skipped.add(item.name);
  }
  return { lines, skipped: [...skipped] };
}
