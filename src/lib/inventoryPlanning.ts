import { UNITS } from '@/lib/inventory';
import type { StockItem, UsageRow } from '@/types/inventory';
import type { Supplier, SupplierItemView } from '@/types/purchasing';

/*
 * Planning ahead with stock: how many days an item lasts at the rate it's used, and the orders
 * that would fill what's low (each item from one supplier, in whole packs). Pure, so it's
 * unit-tested; the screens word it.
 */

/** Days of use the rate is taken over. */
export const RATE_DAYS = 14;
/** Days left at or below this: running out soon (amber); one day or less: red. */
export const SOON_DAYS = 3;
/** Beyond this many days, days left isn't worth saying. */
export const SHOW_DAYS = 14;

/**
 * Days an item lasts at the rate it was used over `periodDays` (none when nothing was used, or
 * nothing is left: out says it already).
 */
export function daysLeft(onHand: number, used: number, periodDays = RATE_DAYS) {
  if (used <= 0 || onHand <= 0 || periodDays <= 0) return undefined;
  return onHand / (used / periodDays);
}

/** Each tracked item's days left, from the usage report of the last RATE_DAYS days. */
export function daysLeftById(
  items: readonly StockItem[],
  rows: readonly UsageRow[],
  periodDays = RATE_DAYS,
): Map<string, number> {
  const used = new Map(rows.map((r) => [r.ingredientId, r.quantity.actual]));
  const result = new Map<string, number>();
  for (const item of items) {
    const left = daysLeft(item.onHand, used.get(item.ingredientId) ?? 0, periodDays);
    if (left !== undefined) result.set(item.ingredientId, left);
  }
  return result;
}

/** Items that will run out within SOON_DAYS but aren't low or out yet (Today's early warning). */
export const runningOutSoon = (items: readonly StockItem[], left: ReadonlyMap<string, number>) =>
  items.filter((i) => i.status === 'ok' && (left.get(i.ingredientId) ?? Infinity) <= SOON_DAYS);

/* ---------- Ready orders ---------- */

/** A pack's size in the ingredient's own unit (a 500 g pack of an item kept in kg: 0.5). */
export const packInUnit = (pack: SupplierItemView['pack'], unit: StockItem['unit']) =>
  (pack.size * UNITS[pack.unit].factor) / UNITS[unit].factor;

/**
 * Whole packs to fill the shelf: up to "order up to" (or twice "warn at"), only once stock is at
 * or below "warn at", at least one. The server's own rule (purchasing-rules › suggestPacks).
 */
export function packsToOrder(
  level: Pick<StockItem, 'onHand' | 'reorderLevel' | 'parLevel'>,
  packSize: number,
): number {
  if (level.reorderLevel <= 0 || level.onHand > level.reorderLevel || packSize <= 0) return 0;
  const target = level.parLevel > 0 ? level.parLevel : level.reorderLevel * 2;
  return Math.max(1, Math.ceil((target - level.onHand) / packSize - 1e-9));
}

export interface ReadyLine {
  item: StockItem;
  packs: number;
  pack: SupplierItemView['pack'];
  /** One pack's price (last paid), when known. */
  price?: number;
}

export interface ReadyOrder {
  supplier: Supplier;
  lines: ReadyLine[];
  /** What the known prices come to. */
  total: number;
}

export interface ReadyOrders {
  orders: ReadyOrder[];
  /** Low or out, but no supplier sells it here. */
  noSupplier: StockItem[];
  /** Out, but with no "warn at" level there's no amount to suggest. */
  noLevel: StockItem[];
}

/**
 * The orders that would fill what's low: each low item from one supplier (the one marked
 * preferred, else the cheapest for the amount, else the first), in whole packs; and what can't
 * be ordered this way.
 */
export function readyOrders(
  items: readonly StockItem[],
  suppliers: readonly Supplier[],
): ReadyOrders {
  const bySupplier = new Map<string, ReadyOrder>();
  const noSupplier: StockItem[] = [];
  const noLevel: StockItem[] = [];
  for (const item of items) {
    if (item.reorderLevel <= 0) {
      if (item.status === 'out') noLevel.push(item);
      continue;
    }
    if (item.onHand > item.reorderLevel) continue;
    const offers = suppliers.flatMap((supplier) =>
      supplier.items
        .filter((i) => i.ingredientId === item.ingredientId)
        .map((offer) => ({ supplier, offer, size: packInUnit(offer.pack, item.unit) })),
    );
    if (offers.length === 0) {
      noSupplier.push(item);
      continue;
    }
    const perUnit = (o: (typeof offers)[number]) =>
      o.offer.price !== undefined && o.size > 0 ? o.offer.price / o.size : Infinity;
    const best =
      offers.find((o) => o.offer.preferred) ??
      [...offers].sort((a, b) => perUnit(a) - perUnit(b))[0];
    if (!best) continue;
    const packs = packsToOrder(item, best.size);
    if (packs === 0) continue;
    const order = bySupplier.get(best.supplier.id) ?? {
      supplier: best.supplier,
      lines: [],
      total: 0,
    };
    order.lines.push({
      item,
      packs,
      pack: best.offer.pack,
      ...(best.offer.price !== undefined ? { price: best.offer.price } : {}),
    });
    order.total = Math.round((order.total + packs * (best.offer.price ?? 0)) * 100) / 100;
    bySupplier.set(best.supplier.id, order);
  }
  return {
    orders: [...bySupplier.values()].sort((a, b) => b.lines.length - a.lines.length),
    noSupplier,
    noLevel,
  };
}
