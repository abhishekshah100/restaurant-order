import type { AdminBranchService, AdminServiceRequest } from '@/types/admin';
import type { ServiceKind } from '@/types/service';

/*
 * The Requests page's logic, pure: the open requests split into waiting and someone on the way,
 * the ones done recently, a filter by kind with its counts, and how long a request took.
 */

export type RequestFilter = 'all' | ServiceKind;

export const REQUEST_FILTERS: readonly RequestFilter[] = ['all', 'waiter', 'bill'];

const matches = (filter: RequestFilter) => (r: AdminServiceRequest) =>
  filter === 'all' || r.kind === filter;

/** Open requests by state (oldest first), and those done in the last 30 minutes (newest first). */
export function requestGroups(
  service: Pick<AdminBranchService, 'requests' | 'doneRequests'>,
  filter: RequestFilter,
) {
  const open = service.requests.filter(matches(filter));
  return {
    waiting: open.filter((r) => !r.acknowledgedAt),
    coming: open.filter((r) => r.acknowledgedAt),
    done: service.doneRequests.filter(matches(filter)),
  };
}

/** Open requests counted for each filter. */
export function requestCounts(requests: readonly AdminServiceRequest[]) {
  return {
    all: requests.length,
    waiter: requests.filter((r) => r.kind === 'waiter').length,
    bill: requests.filter((r) => r.kind === 'bill').length,
  } satisfies Record<RequestFilter, number>;
}

/** Whole minutes from the guest asking to staff dealing with it; undefined while open. */
export function handledInMinutes(request: AdminServiceRequest): number | undefined {
  if (!request.resolvedAt) return undefined;
  const ms = Date.parse(request.resolvedAt) - Date.parse(request.requestedAt);
  return Math.max(0, Math.round(ms / 60_000));
}
