import type { IconName } from '@/components/ui';
import { isOwnOrder, isUnpaid } from '@/lib/orders';
import type { Order } from '@/types/order';
import type { BillScope, ServiceKind, ServiceRequest, WaiterReason } from '@/types/service';

/** Longest note a guest can add to a waiter request (as drawn: maxlength 80). */
export const SERVICE_NOTE_MAX = 80;

/** Waiter request reasons; their words are in the service content (waiterDialog › reasons › id). */
export const WAITER_REASONS: readonly { id: WaiterReason; icon: IconName }[] = [
  { id: 'waiter', icon: 'bell' },
  { id: 'water', icon: 'drop' },
  { id: 'cutlery', icon: 'cutlery' },
  { id: 'other', icon: 'msg' },
];

/** Every waiter request reason id. */
export const WAITER_REASON_IDS: ReadonlySet<string> = new Set(WAITER_REASONS.map((r) => r.id));

export const SERVICE_PATHS: Record<ServiceKind, string> = {
  waiter: '/help/waiter-requested/',
  bill: '/help/bill-requested/',
};

/** Where a guest pays their own outstanding orders. */
export const PAY_BILL_PATH = '/help/bill/pay/';

/** Requests by kind; at most one of each is pending. */
export type ServiceRequests = Partial<Record<ServiceKind, ServiceRequest>>;

/** A session's pending requests by kind. */
export const byKind = (requests: readonly ServiceRequest[]): ServiceRequests =>
  Object.fromEntries(requests.map((r) => [r.kind, r]));

/** The most recent pending request, if any. */
export function latestRequest(requests: ServiceRequests): ServiceRequest | null {
  return (
    Object.values(requests).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0] ?? null
  );
}

// ---- Orders and bill ----

/** First name for the "Just my orders" line, e.g. "Ananya Rao" → "Ananya". */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

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
