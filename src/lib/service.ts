import type { IconName } from '@/components/ui';
import { isOwnOrder, isToday, isUnpaid } from '@/lib/orders';
import type { Order } from '@/types/order';
import type {
  BillRequest,
  BillScope,
  ServiceKind,
  ServiceRequest,
  WaiterReason,
  WaiterRequest,
} from '@/types/service';

/** Longest note a guest can add to a waiter request (as drawn: maxlength 80). */
export const SERVICE_NOTE_MAX = 80;

/** A pending request is dropped after this long: the staff will have seen it by then. */
export const SERVICE_REQUEST_TTL_MS = 30 * 60_000;

/** Waiter request reasons; their words are in the service content (waiterDialog › reasons › id). */
export const WAITER_REASONS: readonly { id: WaiterReason; icon: IconName }[] = [
  { id: 'waiter', icon: 'bell' },
  { id: 'water', icon: 'drop' },
  { id: 'cutlery', icon: 'cutlery' },
  { id: 'other', icon: 'msg' },
];

export const SERVICE_PATHS: Record<ServiceKind, string> = {
  waiter: '/help/waiter-requested/',
  bill: '/help/bill-requested/',
};

/** Where a guest pays their own outstanding orders. */
export const PAY_BILL_PATH = '/help/bill/pay/';

/** Requests by kind; at most one of each is pending. */
export type ServiceRequests = Partial<Record<ServiceKind, ServiceRequest>>;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const REASON_IDS = new Set<string>(WAITER_REASONS.map((r) => r.id));

function isWaiterRequest(v: Record<string, unknown>): v is Record<string, unknown> & WaiterRequest {
  return (
    v.kind === 'waiter' &&
    typeof v.reason === 'string' &&
    REASON_IDS.has(v.reason) &&
    (v.note === undefined || typeof v.note === 'string')
  );
}

function isBillRequest(v: Record<string, unknown>): v is Record<string, unknown> & BillRequest {
  return (
    v.kind === 'bill' &&
    (v.scope === 'mine' || v.scope === 'table') &&
    typeof v.balance === 'number'
  );
}

function isServiceRequest(v: unknown): v is ServiceRequest {
  return (
    isObject(v) &&
    typeof v.table === 'number' &&
    typeof v.sessionId === 'string' &&
    typeof v.requestedAt === 'string' &&
    !Number.isNaN(Date.parse(v.requestedAt)) &&
    (isWaiterRequest(v) || isBillRequest(v))
  );
}

export function isServiceRequests(v: unknown): v is ServiceRequests {
  if (!isObject(v)) return false;
  return Object.entries(v).every(
    ([kind, req]) =>
      (kind === 'waiter' || kind === 'bill') && isServiceRequest(req) && req.kind === kind,
  );
}

/** Drops requests from another guest session or older than the TTL. */
export function liveRequests(
  requests: ServiceRequests,
  sessionId: string,
  now: number,
): ServiceRequests {
  const live: ServiceRequests = {};
  for (const req of Object.values(requests)) {
    const age = now - Date.parse(req.requestedAt);
    if (req.sessionId === sessionId && age >= 0 && age < SERVICE_REQUEST_TTL_MS)
      live[req.kind] = req;
  }
  return live;
}

/** The most recent pending request, if any. */
export function latestRequest(requests: ServiceRequests): ServiceRequest | null {
  return (
    Object.values(requests).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0] ?? null
  );
}

export function cleanNote(note: string): string | undefined {
  const trimmed = note.trim().slice(0, SERVICE_NOTE_MAX);
  return trimmed || undefined;
}

// ---- Orders and bill ----

/** This visit's billable orders at the table: today, not cancelled, newest first. */
export function tableOrders(orders: readonly Order[], table: number, now: number): Order[] {
  return orders
    .filter(
      (o) => o.table === table && o.status !== 'cancelled' && isToday(o.placedAt, new Date(now)),
    )
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

/** This guest session's most recent order at the table today, if any. */
export function latestOwnOrder(
  orders: readonly Order[],
  table: number,
  now: number,
  sessionId: string | undefined,
) {
  return tableOrders(orders, table, now).find((o) => isOwnOrder(o, sessionId));
}

/** First name for the "Just my orders" line, e.g. "Ananya Rao" → "Ananya". */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

/** Design placeholder number, used until the real phone number is filled in. */
const PLACEHOLDER_PHONE = '+910000000000';

export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  return `tel:${digits.length >= 6 ? digits : PLACEHOLDER_PHONE}`;
}

export const isPaid = (order: Order) => order.payment.status === 'paid';

export interface BillSummary {
  orders: Order[];
  total: number;
  paid: number;
  balance: number;
  /**
   * Unpaid orders the guest can pay in the app (see `payableOrders`), and their total. Always
   * empty for the whole table: one guest never pays other guests' orders in the app.
   */
  payable: Order[];
  payableTotal: number;
}

/**
 * Unpaid orders this guest session placed on this device: the only orders it can pay in the
 * app. Orders from the order history (no `sessionId`) can't be paid here, even when they're
 * the guest's own; the server settles those.
 */
export function payableOrders(orders: readonly Order[], sessionId: string | undefined): Order[] {
  if (!sessionId) return [];
  return orders.filter((o) => o.sessionId === sessionId && isUnpaid(o));
}

const sumTotals = (orders: readonly Order[]) => orders.reduce((sum, o) => sum + o.total, 0);

/** The bill for this guest session's orders (`mine`) or the whole table. */
export function billFor(
  orders: readonly Order[],
  scope: BillScope,
  sessionId: string | undefined,
): BillSummary {
  const own = orders.filter((o) => isOwnOrder(o, sessionId));
  // The guest's own orders first, then the rest of the table (each newest first, as given).
  const picked =
    scope === 'mine' ? own : [...own, ...orders.filter((o) => !isOwnOrder(o, sessionId))];
  const total = sumTotals(picked);
  const paid = sumTotals(picked.filter(isPaid));
  const payable = scope === 'mine' ? payableOrders(own, sessionId) : [];
  return {
    orders: picked,
    total,
    paid,
    balance: total - paid,
    payable,
    payableTotal: sumTotals(payable),
  };
}
