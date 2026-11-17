import { describe, expect, it } from 'vitest';
import { setupProgress, todayWork } from '@/lib/purchasingToday';
import type { PriceChange, PurchaseOrder, Supplier } from '@/types/purchasing';

/*
 * Purchasing › Today (lib/purchasingToday): how far setting up has got, and what needs someone.
 */

const supplier = (items = 0): Supplier => ({
  id: `s${items}`,
  name: 'Sharma Traders',
  items: Array.from({ length: items }, (_, i) => ({
    ingredientId: `i${i}`,
    name: `Item ${i}`,
    pack: { name: 'Bag', size: 1, unit: 'kg' },
    preferred: false,
  })),
  openOrders: 0,
});

const order = (number: number, over: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: `o${number}`,
  number,
  supplier: { id: 's1', name: 'Sharma Traders' },
  status: 'approved',
  createdAt: '2026-11-10T10:00:00Z',
  needsApproval: false,
  lines: [],
  ...over,
});

const price = (over: Partial<PriceChange>): PriceChange => ({
  receiptId: 'r1',
  receiptNumber: 1,
  receivedAt: '2026-11-16T10:00:00Z',
  supplier: 'Sharma Traders',
  lineId: 'l1',
  name: 'Onion',
  pack: { name: 'Bag', size: 10, unit: 'kg' },
  price: 400,
  flagged: false,
  pricePending: false,
  ...over,
});

describe('setting up purchasing', () => {
  it('goes ingredients, a supplier, what they sell, a first order', () => {
    expect(setupProgress({ ingredients: 0, suppliers: [], orders: [] })).toMatchObject({
      next: 'ingredients',
      doneCount: 0,
    });
    expect(setupProgress({ ingredients: 12, suppliers: [supplier()], orders: [] })).toMatchObject({
      next: 'items',
      doneCount: 2,
    });
    const done = setupProgress({ ingredients: 12, suppliers: [supplier(3)], orders: [order(1)] });
    expect(done.next).toBeUndefined();
    expect(done.doneCount).toBe(4);
  });

  it('takes the ingredients as there for staff who can’t see stock', () => {
    expect(setupProgress({ ingredients: null, suppliers: [], orders: [] }).next).toBe('supplier');
  });
});

describe('what needs someone today', () => {
  it('sorts orders into to approve, to send and arriving (late first)', () => {
    const work = todayWork(
      [
        order(5, { status: 'draft', needsApproval: true }),
        order(6, { status: 'draft', needsApproval: false }),
        order(4, { status: 'approved' }),
        order(3, { status: 'sent', expectedOn: '2026-11-17' }),
        order(2, { status: 'partly_received', expectedOn: '2026-11-15' }),
        order(1, { status: 'sent', expectedOn: '2026-11-20' }),
        order(0, { status: 'received', expectedOn: '2026-11-10' }),
      ],
      [price({ pricePending: true }), price({ flagged: true }), price({})],
      '2026-11-17',
    );
    expect(work.toApprove.map((o) => o.number)).toEqual([5]);
    expect(work.toSend.map((o) => o.number)).toEqual([4]);
    expect(work.arriving.map((o) => o.number)).toEqual([2, 3]);
    expect(work.late).toBe(1);
    expect(work.pricesToCheck).toHaveLength(2);
  });
});
