import type { OrderLineRequest } from '@/api/contracts';
import type { CartLine, LineConfig } from '@/types/cart';
import type { Dish, Price } from '@/types/menu';
import { defaultConfig, lineKey, orderLine, unitPrice } from './cartLine';
import { groupsFor } from './options';

/*
 * The waiter's order pad, pure: the lines a waiter builds at the table (each a dish with its
 * choices and a quantity), what they come to, and the request they become. Lines are keyed like
 * the cart's (lib/cartLine), so the same dish with the same choices adds up.
 */

export type PadLines = readonly CartLine[];

/** A dish the waiter has to make choices for (a size, a spice level…) before adding it. */
export const hasChoices = (dish: Dish) =>
  Boolean(dish.variants?.length) || groupsFor(dish, dish.variants?.[0]?.id).length > 0;

/** The lines with `quantity` more of this configuration (a new line if it's not there yet). */
export function addLine(lines: PadLines, dish: Dish, config: LineConfig, quantity = 1): CartLine[] {
  const key = lineKey(config);
  if (lines.some((l) => l.key === key)) {
    return lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + quantity } : l));
  }
  return [...lines, { ...config, key, quantity, unitPrice: unitPrice(dish, config) }];
}

/** The lines with this one at `quantity`; 0 takes it off. */
export function setQuantity(lines: PadLines, key: string, quantity: number): CartLine[] {
  return quantity > 0
    ? lines.map((l) => (l.key === key ? { ...l, quantity } : l))
    : lines.filter((l) => l.key !== key);
}

/** The line of a dish without choices, as the pad adds it (one per dish). */
export const plainKey = (dish: Dish) => lineKey(defaultConfig(dish));

/** How many of a dish are on the pad, whatever was chosen. */
export const dishCount = (lines: PadLines, slug: string) =>
  lines.filter((l) => l.dishSlug === slug).reduce((n, l) => n + l.quantity, 0);

/** Items and their total at menu prices (the server applies offers and taxes). */
export function padTotals(lines: PadLines): { items: number; total: Price } {
  return lines.reduce(
    (sum, l) => ({ items: sum.items + l.quantity, total: sum.total + l.unitPrice * l.quantity }),
    { items: 0, total: 0 },
  );
}

/** The lines as the server takes them. */
export const padRequest = (lines: PadLines): OrderLineRequest[] => lines.map(orderLine);
