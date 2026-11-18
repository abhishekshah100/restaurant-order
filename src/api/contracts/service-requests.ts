import type { BillScope, ServiceRequest, WaiterReason } from '@/types/service';

/* ---------- Service requests ---------- */

/**
 * `POST /service-requests` — call a waiter or ask for the bill at the session's table. One of
 * each kind is pending at a time: asking again returns the pending one (`created: false`).
 * The bill's balance is worked out by the server. Requests lapse after 30 minutes.
 * 201 / 200 → the request. Errors: 404 session_not_found, 409 dine_in_only (a takeaway or
 * delivery session).
 *
 * `DELETE /service-requests/:id` — cancel it. 204. Errors: 404 not_found.
 *
 * `GET /sessions/:id/service-requests` — the session's pending requests (other guests at the
 * table don't see them).
 */
export type CreateServiceRequestRequest =
  | { sessionId: string; kind: 'waiter'; reason: WaiterReason; note?: string }
  | { sessionId: string; kind: 'bill'; scope: BillScope };

export interface CreateServiceRequestResponse {
  request: ServiceRequest;
  /** False when a request of that kind was already pending (it is returned unchanged). */
  created: boolean;
}

export interface ServiceRequestListResponse {
  requests: ServiceRequest[];
}
