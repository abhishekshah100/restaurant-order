import { describe, expect, it } from 'vitest';
import { cancelledPayment, settlePayment } from '@/api/mock/tab';
import {
  amountDue,
  changeWindow,
  hasRounds,
  latestRound,
  openTab,
  paidAmount,
  reorderLines,
} from '@/lib/lifecycle';
import type { Order, OrderRound } from '@/types/order';
import { testMenu, testOrderHistory } from '../apiState';

const PLACED = Date.parse('2026-10-03T19:00:00+05:30');
const SECOND = 1000;

const round = (number: number, over: Partial<OrderRound> = {}): OrderRound => ({
  number,
  placedAt: new Date(PLACED).toISOString(),
  status: 'received',
  items: [],
  timeline: [],
  changeableUntil: new Date(PLACED + 120 * SECOND).toISOString(),
  ...over,
});

const order = (over: Partial<Order> = {}): Order => ({
  id: 'A105',
  branchId: 'blr-indiranagar',
  mode: 'dineIn',
  table: 12,
  customerName: 'Ananya',
  placedBy: 'you',
  sessionId: 'guest-1',
  placedAt: new Date(PLACED).toISOString(),
  status: 'received',
  items: [],
  itemTotal: 289,
  total: 303,
  payment: { method: 'counter', status: 'unpaid' },
  timeline: [],
  rounds: [round(1)],
  ...over,
});

describe('changeWindow', () => {
  it('is open while the latest round waits for the kitchen, within the window', () => {
    const o = order();
    expect(changeWindow(o, PLACED + 119 * SECOND)).toMatchObject({
      open: true,
      round: { number: 1 },
      closesAt: PLACED + 120 * SECOND,
    });
    expect(changeWindow(o, PLACED + 120 * SECOND)).toMatchObject({
      open: false,
      reason: 'expired',
    });
  });

  it('closes once the kitchen starts, and follows the latest round still on the order', () => {
    expect(
      changeWindow(order({ rounds: [round(1, { status: 'preparing' })] }), PLACED),
    ).toMatchObject({ open: false, reason: 'started' });
    const tab = order({
      rounds: [round(1, { status: 'served' }), round(2), round(3, { status: 'cancelled' })],
    });
    expect(latestRound(tab)?.number).toBe(2);
    expect(changeWindow(tab, PLACED)).toMatchObject({ open: true, round: { number: 2 } });
    expect(hasRounds(tab)).toBe(true);
    expect(hasRounds(order())).toBe(false);
  });

  it("doesn't apply to cancelled orders or the drawn history (no rounds)", () => {
    expect(changeWindow(order({ status: 'cancelled' }), PLACED)).toBeNull();
    const [drawn] = testOrderHistory().history;
    expect(changeWindow(drawn, PLACED)).toBeNull();
  });
});

describe('what is paid and due', () => {
  it('reads a whole payment, a part payment and an unpaid order', () => {
    const paid = order({ payment: { method: 'online', status: 'paid' } });
    expect([paidAmount(paid), amountDue(paid)]).toEqual([303, 0]);
    const part = order({ total: 575, payment: { method: 'counter', status: 'unpaid', paid: 303 } });
    expect([paidAmount(part), amountDue(part)]).toEqual([303, 272]);
    expect([paidAmount(order()), amountDue(order())]).toEqual([0, 303]);
    expect(amountDue(order({ status: 'cancelled' }))).toBe(0);
    const refunded = order({ payment: { method: 'online', status: 'refund-started' } });
    expect(paidAmount(refunded)).toBe(0);
  });

  it('settles a re-priced order: part paid, paid with a refund, or still unpaid', () => {
    const online = order({ payment: { method: 'online', status: 'paid', detail: 'UPI' } });
    // A new round on a paid order: the rest is due at the counter (takeaway: at pickup).
    expect(settlePayment(online, 303, 575)).toEqual({
      payment: { method: 'counter', status: 'unpaid', detail: 'UPI', paid: 303 },
      refunded: 0,
    });
    expect(settlePayment({ ...online, mode: 'takeaway' }, 303, 575).payment.method).toBe('pickup');
    // A lower total: the difference goes back.
    expect(settlePayment(online, 607, 303)).toEqual({
      payment: { method: 'online', status: 'paid', detail: 'UPI', refundAmount: 304 },
      refunded: 304,
    });
    expect(settlePayment(order(), 0, 575)).toEqual({
      payment: { method: 'counter', status: 'unpaid' },
      refunded: 0,
    });
    expect(cancelledPayment(online)).toEqual({
      payment: { method: 'online', status: 'refund-started', detail: 'UPI', refundAmount: 303 },
      refunded: 303,
    });
    expect(cancelledPayment(order()).refunded).toBe(0);
  });
});

describe('openTab', () => {
  it("is the guest's newest dine-in order in this session that isn't cancelled", () => {
    const orders = [
      order({ id: 'A108', mode: 'takeaway', table: undefined }),
      order({ id: 'A107', status: 'cancelled' }),
      order({ id: 'A106', sessionId: 'someone-else' }),
      order({ id: 'A105' }),
      order({ id: 'A104' }),
    ];
    expect(openTab(orders, 'guest-1')?.id).toBe('A105');
    expect(openTab(orders, 'guest-2')).toBeNull();
    expect(openTab(orders, undefined)).toBeNull();
  });
});

describe('reorderLines', () => {
  const history = testOrderHistory().history;
  const byId = (id: string) => history.find((o) => o.id === id) as Order;

  it('orders the same configuration again: size, choices, add-ons and instructions', () => {
    const { lines, skipped } = reorderLines(byId('A104').items, testMenu());
    expect(skipped).toEqual([]);
    expect(lines.map((l) => [l.config, l.quantity])).toEqual([
      [
        {
          dishSlug: 'paneer-tikka',
          variantId: 'full',
          addOnIds: ['mint-chutney'],
          options: { spice: 'Medium' },
          removals: [],
          instructions: [],
          note: '',
        },
        1,
      ],
      [expect.objectContaining({ variantId: 'regular', instructions: ['Less cheese'] }), 1],
      [expect.objectContaining({ variantId: 'regular', options: { milk: 'Oat milk' } }), 2],
    ]);
  });

  it('finds the size by name when only that was recorded, and defaults the rest', () => {
    const { lines } = reorderLines(byId('A033').items, testMenu());
    expect(lines[0].config).toMatchObject({ variantId: 'full', options: { spice: 'Mild' } });
  });

  it("skips what can't be ordered now, by name", () => {
    const [chai] = byId('A097').items;
    const items = [
      chai,
      { ...chai, dishSlug: 'wild-mushroom-risotto', name: 'Wild Mushroom Risotto' },
      { ...chai, dishSlug: 'chicken-malai-tikka', name: 'Chicken Malai Tikka' },
      { ...chai, dishSlug: 'not-on-this-menu', name: 'Mystery Dish' },
    ];
    const { lines, skipped } = reorderLines(items, testMenu('ktm-thamel'));
    expect(lines.map((l) => l.dish.slug)).toEqual(['masala-chai']);
    // At today's menu prices, in this branch's currency.
    expect(lines[0].dish.price).toBe(160);
    expect(skipped).toEqual(['Wild Mushroom Risotto', 'Chicken Malai Tikka', 'Mystery Dish']);
  });
});
