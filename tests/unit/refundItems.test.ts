import { describe, expect, it } from 'vitest';
import { refundNeedsItems, refundableLines, refundedDishes, valueOfPicks } from '@/lib/refundItems';
import type { Order, OrderItem, OrderRound, PaymentTransaction } from '@/types/order';

/* The dishes a staff refund names: which lines can be named, how many, and what they came to. */

const item = (name: string, unitPrice: number, quantity: number): OrderItem =>
  ({
    dishSlug: name.toLowerCase(),
    name,
    veg: true,
    quantity,
    unitPrice,
    details: [],
  }) as OrderItem;

const round = (number: number, items: OrderItem[], status = 'served'): OrderRound =>
  ({ number, status, items, timeline: [], placedAt: '', changeableUntil: '' }) as OrderRound;

const refund = (fields: Partial<PaymentTransaction>): PaymentTransaction =>
  ({
    id: 'A1-T2',
    kind: 'refund',
    amount: 100,
    channel: 'inPerson',
    method: 'cash',
    at: '2026-10-15T14:00:00.000Z',
    ...fields,
  }) as PaymentTransaction;

// 2 × Dal Makhani at 300, then a Garlic Naan at 100; a third round taken back. ₹735 billed:
// ₹700 of dishes, plus tax.
const order = (transactions: PaymentTransaction[] = [], fields: Partial<Order> = {}): Order =>
  ({
    id: 'A1',
    status: 'served',
    items: [],
    itemTotal: 700,
    total: 735,
    rounds: [
      round(1, [item('Dal Makhani', 300, 2)]),
      round(2, [item('Garlic Naan', 100, 1)]),
      round(3, [item('Lassi', 120, 1)], 'cancelled'),
    ],
    payment: {
      method: 'counter',
      status: 'paid',
      transactions: [
        { id: 'A1-T1', kind: 'payment', amount: 735, channel: 'inPerson', method: 'cash', at: '' },
        ...transactions,
      ],
    },
    timeline: [],
    ...fields,
  }) as Order;

describe('refunds naming dishes', () => {
  it('needs dishes for a complaint or a wrong item only', () => {
    expect(refundNeedsItems('complaint')).toBe(true);
    expect(refundNeedsItems('wrongItem')).toBe(true);
    expect(refundNeedsItems('goodwill')).toBe(false);
    expect(refundNeedsItems('overcharged')).toBe(false);
  });

  it('lists what was served on rounds still standing, less what earlier refunds named', () => {
    const lines = (o: Order) =>
      refundableLines(o).map((l) => [l.round, l.position, l.item.name, l.left]);
    expect(lines(order())).toEqual([
      [1, 0, 'Dal Makhani', 2],
      [2, 0, 'Garlic Naan', 1],
    ]);
    const named = refund({
      items: [{ round: 1, position: 0, name: 'Dal Makhani', quantity: 1, amount: 100 }],
    });
    expect(lines(order([named]))).toEqual([
      [1, 0, 'Dal Makhani', 1],
      [2, 0, 'Garlic Naan', 1],
    ]);
    const naan = refund({
      items: [{ round: 2, position: 0, name: 'Garlic Naan', quantity: 1, amount: 100 }],
    });
    expect(lines(order([named, naan]))).toEqual([[1, 0, 'Dal Makhani', 1]]);
  });

  it('counts an order from before rounds as one round', () => {
    const old = order([], { rounds: undefined, items: [item('Dal Makhani', 300, 2)] });
    expect(refundableLines(old).map((l) => [l.round, l.position, l.left])).toEqual([[1, 0, 2]]);
  });

  it('values the picked dishes at their share of the bill, rounded down', () => {
    // One dal makhani: 300 of 700 in dishes, so 300 × 735 / 700 = 315.
    expect(valueOfPicks(order(), [{ round: 1, position: 0, quantity: 1 }], 100)).toBe(315);
    // Both lines: all the dishes, so the whole bill.
    expect(
      valueOfPicks(
        order(),
        [
          { round: 1, position: 0, quantity: 2 },
          { round: 2, position: 0, quantity: 1 },
        ],
        100,
      ),
    ).toBe(735);
    // The delivery fee isn't a dish's: left out.
    const delivered = order([], { total: 785, delivery: { fee: 50 } as Order['delivery'] });
    expect(valueOfPicks(delivered, [{ round: 2, position: 0, quantity: 1 }], 100)).toBe(105);
    // A line that isn't refundable counts nothing.
    expect(valueOfPicks(order(), [{ round: 3, position: 0, quantity: 1 }], 100)).toBe(0);
  });

  it('reads the dishes a refund was for', () => {
    expect(
      refundedDishes([
        { round: 1, position: 0, name: 'Dal Makhani', variant: 'Full', quantity: 1, amount: 80 },
        { round: 2, position: 0, name: 'Garlic Naan', quantity: 2, amount: 20 },
      ]),
    ).toBe('1× Dal Makhani (Full), 2× Garlic Naan');
  });
});
