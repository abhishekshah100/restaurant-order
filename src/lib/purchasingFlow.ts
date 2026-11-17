import type { StockItem } from '@/types/inventory';
import type { PoStatus, PurchaseOrder, SupplierItemView } from '@/types/purchasing';
import { packInUnit, packsToOrder } from './inventoryPlanning';

/*
 * A purchase order's way through: where it is (placed, sent, arrived), the one thing to do next
 * for whoever is looking, the list's views and search, and what to order of a supplier's items
 * that are low. Pure, so it's unit-tested.
 */

/** The list's views: what needs doing (approve or send), what's on its way, what's over. */
export type OrderView = 'todo' | 'waiting' | 'done' | 'all';
export const ORDER_VIEWS: readonly OrderView[] = ['todo', 'waiting', 'done', 'all'];

const IN_VIEW: Record<Exclude<OrderView, 'all'>, readonly PoStatus[]> = {
  todo: ['draft', 'approved'],
  waiting: ['sent', 'partly_received'],
  done: ['received', 'closed', 'cancelled'],
};

export const inView = (order: Pick<PurchaseOrder, 'status'>, view: OrderView) =>
  view === 'all' || IN_VIEW[view].includes(order.status);

/** How many orders each view holds. */
export const viewCounts = (orders: readonly Pick<PurchaseOrder, 'status'>[]) =>
  Object.fromEntries(
    ORDER_VIEWS.map((v) => [v, orders.filter((o) => inView(o, v)).length]),
  ) as Record<OrderView, number>;

/** "PO-0007", "7", "po7" or part of the supplier's name. */
export function matchesOrder(order: Pick<PurchaseOrder, 'number' | 'supplier'>, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/^po-?0*/, '');
  return (
    order.supplier.name.toLowerCase().includes(q) ||
    (/^\d+$/.test(digits) && String(order.number) === digits)
  );
}

/** The three steps an order shows: placed (and approved), sent, arrived. */
export const ORDER_STEPS = ['placed', 'sent', 'arrived'] as const;
export type OrderStep = (typeof ORDER_STEPS)[number];

/**
 * How far along it is: the steps done (0–3), and whether the step it's on is waiting on someone
 * (approval, sending). Cancelled orders are stopped where they were.
 */
export function progressOf(status: PoStatus): { done: number; stopped: boolean } {
  switch (status) {
    case 'draft':
      return { done: 0, stopped: false };
    case 'approved':
      return { done: 1, stopped: false };
    case 'sent':
      return { done: 2, stopped: false };
    case 'partly_received':
      return { done: 2, stopped: false };
    case 'received':
    case 'closed':
      return { done: 3, stopped: false };
    case 'cancelled':
      return { done: 0, stopped: true };
  }
}

export type NextAction = 'approve' | 'send' | 'receive';

/** The one thing to do next with an order, for someone who may do it; none when it's over. */
export function nextAction(
  order: Pick<PurchaseOrder, 'status'>,
  may: { approve: boolean; manage: boolean; receive: boolean },
): NextAction | undefined {
  if (order.status === 'draft') return may.approve ? 'approve' : undefined;
  if (order.status === 'approved') return may.manage ? 'send' : undefined;
  if (order.status === 'sent' || order.status === 'partly_received') {
    return may.receive ? 'receive' : undefined;
  }
  return undefined;
}

/**
 * How many of each of a supplier's items to order now: whole packs up to "order up to", for
 * those at or below "warn at"; items not low aren't listed.
 */
export function lowSuggestions(
  items: readonly SupplierItemView[],
  stock: readonly Pick<
    StockItem,
    'ingredientId' | 'onHand' | 'reorderLevel' | 'parLevel' | 'unit'
  >[],
): Map<string, number> {
  const levels = new Map(stock.map((s) => [s.ingredientId, s]));
  const out = new Map<string, number>();
  for (const item of items) {
    const level = levels.get(item.ingredientId);
    if (!level) continue;
    const packs = packsToOrder(level, packInUnit(item.pack, level.unit));
    if (packs > 0) out.set(item.ingredientId, packs);
  }
  return out;
}

/** An order's item, as an existing order holds it. */
interface HeldLine {
  ingredientId: string;
  pack: { name: string; size: number; unit: StockItem['unit'] };
  quantity: number;
  price?: number;
}

/** What an ingredient can be counted in: its packs, by id. */
interface Countable {
  id: string;
  unit: StockItem['unit'];
  packs: readonly { id: string; name: string; quantity: number }[];
}

/** An item to change by hand: its pack ("pack:<id>", a unit, or "" for its own unit). */
export interface EditableExtra {
  ingredientId: string;
  measure: string;
  quantity: number;
  price?: number;
}

const samePack = (a: HeldLine['pack'], b: HeldLine['pack']) =>
  a.name === b.name && Math.abs(a.size - b.size) < 1e-9;

/**
 * An order opened to change it, item by item, without changing what was ordered: in the
 * supplier's usual pack, it's on their list (how many, and its price); in another pack the
 * ingredient has, or one of its units, it's an item by hand in that pack; in a pack it no longer
 * has, an item by hand in its own unit, the amount kept (2 × 25 kg sacks: 50 kg). The price stays
 * with the pack it was for, so a converted one is left for staff to type.
 */
export function editableLines(
  lines: readonly HeldLine[],
  catalog: readonly Pick<SupplierItemView, 'ingredientId' | 'pack'>[],
  ingredients: readonly Countable[],
): {
  listed: { ingredientId: string; quantity: number; price?: number }[];
  extras: EditableExtra[];
} {
  const usual = new Map(catalog.map((i) => [i.ingredientId, i.pack]));
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const listed: { ingredientId: string; quantity: number; price?: number }[] = [];
  const extras: EditableExtra[] = [];
  for (const line of lines) {
    const price = line.price !== undefined ? { price: line.price } : {};
    const pack = usual.get(line.ingredientId);
    if (pack && samePack(pack, line.pack)) {
      listed.push({ ingredientId: line.ingredientId, quantity: line.quantity, ...price });
      continue;
    }
    const ingredient = byId.get(line.ingredientId);
    const known = ingredient?.packs.find(
      (p) => p.name === line.pack.name && Math.abs(p.quantity - line.pack.size) < 1e-9,
    );
    if (known) {
      extras.push({
        ingredientId: line.ingredientId,
        measure: `pack:${known.id}`,
        quantity: line.quantity,
        ...price,
      });
    } else if (line.pack.size === 1 && line.pack.name === line.pack.unit) {
      // Counted in a unit (kg, L…): the ingredient's own is "".
      const measure = ingredient && ingredient.unit === line.pack.unit ? '' : line.pack.unit;
      extras.push({ ingredientId: line.ingredientId, measure, quantity: line.quantity, ...price });
    } else {
      const unit = ingredient?.unit ?? line.pack.unit;
      extras.push({
        ingredientId: line.ingredientId,
        measure: '',
        quantity: Math.round(line.quantity * packInUnit(line.pack, unit) * 1000) / 1000,
      });
    }
  }
  return { listed, extras };
}
