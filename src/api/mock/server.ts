import type { ApiRequest, ApiResponse, HttpMethod } from '../client';
import { mockLatencyRange } from '../config';
import { getQueryClient } from '../queryClient';
import { MockHttpError, randomId, type Handler, type MockContext } from './context';
import { createStorageDb } from './db';
import { getOrder, listSessionOrders, listTableOrders, placeOrder } from './handlers/orders';
import { sendOtp, verifyOtp } from './handlers/otp';
import { createPayment, simulatePayment } from './handlers/payments';
import {
  cancelServiceRequest,
  createServiceRequest,
  listServiceRequests,
} from './handlers/serviceRequests';
import { deliveryQuote } from './handlers/orderPricing';
import { createSession, updateSession } from './handlers/sessions';
import { querySeed } from './seed';

/*
 * The mock server: an in-browser router from method + path to a handler, standing in for the
 * backend (see api/contracts for every endpoint). Requests it doesn't own (the dummy JSON:
 * menu, branches, content…) fall through to the static files.
 */

const ROUTES: [HttpMethod, string, Handler][] = [
  ['POST', 'sessions', createSession],
  ['PATCH', 'sessions/:id', updateSession],
  ['POST', 'delivery/quote', deliveryQuote],
  ['POST', 'otp', sendOtp],
  ['POST', 'otp/verify', verifyOtp],
  ['POST', 'orders', placeOrder],
  ['GET', 'orders/:id', getOrder],
  ['GET', 'sessions/:id/orders', listSessionOrders],
  ['GET', 'tables/:branchId/:table/orders', listTableOrders],
  ['POST', 'payments', createPayment],
  ['POST', 'payments/:id/simulate', simulatePayment],
  ['POST', 'service-requests', createServiceRequest],
  ['DELETE', 'service-requests/:id', cancelServiceRequest],
  ['GET', 'sessions/:id/service-requests', listServiceRequests],
];

/** The route's `:params` if `path` matches `pattern`, else null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const want = pattern.split('/');
  const got = path.split('?')[0].split('/');
  if (want.length !== got.length) return null;
  const params: Record<string, string> = {};
  for (const [i, part] of want.entries()) {
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(got[i]);
    else if (part !== got[i]) return null;
  }
  return params;
}

/** A JSON round trip: handlers and callers never share objects, just like over the wire. */
const wire = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

/** The handler for a request and its path params; null when the mock doesn't own the endpoint. */
function route(request: ApiRequest): { handler: Handler; params: Record<string, string> } | null {
  for (const [method, pattern, handler] of ROUTES) {
    const params = method === request.method ? matchPath(pattern, request.path) : null;
    if (params) return { handler, params };
  }
  return null;
}

/** A server over these tables and seed: answers the routes above, null for anything else. */
export function createMockServer(ctx: MockContext) {
  return async (request: ApiRequest): Promise<ApiResponse | null> => {
    const found = route(request);
    if (!found) return null;
    try {
      return wire(await found.handler(ctx, { params: found.params, body: wire(request.body) }));
    } catch (error) {
      if (error instanceof MockHttpError) return { status: error.status, body: error.body };
      throw error;
    }
  };
}

/** A stable delay per endpoint within the configured range, so runs are repeatable. */
export function latencyFor({ method, path }: ApiRequest, [min, max] = mockLatencyRange()): number {
  if (max <= min) return min;
  let hash = 0;
  for (const char of `${method} ${path}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return min + (hash % (max - min + 1));
}

let server: ReturnType<typeof createMockServer> | undefined;

/** The app's mock server: Web Storage tables, the dummy JSON as seed, the real clock. */
export async function handleMockRequest(request: ApiRequest): Promise<ApiResponse | null> {
  if (!route(request)) return null;
  server ??= createMockServer({
    db: createStorageDb(),
    seed: querySeed(getQueryClient()),
    now: () => Date.now(),
    newId: randomId,
  });
  const delay = latencyFor(request);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  return server(request);
}
