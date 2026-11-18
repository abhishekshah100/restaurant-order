import type { RefundPick } from '@/api/contracts';
import type { Price } from '@/types/menu';
import type { Order, OrderItem, RefundReason, RefundedItem } from '@/types/order';
import { ledgerOf } from './adminPayments';

/*
 * The dishes a staff refund is for (a complaint, a wrong item), so reports can take it off
 * sales by dish. The server checks the same (orders › refund-items.ts).
 */

/** What a refund was for, to read: "1× Butter Chicken (Full), 2× Garlic Naan". */
export const refundedDishes = (items: readonly RefundedItem[]) =>
  items.map((i) => `${i.quantity}× ${i.name}${i.variant ? ` (${i.variant})` : ''}`).join(', ');

/** Refunds for these reasons name their dishes; the rest may ("₹50 off" names none). */
export const REFUND_NEEDS_ITEMS: readonly RefundReason[] = ['complaint', 'wrongItem'];

export const refundNeedsItems = (reason: RefundReason) => REFUND_NEEDS_ITEMS.includes(reason);

/** A line of the order that can still be refunded, and how many of it. */
export interface RefundableLine {
  round: number;
  position: number;
  item: OrderItem;
  left: number;
}

export const refundLineKey = (line: Pick<RefundPick, 'round' | 'position'>) =>
  `${line.round}:${line.position}`;

/**
 * The lines staff can name on a refund: everything served on rounds not cancelled (what the
 * kitchen couldn't make is already off the bill), less what earlier refunds named. An order
 * from before rounds counts as one round.
 */
export function refundableLines(order: Order): RefundableLine[] {
  const refunded = new Map<string, number>();
  for (const t of ledgerOf(order)) {
    for (const r of t.items ?? []) {
      refunded.set(refundLineKey(r), (refunded.get(refundLineKey(r)) ?? 0) + r.quantity);
    }
  }
  const rounds = order.rounds ?? [{ number: 1, status: order.status, items: order.items }];
  return rounds
    .filter((r) => r.status !== 'cancelled')
    .flatMap((r) =>
      r.items.map((item, position) => ({
        round: r.number,
        position,
        item,
        left: item.quantity - (refunded.get(refundLineKey({ round: r.number, position })) ?? 0),
      })),
    )
    .filter((line) => line.left > 0);
}

/**
 * What the guest paid for the picked dishes: their menu value scaled to the bill (offers,
 * discounts, service charge and tax in, the delivery fee out), rounded down to the minor unit.
 * The most a refund naming them gives back.
 */
export function valueOfPicks(order: Order, picks: readonly RefundPick[], minorUnit: number): Price {
  const lines = new Map(refundableLines(order).map((l) => [refundLineKey(l), l]));
  const menuMinor = picks.reduce((sum, pick) => {
    const line = lines.get(refundLineKey(pick));
    return line ? sum + Math.round(line.item.unitPrice * minorUnit) * pick.quantity : sum;
  }, 0);
  const itemTotalMinor = Math.round(order.itemTotal * minorUnit);
  if (itemTotalMinor <= 0) return 0;
  const billedMinor = Math.max(
    0,
    Math.round((order.total - (order.delivery?.fee ?? 0)) * minorUnit),
  );
  return Math.floor((menuMinor * billedMinor) / itemTotalMinor) / minorUnit;
}
