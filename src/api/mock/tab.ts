import { paidAmount } from '@/lib/lifecycle';
import { orderBill } from '@/lib/orders';
import { discountsFor, toOrderDiscounts } from '@/lib/promotions';
import type { Branch, OrderMode } from '@/types/branch';
import type { Price } from '@/types/menu';
import type { Order, OrderRound, PaymentMethod } from '@/types/order';
import type { PromoCode } from '@/types/promotion';

/*
 * The server's bookkeeping for orders that change after placing: an order's rounds, its total
 * re-priced over every round still on it, and its payment settled against the new total.
 */

/**
 * An order's rounds. Orders stored before rounds existed are one round that can't be changed
 * any more (its window closed when it was placed).
 */
export function roundsOf(order: Order): OrderRound[] {
  return (
    order.rounds ?? [
      {
        number: 1,
        placedAt: order.placedAt,
        status: order.status === 'cancelled' ? 'cancelled' : 'received',
        items: order.items,
        timeline: order.timeline,
        kitchenNote: order.kitchenNote,
        changeableUntil: order.placedAt,
      },
    ]
  );
}

/**
 * The order with these rounds: its items, item total and total are those of every round still
 * on it, priced together under the branch's taxes (and the order's delivery fee), rounded once.
 * Each item keeps the automatic offer it was ordered with; the order's promo code (`promo`, the
 * branch's rules for `order.promoCode`) is worked out again over the whole tab, so its minimum
 * and cap apply to the tab as a whole.
 */
export function withRounds(
  order: Order,
  rounds: OrderRound[],
  branch: Branch,
  promo: PromoCode | undefined,
): Order {
  const items = rounds.filter((r) => r.status !== 'cancelled').flatMap((r) => r.items);
  const { minorUnit } = branch.currency;
  const discounts = toOrderDiscounts(discountsFor(items, promo, minorUnit), minorUnit);
  const bill = orderBill({ items, delivery: order.delivery, discounts }, branch);
  return {
    ...order,
    rounds,
    items,
    itemTotal: bill.itemTotal,
    total: bill.total,
    discounts: discounts.length > 0 ? discounts : undefined,
    kitchenNote: rounds[0]?.kitchenNote,
  };
}

/** How an order is paid in person, by mode: at the counter, at pickup, cash on delivery. */
const IN_PERSON: Record<OrderMode, Exclude<PaymentMethod, 'online'>> = {
  dineIn: 'counter',
  takeaway: 'pickup',
  delivery: 'cod',
};

/**
 * The payment of an order whose total is now `total`, with `paid` paid online in all (what was
 * paid before plus anything collected just now). Paid in full: paid online, and anything paid
 * beyond the total is refunded. Paid in part: the rest is due in person (at the counter on a
 * running tab). Nothing paid: unchanged, still due as before.
 */
export function settlePayment(
  order: Pick<Order, 'payment' | 'mode'>,
  paid: Price,
  total: Price,
): { payment: Order['payment']; refunded: Price } {
  const { paid: _before, ...payment } = order.payment;
  if (paid <= 0) return { payment: { ...payment, status: 'unpaid' }, refunded: 0 };
  if (paid < total) {
    const method = payment.method === 'online' ? IN_PERSON[order.mode] : payment.method;
    return { payment: { ...payment, method, status: 'unpaid', paid }, refunded: 0 };
  }
  const refunded = paid - total;
  return {
    payment: {
      ...payment,
      method: 'online',
      status: 'paid',
      ...(refunded > 0 ? { refundAmount: (payment.refundAmount ?? 0) + refunded } : {}),
    },
    refunded,
  };
}

/** What a whole order cancelled by the guest refunds, and its payment afterwards. */
export function cancelledPayment(order: Pick<Order, 'payment' | 'total'>): {
  payment: Order['payment'];
  refunded: Price;
} {
  const refunded = paidAmount(order);
  const { paid: _paid, ...payment } = order.payment;
  return refunded > 0
    ? { payment: { ...payment, status: 'refund-started', refundAmount: refunded }, refunded }
    : { payment, refunded: 0 };
}
