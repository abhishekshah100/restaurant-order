import type { LedgerLine } from '@/lib/adminPayments';
import type { Price } from '@/types/menu';
import type { Order } from '@/types/order';

/*
 * Refunds & cancellations: every refund (from the money given back, on the day it was given)
 * and every cancelled order (on the day of the order), as one list (newest first), what they come
 * to, their reasons, and the online refunds still on their way to the guest. Pure, so it's
 * unit-tested; the page words it.
 */

export interface RefundEntry {
  kind: 'refund';
  key: string;
  /** What's shown of its order. */
  order: LedgerLine['order'];
  transaction: LedgerLine;
  /** Its number on the order ("BLR-001-T3" → 3), to mark it received. */
  seq: number;
  /** When the money was given back. */
  at: string;
  amount: Price;
  /** The reason's code ("complaint", "cancelled"…). */
  reason?: string;
  by?: string;
  /** Online, through the payment partner, and not yet reached the guest. */
  pending: boolean;
}

/** What was cancelled: the whole order, one round of it, or dishes the kitchen ran out of. */
export type CancelPart = 'order' | 'round' | 'ranOut';

export interface CancelEntry {
  kind: 'cancel';
  part: CancelPart;
  key: string;
  order: Order;
  at: string;
  /** What it came to: the order's total, or the round's or dishes' menu price. */
  amount: Price;
  /** Why, as staff read it. */
  reason?: string;
  /** The guest (within the change window) or the restaurant. */
  who?: 'guest' | 'restaurant';
  /** The member of staff who did it (kept from 13 Nov 2026). */
  by?: string;
  /** The round taken back, or the dishes' round. */
  round?: number;
  /** Ran out: what, e.g. "2 × Butter naan". */
  dishes?: string;
  /** Ran out: the kitchen's note to the waiters. */
  note?: string;
  /** Paid already: the money for it went back to the guest by itself (a refund row shows it). */
  refundedAuto?: boolean;
}

/** How the page words the reasons the order data doesn't (the guest's own take-back, run out). */
export interface CancelWords {
  /** A guest took a round back in the change window. */
  guest: string;
  /** Dishes the kitchen ran out of. */
  ranOut: string;
}

const NO_WORDS: CancelWords = { guest: '', ranOut: '' };

export type RefundsEntry = RefundEntry | CancelEntry;

/** "BLR-001-T3" → 3. */
export const transactionSeq = (id: string): number => Number(id.slice(id.lastIndexOf('-T') + 2));

/** Refunds from the money given back (each on the day it was given). */
export function refundEntriesOf(lines: readonly LedgerLine[]): RefundEntry[] {
  return lines
    .filter((t) => t.kind === 'refund')
    .map((t) => ({
      kind: 'refund' as const,
      key: t.id,
      order: t.order,
      transaction: t,
      seq: transactionSeq(t.id),
      at: t.at,
      amount: t.amount,
      ...(t.reason ? { reason: t.reason } : {}),
      ...(t.by ? { by: t.by } : {}),
      pending: t.channel === 'online' && t.status === 'started',
    }));
}

/** A refund that went back by itself when something was cancelled (within a few seconds). */
const AUTO_REFUND_MS = 10_000;
const refundedWith = (order: Order, at: string) =>
  (order.payment.transactions ?? []).some(
    (t) =>
      t.kind === 'refund' &&
      (t.reason === 'changed' || t.reason === 'cancelled') &&
      Math.abs(Date.parse(t.at) - Date.parse(at)) <= AUTO_REFUND_MS,
  );

const sumOf = (items: readonly { unitPrice: Price; quantity: number }[]) =>
  items.reduce((sum, i) => add(sum, i.unitPrice * i.quantity), 0);

/**
 * Cancellations (each on the day of the order): whole orders; and, on orders still going, each
 * round taken back and each dish the kitchen ran out of (what's left of a round taken back counts
 * once: dishes already run out are their own line). A whole cancelled order is one line only.
 */
export function cancelEntriesOf(
  orders: readonly Order[],
  words: CancelWords = NO_WORDS,
): CancelEntry[] {
  return orders.flatMap((order): CancelEntry[] => {
    const rounds = order.rounds ?? [];
    if (order.status === 'cancelled') {
      const at = order.timeline.find((e) => e.status === 'cancelled')?.at ?? order.placedAt;
      const by = rounds.findLast((r) => r.cancelled?.by)?.cancelled?.by;
      return [
        {
          kind: 'cancel',
          part: 'order',
          key: `${order.id}-cancel`,
          order,
          at,
          amount: order.total,
          ...(order.cancelReason ? { reason: order.cancelReason } : {}),
          ...(order.cancelledBy ? { who: order.cancelledBy } : {}),
          ...(by ? { by } : {}),
          ...(refundedWith(order, at) ? { refundedAuto: true } : {}),
        },
      ];
    }
    const taken = rounds.flatMap((r): CancelEntry[] => {
      const amount = sumOf(r.items);
      // Rounds from before who and why were kept (and the demo's) say only that, and when.
      const cancelled =
        r.cancelled ??
        (r.status === 'cancelled'
          ? { at: r.timeline.find((e) => e.status === 'cancelled')?.at ?? r.placedAt }
          : undefined);
      // A round left with nothing (every dish ran out) is told by its dishes.
      if (!cancelled || amount <= 0) return [];
      const reason = cancelled.reason ?? (cancelled.who === 'guest' ? words.guest : '');
      return [
        {
          kind: 'cancel',
          part: 'round',
          key: `${order.id}-round-${r.number}`,
          order,
          at: cancelled.at,
          amount,
          ...(reason ? { reason } : {}),
          ...(cancelled.who ? { who: cancelled.who } : {}),
          ...(cancelled.by ? { by: cancelled.by } : {}),
          round: r.number,
          ...(refundedWith(order, cancelled.at) ? { refundedAuto: true } : {}),
        },
      ];
    });
    const ranOut = rounds.flatMap((r) =>
      r.items.flatMap((item, index): CancelEntry[] => {
        if (!item.unavailable) return [];
        const at = item.unavailableAt ?? r.cancelled?.at ?? r.placedAt;
        return [
          {
            kind: 'cancel',
            part: 'ranOut',
            key: `${order.id}-${r.number}-${index}-ranout`,
            order,
            at,
            amount: item.unitPrice * item.unavailable,
            ...(words.ranOut ? { reason: words.ranOut } : {}),
            who: 'restaurant',
            ...(item.unavailableBy ? { by: item.unavailableBy } : {}),
            round: r.number,
            dishes: `${item.unavailable} × ${item.name}`,
            ...(item.unavailableNote ? { note: item.unavailableNote } : {}),
            ...(refundedWith(order, at) ? { refundedAuto: true } : {}),
          },
        ];
      }),
    );
    return [...taken, ...ranOut];
  });
}

/** Every refund and cancellation, newest first. */
export function refundsEntries(
  lines: readonly LedgerLine[],
  orders: readonly Order[],
  words: CancelWords = NO_WORDS,
): RefundsEntry[] {
  return [...refundEntriesOf(lines), ...cancelEntriesOf(orders, words)].sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at) || a.key.localeCompare(b.key),
  );
}

export interface RefundsSummary {
  refunded: Price;
  /** Handed back in person (cash). */
  refundedInPerson: Price;
  /** Through the payment partner. */
  refundedOnline: Price;
  refunds: number;
  /** Whole orders cancelled. */
  cancelled: number;
  /** Rounds taken back (the order went on). */
  cancelledRounds: number;
  /** Dishes the kitchen ran out of (lines). */
  ranOut: number;
  /** What everything cancelled came to. */
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
    cancelledRounds: 0,
    ranOut: 0,
    cancelledValue: 0,
    pending: 0,
    pendingAmount: 0,
  };
  for (const e of entries) {
    if (e.kind === 'cancel') {
      if (e.part === 'order') summary.cancelled += 1;
      else if (e.part === 'round') summary.cancelledRounds += 1;
      else summary.ranOut += 1;
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
  /** Cancellations: whole orders, rounds or run out (or "all"). */
  part?: 'all' | CancelPart;
  /** `${kind}:${reason}`, or "all". */
  reason: string;
  /** Who gave the refund, or "all". */
  staff: string;
  query: string;
}

export function filterRefunds(
  entries: readonly RefundsEntry[],
  { kind, part = 'all', reason, staff, query }: RefundsFilters,
): RefundsEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter(
    (e) =>
      (kind === 'all' || e.kind === kind) &&
      (part === 'all' || (e.kind === 'cancel' && e.part === part)) &&
      (reason === 'all' || `${e.kind}:${e.reason ?? ''}` === reason) &&
      (staff === 'all' || e.by === staff) &&
      (!q ||
        e.order.id.toLowerCase().includes(q) ||
        e.order.customerName.toLowerCase().includes(q) ||
        (e.order.table !== undefined && String(e.order.table) === q)),
  );
}

/** Who gave refunds or cancelled something, by name. */
export const refundStaff = (entries: readonly RefundsEntry[]): string[] =>
  [...new Set(entries.flatMap((e) => (e.by ? [e.by] : [])))].sort();

/** An online refund still not with the guest this many days after it was given is late. */
export const LATE_REFUND_DAYS = 7;
const DAY_MS = 86_400_000;

/** Whether an online refund on its way has taken longer than it should (check with the bank). */
export const isLateRefund = (entry: RefundsEntry, now: Date): boolean =>
  entry.kind === 'refund' &&
  entry.pending &&
  now.getTime() - Date.parse(entry.at) > LATE_REFUND_DAYS * DAY_MS;
