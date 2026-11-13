import { describe, expect, it } from 'vitest';
import {
  daysLeft,
  daysLeftById,
  packInUnit,
  packsToOrder,
  readyOrders,
  runningOutSoon,
} from '@/lib/inventoryPlanning';
import type { StockItem, UsageRow } from '@/types/inventory';
import type { Supplier } from '@/types/purchasing';

/* Planning ahead: days left at the rate used, and orders that fill what's low. */

const item = (id: string, extra: Partial<StockItem> = {}): StockItem => ({
  ingredientId: id,
  name: id,
  categoryId: null,
  unit: 'kg',
  onHand: 10,
  reorderLevel: 4,
  parLevel: 12,
  status: 'ok',
  openingDue: false,
  ...extra,
});
const usage = (id: string, actual: number) =>
  ({ ingredientId: id, quantity: { actual } }) as unknown as UsageRow;

describe('days left', () => {
  it('lasts what is left at the rate used over the last 14 days', () => {
    expect(daysLeft(6, 28)).toBe(3);
    expect(daysLeft(6, 0)).toBeUndefined();
    expect(daysLeft(0, 28)).toBeUndefined();
    const items = [item('onion', { onHand: 4 }), item('rice', { onHand: 40 }), item('salt')];
    const left = daysLeftById(items, [usage('onion', 28), usage('rice', 14)]);
    expect([...left]).toEqual([
      ['onion', 2],
      ['rice', 40],
    ]);
    // Only what isn't low or out yet: those already say so.
    const low = item('ghee', { onHand: 1, status: 'low' });
    expect(
      runningOutSoon([...items, low], new Map([...left, ['ghee', 1]])).map((i) => i.name),
    ).toEqual(['onion']);
  });
});

describe('ready orders', () => {
  const offer = (ingredientId: string, size: number, price?: number, extra = {}) => ({
    ingredientId,
    name: ingredientId,
    pack: { name: 'bag', size, unit: 'kg' as const },
    ...(price !== undefined ? { price } : {}),
    preferred: false,
    ...extra,
  });
  const supplier = (id: string, items: ReturnType<typeof offer>[]) =>
    ({ id, name: id, items, openOrders: 0 }) as Supplier;

  it('fills to "order up to" (else twice "warn at") in whole packs, only once low', () => {
    expect(packsToOrder({ onHand: 3, reorderLevel: 4, parLevel: 12 }, 5)).toBe(2);
    expect(packsToOrder({ onHand: 3, reorderLevel: 4, parLevel: 0 }, 1)).toBe(5);
    expect(packsToOrder({ onHand: 5, reorderLevel: 4, parLevel: 12 }, 5)).toBe(0);
    expect(packsToOrder({ onHand: 3.9, reorderLevel: 4, parLevel: 4 }, 25)).toBe(1);
    expect(packInUnit({ name: 'pack', size: 500, unit: 'g' }, 'kg')).toBe(0.5);
  });

  it('orders each low item once, from the preferred or cheapest supplier', () => {
    const paneer = item('paneer', { onHand: 1, status: 'low' });
    const milk = item('milk', {
      onHand: 0,
      status: 'out',
      unit: 'l',
      reorderLevel: 10,
      parLevel: 30,
    });
    const rice = item('rice', { onHand: 2, status: 'low' });
    const saffron = item('saffron', { onHand: 0, status: 'out', reorderLevel: 0 });
    const onion = item('onion', { onHand: 20 });
    const dairyA = supplier('Dairy A', [offer('paneer', 1, 400), offer('milk', 12, 600)]);
    const dairyB = supplier('Dairy B', [offer('paneer', 1, 380)]);
    const grains = supplier('Grains', [
      offer('rice', 25, 2000, { preferred: true }),
      offer('onion', 25, 700),
    ]);
    const other = supplier('Other', [offer('rice', 10, 500)]);
    const ready = readyOrders(
      [paneer, milk, rice, saffron, onion, item('cream', { onHand: 0, status: 'out' })],
      [dairyA, dairyB, grains, other],
    );
    expect(
      ready.orders.map((o) => [o.supplier.id, o.lines.map((l) => [l.item.name, l.packs]), o.total]),
    ).toEqual([
      // Paneer is cheaper at Dairy B. Milk: 30 L − 0 in crates of 12 → 3.
      ['Dairy B', [['paneer', 11]], 4180],
      ['Dairy A', [['milk', 3]], 1800],
      // Rice from the preferred supplier, though another is cheaper per kg.
      ['Grains', [['rice', 1]], 2000],
    ]);
    expect(ready.noSupplier.map((i) => i.name)).toEqual(['cream']);
    expect(ready.noLevel.map((i) => i.name)).toEqual(['saffron']);
  });
});
