import type { StockItem } from '@/types/inventory';
import type { PriceChange, PurchaseOrder, Supplier } from '@/types/purchasing';

/*
 * Purchasing › Today: how far setting up has got, and what needs someone now. Pure (data and
 * the branch's today passed in), so it's unit-tested.
 */

export type SetupStep = 'ingredients' | 'supplier' | 'items' | 'order';

export interface SetupProgress {
  steps: { id: SetupStep; done: boolean }[];
  /** The first step not done; none once everything is. */
  next?: SetupStep;
  doneCount: number;
}

/**
 * The four steps before buying runs by itself: ingredients to buy (Inventory), a supplier, what
 * they sell, a first order. `ingredients` is unknown (null) to staff who can't see stock: it
 * counts as done for them.
 */
export function setupProgress(input: {
  ingredients: number | null;
  suppliers: readonly Supplier[];
  orders: readonly PurchaseOrder[];
}): SetupProgress {
  const steps: { id: SetupStep; done: boolean }[] = [
    { id: 'ingredients', done: input.ingredients === null || input.ingredients > 0 },
    { id: 'supplier', done: input.suppliers.length > 0 },
    { id: 'items', done: input.suppliers.some((s) => s.items.length > 0) },
    { id: 'order', done: input.orders.length > 0 },
  ];
  const next = steps.find((s) => !s.done)?.id;
  return { steps, ...(next ? { next } : {}), doneCount: steps.filter((s) => s.done).length };
}

/** Orders still to come in (approved or sent, or part come). */
const COMING = new Set(['approved', 'sent', 'partly_received']);

export interface TodayWork {
  /** Waiting for someone to approve them. */
  toApprove: PurchaseOrder[];
  /** Approved but not sent to the supplier yet. */
  toSend: PurchaseOrder[];
  /** Expected today, or earlier and not fully in: to receive. */
  arriving: PurchaseOrder[];
  /** Of those, expected before today. */
  late: number;
  /** Delivered prices to confirm, or far above what was expected. */
  pricesToCheck: PriceChange[];
}

/** What needs someone today, oldest first. */
export function todayWork(
  orders: readonly PurchaseOrder[],
  prices: readonly PriceChange[],
  today: string,
): TodayWork {
  const oldest = (a: PurchaseOrder, b: PurchaseOrder) => a.number - b.number;
  const arriving = orders
    .filter((o) => COMING.has(o.status) && o.expectedOn !== undefined && o.expectedOn <= today)
    .sort((a, b) => (a.expectedOn ?? '').localeCompare(b.expectedOn ?? '') || oldest(a, b));
  return {
    toApprove: orders.filter((o) => o.status === 'draft' && o.needsApproval).sort(oldest),
    toSend: orders.filter((o) => o.status === 'approved').sort(oldest),
    arriving,
    late: arriving.filter((o) => (o.expectedOn ?? today) < today).length,
    pricesToCheck: prices.filter((p) => p.pricePending || p.flagged),
  };
}

/** How many ingredients are low or out (at or under their "warn at" level). */
export const lowCount = (items: readonly StockItem[]) =>
  items.filter((i) => i.reorderLevel > 0 && i.onHand <= i.reorderLevel).length;
