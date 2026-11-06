import type {
  AdjustmentReason,
  InventoryUnit,
  StockItem,
  StockStatus,
  WastageReason,
} from '@/types/inventory';

/*
 * Inventory on screen: units, quantities as staff type them, reasons, filters. The server keeps
 * quantities in base units and answers in each ingredient's own unit (restaurant-backend ›
 * inventory/units.ts, whose codes these match).
 */

export const UNITS: Record<
  InventoryUnit,
  { measure: 'mass' | 'volume' | 'count'; factor: number }
> = {
  g: { measure: 'mass', factor: 1 },
  kg: { measure: 'mass', factor: 1000 },
  ml: { measure: 'volume', factor: 1 },
  l: { measure: 'volume', factor: 1000 },
  pc: { measure: 'count', factor: 1 },
  dozen: { measure: 'count', factor: 12 },
};

export const UNIT_CODES = Object.keys(UNITS) as InventoryUnit[];

/** The units a quantity of this ingredient may be typed in (its measure's). */
export const unitsLike = (unit: InventoryUnit): InventoryUnit[] =>
  UNIT_CODES.filter((u) => UNITS[u].measure === UNITS[unit].measure);

export const ADJUSTMENT_REASONS: readonly AdjustmentReason[] = [
  'correction',
  'found',
  'missing',
  'other',
];

export const WASTAGE_REASONS: readonly WastageReason[] = [
  'expired',
  'spoiled',
  'damaged',
  'kitchen_mistake',
  'spilled',
  'guest_return',
  'other',
];

/**
 * A quantity as typed: digits with up to three decimals ("2.5", "0,75"), nothing else. Null when
 * it isn't one (or is empty).
 */
export function parseQuantity(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,3})?$/.test(clean)) return null;
  return Number(clean);
}

/** Money with up to two decimals (₹0.12 a gram): null when it isn't. */
export function parseCost(text: string): number | null {
  const clean = text.trim().replace(/,/g, '');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(clean)) return null;
  return Number(clean);
}

/** A quantity in the branch's way of writing numbers: "2.5", "1,250", "0.417". */
export function formatQuantity(quantity: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(quantity);
}

/** A number for an input (no grouping): 1250 → "1250". */
export const quantityText = (quantity: number): string =>
  quantity === 0 ? '' : String(Math.round(quantity * 1000) / 1000);

export type StockFilter = 'all' | StockStatus;

/** The stock list as filtered: by status, category and a search of names and codes. */
export function filterStock(
  items: readonly StockItem[],
  { status, category, query }: { status: StockFilter; category: string; query: string },
): StockItem[] {
  const q = query.trim().toLowerCase();
  return items.filter(
    (i) =>
      (status === 'all' || i.status === status) &&
      (category === 'all' ||
        (category === 'none' ? i.categoryId === null : i.categoryId === category)) &&
      (!q || i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q)),
  );
}

/** A fresh id for a submission: sending it again (a retry, a double tap) records it once. */
export const newEntryId = (): string => crypto.randomUUID();
