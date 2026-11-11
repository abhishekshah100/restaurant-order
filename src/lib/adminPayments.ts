import { REFUND_REASONS as REFUND_REASON_CODES } from '@/config/masters';
import type { Price } from '@/types/menu';
import type { Order, PaymentTransaction, RefundReason, WaiveReason } from '@/types/order';
import type { BillRequest } from '@/types/service';
import { dueOn } from './adminOrders';
import { paidAmount } from './lifecycle';

/*
 * The Payments page's logic, pure: every payment and refund on today's orders (the ledger), the
 * day's money at a glance and by method, what's still to collect (by table, bill requests
 * first), the views and filters, and the arithmetic of collecting (split, tip, change) and
 * refunding. The mock server uses the same ledger and refund rules.
 */

/* ---------- The ledger ---------- */

/**
 * An order's payments and refunds, oldest first: as the server recorded them, or (on orders
 * from before they were recorded) worked out from the payment summary, at the order's time.
 */
export function ledgerOf(order: Order): PaymentTransaction[] {
  const { payment } = order;
  if (payment.transactions) return payment.transactions;
  const refunded = payment.refundAmount ?? 0;
  const paid =
    payment.status === 'paid'
      ? order.total + refunded
      : payment.status === 'unpaid'
        ? (payment.paid ?? 0)
        : refunded;
  const channel = payment.method === 'online' ? 'online' : 'inPerson';
  const base = { channel, method: payment.method, at: order.placedAt } as const;
  const entries: PaymentTransaction[] = [];
  if (paid > 0) {
    entries.push({
      ...base,
      id: `${order.id}-paid`,
      kind: 'payment',
      amount: paid,
      transactionRef: payment.transactionRef,
    });
  }
  if (refunded > 0) {
    entries.push({
      ...base,
      id: `${order.id}-refund`,
      kind: 'refund',
      amount: refunded,
      reason: order.status === 'cancelled' ? 'cancelled' : 'changed',
      status: payment.status === 'refund-started' ? 'started' : 'done',
    });
  }
  return entries;
}

const sum = (entries: readonly PaymentTransaction[], kind: PaymentTransaction['kind']) =>
  entries.filter((e) => e.kind === kind).reduce((total, e) => total + e.amount, 0);

/**
 * What staff can still give back on an order: paid and not refunded yet. Nothing on a cancelled
 * order (its refund is already under way) or one with nothing paid.
 */
export function refundable(order: Order): Price {
  if (order.status === 'cancelled') return 0;
  // Before transactions were recorded, a refund only ever went with cancelling or a change
  // (already taken off what's paid).
  const { transactions } = order.payment;
  const net = transactions
    ? sum(transactions, 'payment') - sum(transactions, 'refund')
    : paidAmount(order);
  return Math.max(0, net);
}

/** Why staff leave part of a bill, in the order they're offered. */
export const WAIVE_REASONS: readonly WaiveReason[] = ['noChange', 'regular', 'complaint', 'other'];

/** The longest note a refund takes. */
export const MAX_REFUND_NOTE = 200;

/** Why staff refund, in the order they're offered. */
export const REFUND_REASONS: readonly RefundReason[] = REFUND_REASON_CODES;

/** A payment or refund with just what's shown of its order (Payments › History reads these). */
export type LedgerLine = PaymentTransaction & {
  order: Pick<Order, 'id' | 'customerName' | 'mode' | 'table'>;
};

/* ---------- The day's money ---------- */

export interface MethodTotal {
  /** The method's id ("cash", "upi", "online"…). */
  method: string;
  channel: PaymentTransaction['channel'];
  /** Payments taken this way (refunds not taken off). */
  count: number;
  amount: Price;
  refunds: Price;
  tips: Price;
}

/**
 * The day's money as the pages show it (the server adds it up, each payment on the day it was
 * taken): after refunds, online and in person, tips, refunds, what was left off bills, by method,
 * and the cash taken.
 */
export interface DaySummary {
  /** Collected less refunds. */
  net: Price;
  online: Price;
  inPerson: Price;
  tips: Price;
  refunds: Price;
  /** Left off bills when staff took the rest (not money received). */
  waived: Price;
  /** By method, the most taken first. */
  byMethod: MethodTotal[];
  /** Cash taken (with tips) less cash given back. */
  cashInDrawer: Price;
}

/* ---------- To collect ---------- */

/** Something with money still due: a table's open bill (dine-in), or one takeaway or delivery order. */
export type DueGroup =
  | {
      kind: 'table';
      key: string;
      table: number;
      orders: Order[];
      due: Price;
      /** Paid so far on those orders (part paid). */
      paid: Price;
      /** ISO: the oldest order's time. */
      since: string;
      request?: BillRequest;
    }
  | { kind: 'order'; key: string; order: Order; due: Price; paid: Price; since: string };

/**
 * What's still to collect: tables with an open bill (every order at the table with something
 * due), then takeaway and delivery orders. Tables whose guests asked for the bill come first
 * (asked longest ago first); the rest oldest first. A dine-in order `onTableBill` turns down (one
 * left unpaid days ago) is a bill of its own, so it isn't taken with whoever sits there now.
 */
export function dueGroups(
  orders: readonly Order[],
  billRequests: readonly BillRequest[] = [],
  onTableBill: (order: Order) => boolean = () => true,
): DueGroup[] {
  const due = orders.filter((o) => dueOn(o) > 0);
  const tables = new Map<number, Order[]>();
  const groups: DueGroup[] = [];
  for (const order of due) {
    if (order.mode === 'dineIn' && order.table !== undefined && onTableBill(order)) {
      tables.set(order.table, [...(tables.get(order.table) ?? []), order]);
    } else {
      groups.push({
        kind: 'order',
        key: `order-${order.id}`,
        order,
        due: dueOn(order),
        paid: paidAmount(order),
        since: order.placedAt,
      });
    }
  }
  for (const [table, list] of tables) {
    const ordered = [...list].sort((a, b) => Date.parse(a.placedAt) - Date.parse(b.placedAt));
    groups.push({
      kind: 'table',
      key: `table-${table}`,
      table,
      orders: ordered,
      due: ordered.reduce((t, o) => t + dueOn(o), 0),
      paid: ordered.reduce((t, o) => t + paidAmount(o), 0),
      since: ordered[0].placedAt,
      request: billRequests
        .filter((r) => r.table === table)
        .sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt))[0],
    });
  }
  const asked = (g: DueGroup) => (g.kind === 'table' && g.request ? g.request.requestedAt : null);
  return groups.sort((a, b) => {
    const ra = asked(a);
    const rb = asked(b);
    if (ra && rb) return Date.parse(ra) - Date.parse(rb);
    if (ra || rb) return ra ? -1 : 1;
    return Date.parse(a.since) - Date.parse(b.since);
  });
}

/** The bills to collect in the three groups staff work through, with what's due in all. */
export interface DueSections {
  /** Tables whose guests asked for the bill: first, whatever their age. */
  asked: DueGroup[];
  /** Opened today. */
  today: DueGroup[];
  /** Still unpaid from an earlier day: to chase up. */
  earlier: DueGroup[];
  total: Price;
  earlierTotal: Price;
}

/**
 * Splits the bills to collect (in `dueGroups` order) into asked for the bill, today's and those
 * from earlier days (`isEarlier` takes a bill's oldest order time). The totals are over every
 * bill, so To collect matches the list below it.
 */
export function dueSections(
  groups: readonly DueGroup[],
  isEarlier: (since: string) => boolean,
): DueSections {
  const sections: DueSections = { asked: [], today: [], earlier: [], total: 0, earlierTotal: 0 };
  for (const group of groups) {
    sections.total += group.due;
    if (group.kind === 'table' && group.request) sections.asked.push(group);
    else if (isEarlier(group.since)) {
      sections.earlier.push(group);
      sections.earlierTotal += group.due;
    } else sections.today.push(group);
  }
  return sections;
}

/* ---------- Views and filters ---------- */

export type PaymentsView = 'collect' | 'transactions' | 'refunds';

export const PAYMENTS_VIEWS: readonly PaymentsView[] = ['collect', 'transactions', 'refunds'];

/** The view named in the address (?view=), else To collect. */
export const parsePaymentsView = (value: string | null): PaymentsView =>
  PAYMENTS_VIEWS.find((v) => v === value) ?? 'collect';

export type ChannelFilter = 'all' | PaymentTransaction['channel'];

export interface EntryFilters {
  /** A method id, or all. */
  method: string;
  channel: ChannelFilter;
  query: string;
}

/** The order number, guest, table ("12"), method's reference or who took it. */
function entryMatches(entry: LedgerLine, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const { order } = entry;
  return (
    order.id.toLowerCase().includes(q) ||
    order.customerName.toLowerCase().includes(q) ||
    (order.table !== undefined && String(order.table) === q) ||
    (entry.transactionRef?.toLowerCase().includes(q) ?? false) ||
    (entry.by?.toLowerCase().includes(q) ?? false)
  );
}

export const filterEntries = <T extends LedgerLine>(
  entries: readonly T[],
  { method, channel, query }: EntryFilters,
): T[] =>
  entries.filter(
    (e) =>
      (method === 'all' || e.method === method) &&
      (channel === 'all' || e.channel === channel) &&
      entryMatches(e, query),
  );

/** Groups to collect matching a search: the order number, a guest's name, or the table. */
export function filterGroups(groups: readonly DueGroup[], query: string): DueGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...groups];
  const matches = (o: Order) =>
    o.id.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q);
  // A dine-in bill of its own (left from days ago) is found by its table too.
  return groups.filter((g) =>
    g.kind === 'table'
      ? String(g.table) === q || g.orders.some(matches)
      : matches(g.order) || (g.order.table !== undefined && String(g.order.table) === q),
  );
}

/* ---------- Collecting ---------- */

/**
 * A bill split evenly `ways` ways, in the currency's smallest unit: every share the same, the
 * last taking what doesn't divide (so they add up to the bill exactly).
 */
export function splitShares(due: Price, ways: number, minorUnit: number): Price[] {
  const total = Math.round(due * minorUnit);
  const n = Math.max(1, Math.floor(ways));
  const share = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) =>
    i === n - 1 ? (total - share * (n - 1)) / minorUnit : share / minorUnit,
  );
}

/** A tip of `percent` of the amount, to the currency's smallest unit. */
export const tipFor = (amount: Price, percent: number, minorUnit: number): Price =>
  Math.round((amount * percent * minorUnit) / 100) / minorUnit;

/** Cash handed over less what's owed (with the tip): the change to give, or null if short. */
export function changeDue(received: Price, owed: Price, minorUnit: number): Price | null {
  const change = Math.round((received - owed) * minorUnit) / minorUnit;
  return change < 0 ? null : change;
}

/** Tip choices staff offer, as percentages of the amount (0 is no tip). */
export const TIP_PERCENTS = [0, 5, 10] as const;
