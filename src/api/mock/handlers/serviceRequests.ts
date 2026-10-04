import { createClock } from '@/lib/clock';
import { SERVICE_NOTE_MAX, WAITER_REASON_IDS, billFor } from '@/lib/service';
import type { ServiceRequest } from '@/types/service';
import type { CreateServiceRequestResponse, ServiceRequestListResponse } from '../../contracts';
import { fail, liveSession, objectBody, ok, stringField, type Handler } from '../context';
import { SERVICE_REQUEST_TTL_MS } from '../rules';
import { allOrders, branchOrders, tableOrders } from './orders';

/** Pending requests: not older than the TTL. */
export const isPending = (request: ServiceRequest, now: number) => {
  const age = now - Date.parse(request.requestedAt);
  return age >= 0 && age < SERVICE_REQUEST_TTL_MS;
};

/** Trimmed and capped; undefined when empty. */
export function cleanNote(note: string): string | undefined {
  const trimmed = note.trim().slice(0, SERVICE_NOTE_MAX);
  return trimmed || undefined;
}

/** POST /service-requests */
export const createServiceRequest: Handler = async (ctx, { body: raw }) => {
  const body = objectBody(raw);
  const { kind, reason, note, scope } = body;
  const { session, branch } = await liveSession(ctx, stringField(body, 'sessionId'));
  const waiter =
    kind === 'waiter' &&
    typeof reason === 'string' &&
    WAITER_REASON_IDS.has(reason) &&
    (note === undefined || typeof note === 'string');
  const bill = kind === 'bill' && (scope === 'mine' || scope === 'table');
  if (!waiter && !bill) fail(400, 'invalid_request');
  // Waiters and bills come to a table: takeaway and delivery guests aren't at one.
  const { table } = session;
  if (session.mode !== 'dineIn' || table === undefined) fail(409, 'dine_in_only');
  const { placed, history } = await branchOrders(ctx, branch);

  const now = ctx.now();
  const all = ctx.db.serviceRequests.read().filter((r) => isPending(r, now));
  const pending = all.find((r) => r.sessionId === session.id && r.kind === kind);
  if (pending) {
    const response: CreateServiceRequestResponse = { request: pending, created: false };
    return ok(response);
  }
  const base = {
    id: ctx.newId(),
    table,
    sessionId: session.id,
    requestedAt: new Date(now).toISOString(),
  };
  let request: ServiceRequest;
  if (waiter) {
    request = {
      ...base,
      kind: 'waiter',
      reason: reason as Extract<ServiceRequest, { kind: 'waiter' }>['reason'],
      note: cleanNote(typeof note === 'string' ? note : ''),
    };
  } else {
    const billScope = scope as Extract<ServiceRequest, { kind: 'bill' }>['scope'];
    const orders = tableOrders(allOrders(placed, history), table, now, createClock(branch));
    request = {
      ...base,
      kind: 'bill',
      scope: billScope,
      balance: billFor(orders, billScope, session.id).balance,
    };
  }
  ctx.db.serviceRequests.write([...all, request]);
  const response: CreateServiceRequestResponse = { request, created: true };
  return ok(response, 201);
};

/** DELETE /service-requests/:id */
export const cancelServiceRequest: Handler = async (ctx, { params }) => {
  const all = ctx.db.serviceRequests.read();
  if (!all.some((r) => r.id === params.id)) fail(404, 'not_found');
  ctx.db.serviceRequests.write(all.filter((r) => r.id !== params.id));
  return ok(undefined, 204);
};

/** GET /sessions/:id/service-requests */
export const listServiceRequests: Handler = async (ctx, { params }) => {
  const now = ctx.now();
  const response: ServiceRequestListResponse = {
    requests: ctx.db.serviceRequests
      .read()
      .filter((r) => r.sessionId === params.id && isPending(r, now)),
  };
  return ok(response);
};
