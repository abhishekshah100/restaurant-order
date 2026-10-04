import { describe, expect, it } from 'vitest';
import { isStoredOrder } from '@/api/mock/db';
import { markOrdersPaid } from '@/api/mock/handlers/payments';
import { buildOrder, nextOrderId, priceLines } from '@/api/mock/orderBuilder';
import { defaultConfig, lineKey, orderLine, unitPrice } from '@/lib/cartLine';
import { isOwnOrder } from '@/lib/orders';
import { calculateBill } from '@/lib/pricing';
import type { Branch, PaymentMethodId } from '@/types/branch';
import type { CartLine } from '@/types/cart';
import type { Dish } from '@/types/menu';
import { testMenu, testBranch, testOrderHistory, testLineLabels } from '../apiState';

const menu = testMenu();
const branch = testBranch();
const labels = {
  paidOnline: 'Paid online',
  payInPerson: { counter: 'Pay at counter', pickup: 'Pay at pickup', cod: 'Cash on delivery' },
  methodName: (method: string) => (method === 'esewa' ? 'eSewa' : 'UPI'),
  lineLabels: testLineLabels(),
  estimate: branch.prepTime,
};
const mockOrders = testOrderHistory().history;

const kebab = menu.getDish('dahi-kebab') as Dish;
const config = defaultConfig(kebab);
const line: CartLine = {
  ...config,
  key: lineKey(config),
  quantity: 2,
  unitPrice: unitPrice(kebab, config),
};
const input = {
  lines: [line],
  fulfilment: { mode: 'dineIn' as const, table: 12 },
  sessionId: 'guest-1',
  customerName: 'Ananya',
  method: 'counter' as PaymentMethodId,
  kitchenNote: '',
  now: new Date(),
};

/** buildOrder with the bill the server works out for the lines at the branch (orderPricing). */
const build = (
  over: Partial<typeof input> & { id: string },
  m = menu,
  b: Branch = branch,
) => {
  const lines = over.lines ?? input.lines;
  return buildOrder({ ...input, ...over, bill: calculateBill(lines, b) }, m, labels, b);
};

describe('buildOrder', () => {
  it('builds an order with the prep-time estimate', () => {
    const order = build({ id: 'A105' });
    expect(order).toMatchObject({
      id: 'A105',
      estimate: '18–22 min',
      table: 12,
      placedBy: 'you',
      sessionId: 'guest-1',
    });
    expect(order?.items[0]).toMatchObject({ dishSlug: 'dahi-kebab', quantity: 2 });
  });

  it("stamps the branch and prices the order with the branch's taxes", () => {
    const india = build({ id: 'A105' });
    // 2 × ₹289 = ₹578 + 5% GST (₹28.90) = ₹606.90 → ₹607
    expect(india).toMatchObject({ branchId: branch.id, itemTotal: 578, total: 607 });

    const nepal = testBranch('ktm-thamel');
    const nepalMenu = testMenu(nepal.id);
    const dish = nepalMenu.getDish('dahi-kebab') as Dish;
    const nepalLine = { ...line, unitPrice: unitPrice(dish, config) };
    const order = build({ lines: [nepalLine], id: 'A106', method: 'esewa' }, nepalMenu, nepal);
    // 2 × रू 460 = 920 + 10% service (92) = 1,012 + 13% VAT (131.56) = 1,143.56 → 1,144
    expect(order).toMatchObject({ branchId: 'ktm-thamel', itemTotal: 920, total: 1144 });
    expect(order?.payment).toMatchObject({ method: 'online', status: 'paid', detail: 'eSewa' });
  });

  it('refuses an empty cart', () => {
    expect(build({ id: 'A105', lines: [] })).toBeNull();
  });
});

describe('isStoredOrder', () => {
  const order = build({ id: 'A105' });

  it('accepts built and mock orders', () => {
    expect(isStoredOrder(order)).toBe(true);
    expect(mockOrders.every(isStoredOrder)).toBe(true);
    expect(isStoredOrder(JSON.parse(JSON.stringify(mockOrders[0])))).toBe(true);
  });

  it('rejects orders the confirmation page could not render', () => {
    expect(isStoredOrder(null)).toBe(false);
    expect(isStoredOrder({ ...order, payment: null })).toBe(false);
    expect(isStoredOrder({ ...order, payment: { method: 'cash', status: 'paid' } })).toBe(false);
    expect(isStoredOrder({ ...order, items: [{ name: 'x' }] })).toBe(false);
    expect(isStoredOrder({ ...order, table: '12' })).toBe(false);
    expect(isStoredOrder({ ...order, timeline: undefined })).toBe(false);
    expect(isStoredOrder({ ...order, sessionId: 7 })).toBe(false);
  });
});

describe('isOwnOrder', () => {
  const order = build({ id: 'A105' });
  if (!order) throw new Error('expected an order');

  it('matches orders by the session that placed them', () => {
    expect(isOwnOrder(order, 'guest-1')).toBe(true);
    // Placed on this device, but in an earlier session (or by another guest's session).
    expect(isOwnOrder(order, 'guest-2')).toBe(false);
    expect(isOwnOrder(order, undefined)).toBe(false);
  });

  it("never counts orders without a session as anyone's own", () => {
    const { sessionId: _sessionId, ...legacy } = order;
    expect(isOwnOrder({ ...legacy, sessionId: undefined }, 'guest-2')).toBe(false);
    // The drawn history has no sessions, so it belongs to the table, not to any one guest.
    expect(mockOrders.some((o) => o.sessionId)).toBe(false);
    expect(mockOrders.filter((o) => isOwnOrder(o, 'guest-2'))).toEqual([]);
  });
});

describe('markOrdersPaid', () => {
  const unpaid = build({ id: 'A105' })!;
  const paid = build({ id: 'A106', method: 'online' })!;
  const other = build({ id: 'A107' })!;
  const payment = { detail: 'Card', transactionRef: '•••• 4821' };

  it('marks only the listed unpaid orders as paid online', () => {
    const { orders, marked } = markOrdersPaid([unpaid, paid, other], ['A105', 'A106'], payment);
    expect(marked.map((o) => o.id)).toEqual(['A105']);
    expect(orders[0].payment).toEqual({ method: 'online', status: 'paid', ...payment });
    // Already paid and unlisted orders are left exactly as they were.
    expect(orders[1]).toBe(paid);
    expect(orders[2]).toBe(other);
  });

  it('changes nothing when paying twice', () => {
    const first = markOrdersPaid([unpaid], ['A105'], payment);
    const second = markOrdersPaid(first.orders, ['A105'], payment);
    expect(second.marked).toEqual([]);
    expect(second.orders).toEqual(first.orders);
  });
});

describe('pricing and numbering (server side)', () => {
  it('prices ordered lines from the menu, never from the client, and drops unknown dishes', () => {
    const ordered = [
      { ...orderLine(line), dishSlug: 'dahi-kebab' },
      { ...orderLine(line), dishSlug: 'nope' },
    ];
    expect(priceLines(ordered, menu)).toEqual([{ ...orderLine(line), unitPrice: 289 }]);
  });

  it('takes the first free id from the pool', () => {
    expect(nextOrderId([{ id: 'A105' }], ['A105', 'A106'])).toBe('A106');
    expect(nextOrderId([{ id: 'A105' }], ['A105'])).toBeNull();
  });
});
