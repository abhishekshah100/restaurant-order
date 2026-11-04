import { ledgerOf } from '@/lib/adminPayments';
import type { Price } from '@/types/menu';
import type { Order, PaymentTransaction } from '@/types/order';

/*
 * Refunds & cancellations: every refund and every cancelled order on the orders read, as one
 * list (newest first), what they come to, their reasons, and the online refunds still on their
 * way to the guest. Pure, so it's unit-tested; the page words it.
 */

export interface RefundEntry {
  kind: 'refund';
  key: string;
  order: Order;
  transaction: PaymentTransaction;
  /** Its number on the order ("BLR-001-T3" → 3), to mark it received. */
  seq: number;
  at: string;
  amount: Price;
  /** The reason's code ("complaint", "cancelled"…). */
  reason?: string;
  by?: string;
  /** Online, through the payment partner, and not yet reached the guest. */
  pending: boolean;
}

export interface CancelEntry {
  kind: 'cancel';
  key: string;
  order: Order;
  at: string;
  /** What the order came to. */
  amount: Price;
  /** As the order words it. */
  reason?: string;
  by?: 'guest' | 'restaurant';
}

export type RefundsEntry = RefundEntry | CancelEntry;

/** "BLR-001-T3" → 3. */
export const transactionSeq = (id: string): number => Number(id.slice(id.lastIndexOf('-T') + 2));

/** Every refund and cancellation on the orders, newest first. */
export function refundsEntries(orders: readonly Order[]): RefundsEntry[] {
  const entries: RefundsEntry[] = [];
  for (const order of orders) {
    for (const t of ledgerOf(order)) {
      if (t.kind !== 'refund') continue;
      entries.push({
        kind: 'refund',
        key: t.id,
        order,
        transaction: t,
        seq: transactionSeq(t.id),
        at: t.at,
        amount: t.amount,
        ...(t.reason ? { reason: t.reason } : {}),
        ...(t.by ? { by: t.by } : {}),
        pending: t.channel === 'online' && t.status === 'started',
      });
    }
    if (order.status === 'cancelled') {
      const at = order.timeline.find((e) => e.status === 'cancelled')?.at ?? order.placedAt;
      entries.push({
        kind: 'cancel',
        key: `${order.id}-cancel`,
        order,
        at,
        amount: order.total,
        ...(order.cancelReason ? { reason: order.cancelReason } : {}),
        ...(order.cancelledBy ? { by: order.cancelledBy } : {}),
      });
    }
  }
  return entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.key.localeCompare(b.key));
}

export interface RefundsSummary {
  refunded: Price;
  /** Handed back in person (cash). */
  refundedInPerson: Price;
  /** Through the payment partner. */
  refundedOnline: Price;
  refunds: number;
  cancelled: number;
  /** What the cancelled orders came to. */
  cancelledValue: Price;
  pending: number;
  pendingAmount: Price;
}

const add = (a: Price, b: Price) => Math.round((a + b) * 100) / 100;

export function refundsSummary(entries: readonly RefundsEntry[]): RefundsSummary {
  const summary: RefundsSummary = {
    refunded: 0,
    refundedInPerson: 0,
    refundedOnline: 0,
    refunds: 0,
    cancelled: 0,
    cancelledValue: 0,
    pending: 0,
    pendingAmount: 0,
  };
  for (const e of entries) {
    if (e.kind === 'cancel') {
      summary.cancelled += 1;
      summary.cancelledValue = add(summary.cancelledValue, e.amount);
      continue;
    }
    summary.refunds += 1;
    summary.refunded = add(summary.refunded, e.amount);
    if (e.transaction.channel === 'online') {
      summary.refundedOnline = add(summary.refundedOnline, e.amount);
    } else {
      summary.refundedInPerson = add(summary.refundedInPerson, e.amount);
    }
    if (e.pending) {
      summary.pending += 1;
      summary.pendingAmount = add(summary.pendingAmount, e.amount);
    }
  }
  return summary;
}

/** A reason and what it came to: refunds by their reason, cancellations by theirs. */
export interface ReasonTotal {
  kind: RefundsEntry['kind'];
  reason: string;
  count: number;
  amount: Price;
}

/** The reasons, biggest amount first (an entry without one counts as ""). */
export function reasonTotals(entries: readonly RefundsEntry[]): ReasonTotal[] {
  const totals = new Map<string, ReasonTotal>();
  for (const e of entries) {
    const reason = e.reason ?? '';
    const key = `${e.kind}:${reason}`;
    const row = totals.get(key) ?? { kind: e.kind, reason, count: 0, amount: 0 };
    row.count += 1;
    row.amount = add(row.amount, e.amount);
    totals.set(key, row);
  }
  return [...totals.values()].sort((a, b) => b.amount - a.amount || b.count - a.count);
}

export interface RefundsFilters {
  kind: 'all' | RefundsEntry['kind'];
  /** `${kind}:${reason}`, or "all". */
  reason: string;
  /** Who gave the refund, or "all". */
  staff: string;
  query: string;
}

export function filterRefunds(
  entries: readonly RefundsEntry[],
  { kind, reason, staff, query }: RefundsFilters,
): RefundsEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter(
    (e) =>
      (kind === 'all' || e.kind === kind) &&
      (reason === 'all' || `${e.kind}:${e.reason ?? ''}` === reason) &&
      (staff === 'all' || (e.kind === 'refund' && e.by === staff)) &&
      (!q ||
        e.order.id.toLowerCase().includes(q) ||
        e.order.customerName.toLowerCase().includes(q) ||
        (e.order.table !== undefined && String(e.order.table) === q)),
  );
}

/** Who gave refunds, by name. */
export const refundStaff = (entries: readonly RefundsEntry[]): string[] =>
  [...new Set(entries.flatMap((e) => (e.kind === 'refund' && e.by ? [e.by] : [])))].sort();
