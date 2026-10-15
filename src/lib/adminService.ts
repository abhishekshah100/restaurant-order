import type {
  AdminBranchService,
  AdminOrderSummary,
  AdminReadyRound,
  AdminServiceRequest,
} from '@/types/admin';
import type { BillRequest, WaiterRequest } from '@/types/service';

/*
 * The waiter home's logic, pure: the "Needs you now" queue from GET
 * /admin/branches/:branchId/service, the optimistic updates after Done / Mark served, and the
 * greeting by the branch's time of day.
 */

/** One thing on the floor that needs a person, with the time it started waiting (ISO). */
export type QueueItem =
  | { key: string; kind: 'waiter'; since: string; request: WaiterRequest }
  | { key: string; kind: 'bill'; since: string; request: BillRequest }
  | {
      key: string;
      kind: 'ready';
      since: string;
      order: AdminOrderSummary;
      ready: AdminReadyRound;
    };

/** Waiter calls, bill requests and rounds ready to serve, in one list, oldest first. */
export function serviceQueue(
  service: Pick<AdminBranchService, 'requests' | 'orders'>,
): QueueItem[] {
  const requests = service.requests.map((request): QueueItem => {
    const key = `request:${request.id}`;
    return request.kind === 'waiter'
      ? { key, kind: 'waiter', since: request.requestedAt, request }
      : { key, kind: 'bill', since: request.requestedAt, request };
  });
  const ready = service.orders.flatMap((order) =>
    order.readyRounds.map((round): QueueItem => ({
      key: `ready:${order.id}:${round.round}`,
      kind: 'ready',
      since: round.readyAt,
      order,
      ready: round,
    })),
  );
  return [...requests, ...ready].sort(
    (a, b) => a.since.localeCompare(b.since) || a.key.localeCompare(b.key),
  );
}

/** Whole minutes from `since` (ISO) to `now`, never negative. */
export const minutesSince = (since: string, now: Date): number =>
  Math.max(0, Math.floor((now.getTime() - Date.parse(since)) / 60_000));

const countKey = (request: AdminServiceRequest) =>
  request.kind === 'waiter' ? 'waiterCalls' : 'billRequests';

/** The service without this request (Done, before the server confirms). */
export function withoutRequest(service: AdminBranchService, id: string): AdminBranchService {
  const request = service.requests.find((r) => r.id === id);
  if (!request) return service;
  const key = countKey(request);
  return {
    ...service,
    requests: service.requests.filter((r) => r !== request),
    counts: { ...service.counts, [key]: Math.max(0, service.counts[key] - 1) },
  };
}

/** The service with someone on their way to this request (On my way, before the server confirms). */
export function withAcknowledged(
  service: AdminBranchService,
  id: string,
  by: string,
  at: string,
): AdminBranchService {
  return {
    ...service,
    requests: service.requests.map((r) =>
      r.id === id && !r.acknowledgedAt ? { ...r, acknowledgedAt: at, acknowledgedBy: by } : r,
    ),
  };
}

/**
 * The service with the order's ready round served (every ready round without `round`), before
 * the server confirms.
 */
export function withoutReadyRound(
  service: AdminBranchService,
  orderId: string,
  round?: number,
): AdminBranchService {
  let removed = 0;
  const orders = service.orders.map((order) => {
    if (order.id !== orderId) return order;
    const readyRounds = order.readyRounds.filter((r) => round !== undefined && r.round !== round);
    removed += order.readyRounds.length - readyRounds.length;
    return { ...order, readyRounds };
  });
  if (removed === 0) return service;
  return {
    ...service,
    orders,
    counts: { ...service.counts, readyToServe: Math.max(0, service.counts.readyToServe - removed) },
  };
}

export type DayPeriod = 'morning' | 'afternoon' | 'evening';

/** Morning from 5:00, afternoon from 12:00, evening from 17:00 (until 5:00), in the time zone. */
export function dayPeriod(now: Date, timeZone: string): DayPeriod {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(now),
  );
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}
