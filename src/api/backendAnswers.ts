import type { ApiRequest, HttpMethod } from './client';
import { toAppOrders, type BackendOrder } from './orderAdapter';
import { matchPath } from './paths';

/*
 * The backend's answers that differ from the contract's shapes (restaurant-backend ›
 * docs/architecture.md › Orders and payments), made into them, so screens, hooks and mutations
 * read one shape whichever server answered. Orders are the reason: the backend sends data, the
 * app words it (api/orderAdapter). Other routes pass through.
 */

type Adapt = (data: unknown, sessionToken: string | undefined) => Promise<unknown>;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const orderOf: Adapt = async (data, token) => (await toAppOrders([data as BackendOrder], token))[0];

/** `{ orders: [...] }` (with whatever else the answer carries). */
const ordersIn: Adapt = async (data, token) => {
  const answer = data as { orders: BackendOrder[] };
  return { ...answer, orders: await toAppOrders(answer.orders, token) };
};

/** `{ order, refunded }`. */
const changeOf: Adapt = async (data, token) => {
  const answer = data as { order: BackendOrder };
  return { ...answer, order: await orderOf(answer.order, token) };
};

/**
 * A service request as staff see it: the backend never shows them a guest's token (the contract
 * has one on every request; the staff screens don't read it).
 */
const forStaff = <T>(request: T) => ({ ...request, sessionId: '' });

const requestOf: Adapt = (data) => {
  const answer = data as { request: object };
  return Promise.resolve({ ...answer, request: forStaff(answer.request) });
};

const serviceBoard: Adapt = (data) => {
  const board = data as { requests: object[]; doneRequests: object[] };
  return Promise.resolve({
    ...board,
    requests: board.requests.map(forStaff),
    doneRequests: board.doneRequests.map(forStaff),
  });
};

const tableDetail: Adapt = async (data, token) => {
  const table = data as { orders: BackendOrder[]; requests: object[] };
  return {
    ...table,
    orders: await toAppOrders(table.orders, token),
    requests: table.requests.map(forStaff),
  };
};

/** An answer already in the contract's shape. */
const asIs: Adapt = (data) => Promise.resolve(data);

const ADAPTERS: readonly (readonly [HttpMethod, string, Adapt])[] = [
  // The guest's orders.
  ['POST', 'orders', orderOf],
  ['GET', 'orders/:id', orderOf],
  ['POST', 'orders/:id/rounds', orderOf],
  ['PATCH', 'orders/:id', changeOf],
  ['POST', 'orders/:id/cancel', changeOf],
  ['GET', 'sessions/:id/orders', ordersIn],
  ['GET', 'tables/:branchId/:table/orders', ordersIn],
  ['POST', 'payments/:id/simulate', ordersIn],
  // Staff: orders, the kitchen, payments in person.
  ['GET', 'admin/branches/:branchId/orders', ordersIn],
  ['POST', 'admin/branches/:branchId/tables/:table/orders', orderOf],
  ['POST', 'admin/branches/:branchId/orders/:id/rounds', orderOf],
  ['PATCH', 'admin/branches/:branchId/orders/:id/rounds/:round', changeOf],
  ['PATCH', 'admin/branches/:branchId/orders/:id/rounds/:round/status', orderOf],
  ['POST', 'admin/orders/:id/served', orderOf],
  ['POST', 'admin/branches/:branchId/orders/:id/payment', orderOf],
  ['POST', 'admin/branches/:branchId/orders/:id/cancel', orderOf],
  ['POST', 'admin/branches/:branchId/orders/:id/refund', orderOf],
  ['POST', 'admin/branches/:branchId/tables/:table/payment', ordersIn],
  // Staff: the floor and requests.
  ['GET', 'admin/branches/:branchId/service', serviceBoard],
  // Before …/tables/:table, which "qr-codes" would match: the links need nothing done.
  ['GET', 'admin/branches/:branchId/tables/qr-codes', asIs],
  ['GET', 'admin/branches/:branchId/tables/:table', tableDetail],
  ['POST', 'admin/branches/:branchId/tables/:table/free', tableDetail],
  ['POST', 'admin/service-requests/:id/acknowledge', requestOf],
  ['POST', 'admin/service-requests/:id/resolve', requestOf],
];

/** The guest's session a request was made with: in its body, its path (`sessions/:id/…`) or `?sessionId=`. */
function sessionTokenOf({ path, body }: ApiRequest): string | undefined {
  if (isObject(body) && typeof body.sessionId === 'string') return body.sessionId;
  const inPath = matchPath('sessions/:id/orders', path);
  if (inPath) return inPath.id;
  const query = path.split('?')[1];
  return query ? (new URLSearchParams(query).get('sessionId') ?? undefined) : undefined;
}

/** The backend's answer to a request, in the contract's shape. */
export async function adaptBackendAnswer<T>(request: ApiRequest, data: T): Promise<T> {
  const found = ADAPTERS.find(
    ([method, pattern]) => method === request.method && matchPath(pattern, request.path) !== null,
  );
  if (!found || data === undefined) return data;
  return (await found[2](data, sessionTokenOf(request))) as T;
}
