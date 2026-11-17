import { describe, expect, it } from 'vitest';
import {
  editableLines,
  inView,
  lowSuggestions,
  matchesOrder,
  nextAction,
  progressOf,
  viewCounts,
} from '@/lib/purchasingFlow';
import type { PoStatus, SupplierItemView } from '@/types/purchasing';

/*
 * A purchase order's way through (lib/purchasingFlow): views, search, progress, the next thing to
 * do, and what's low among a supplier's items.
 */

const all = { approve: true, manage: true, receive: true };
const order = (number: number, status: PoStatus) => ({
  number,
  status,
  supplier: { id: 's1', name: 'Sharma Vegetables' },
});

describe('purchase order flow', () => {
  it('sorts orders into to do, on the way and done', () => {
    const orders = (
      ['draft', 'approved', 'sent', 'partly_received', 'received', 'cancelled'] as const
    ).map((s, i) => order(i + 1, s));
    expect(viewCounts(orders)).toEqual({ todo: 2, waiting: 2, done: 2, all: 6 });
    expect(inView(order(1, 'closed'), 'done')).toBe(true);
  });

  it('finds an order by its number or its supplier', () => {
    expect(matchesOrder(order(7, 'sent'), 'PO-0007')).toBe(true);
    expect(matchesOrder(order(7, 'sent'), '7')).toBe(true);
    expect(matchesOrder(order(7, 'sent'), '17')).toBe(false);
    expect(matchesOrder(order(7, 'sent'), 'sharma')).toBe(true);
  });

  it('shows how far along it is', () => {
    expect(progressOf('draft')).toEqual({ done: 0, stopped: false });
    expect(progressOf('sent').done).toBe(2);
    expect(progressOf('received').done).toBe(3);
    expect(progressOf('cancelled').stopped).toBe(true);
  });

  it('offers the next step to whoever may take it', () => {
    expect(nextAction(order(1, 'draft'), all)).toBe('approve');
    expect(nextAction(order(1, 'draft'), { ...all, approve: false })).toBeUndefined();
    expect(nextAction(order(1, 'approved'), all)).toBe('send');
    expect(nextAction(order(1, 'partly_received'), all)).toBe('receive');
    expect(nextAction(order(1, 'received'), all)).toBeUndefined();
  });

  it('suggests whole packs of what is low, from the supplier’s pack size', () => {
    const items: SupplierItemView[] = [
      {
        ingredientId: 'onion',
        name: 'Onion',
        pack: { name: 'Bag', size: 10, unit: 'kg' },
        preferred: true,
      },
      {
        ingredientId: 'rice',
        name: 'Rice',
        pack: { name: 'Sack', size: 25, unit: 'kg' },
        preferred: true,
      },
      {
        ingredientId: 'milk',
        name: 'Milk',
        pack: { name: 'Crate', size: 6000, unit: 'ml' },
        preferred: true,
      },
    ];
    const stock = [
      { ingredientId: 'onion', onHand: 2, reorderLevel: 5, parLevel: 20, unit: 'kg' as const },
      { ingredientId: 'rice', onHand: 30, reorderLevel: 10, parLevel: 40, unit: 'kg' as const },
      { ingredientId: 'milk', onHand: 3, reorderLevel: 5, parLevel: 15, unit: 'l' as const },
    ];
    // Onion: 18 kg to fill → 2 bags. Rice isn't low. Milk: 12 L → 2 crates of 6 L.
    expect(Object.fromEntries(lowSuggestions(items, stock))).toEqual({ onion: 2, milk: 2 });
  });
});

describe('changing an order', () => {
  const catalog = [
    { ingredientId: 'onion', pack: { name: 'Bag', size: 10, unit: 'kg' as const } },
    { ingredientId: 'rice', pack: { name: 'Bag', size: 10, unit: 'kg' as const } },
  ];
  const ingredients = [
    { id: 'onion', unit: 'kg' as const, packs: [{ id: 'bag', name: 'Bag', quantity: 10 }] },
    {
      id: 'rice',
      unit: 'kg' as const,
      packs: [
        { id: 'bag', name: 'Bag', quantity: 10 },
        { id: 'sack', name: 'Sack', quantity: 25 },
      ],
    },
    { id: 'milk', unit: 'ml' as const, packs: [] },
    { id: 'ghee', unit: 'kg' as const, packs: [] },
  ];

  it('keeps every item in the pack it was ordered in', () => {
    const { listed, extras } = editableLines(
      [
        // The supplier's usual pack: on their list.
        {
          ingredientId: 'onion',
          pack: { name: 'Bag', size: 10, unit: 'kg' },
          quantity: 2,
          price: 400,
        },
        // Another pack the ingredient has: by hand, in that pack.
        {
          ingredientId: 'rice',
          pack: { name: 'Sack', size: 25, unit: 'kg' },
          quantity: 2,
          price: 900,
        },
        // A unit: by hand, in that unit.
        { ingredientId: 'milk', pack: { name: 'l', size: 1, unit: 'l' }, quantity: 6 },
        // A pack gone since: by hand, in its own unit, the amount kept (2 × 5 kg tins: 10 kg).
        {
          ingredientId: 'ghee',
          pack: { name: 'Tin', size: 5, unit: 'kg' },
          quantity: 2,
          price: 3000,
        },
      ],
      catalog,
      ingredients,
    );
    expect(listed).toEqual([{ ingredientId: 'onion', quantity: 2, price: 400 }]);
    expect(extras).toEqual([
      { ingredientId: 'rice', measure: 'pack:sack', quantity: 2, price: 900 },
      { ingredientId: 'milk', measure: 'l', quantity: 6 },
      { ingredientId: 'ghee', measure: '', quantity: 10 },
    ]);
  });
});
