import type { ApiRequest, ApiResponse, HttpMethod } from '../client';
import { matchPath } from '../paths';
import { mockLatencyRange } from '../config';
import { getQueryClient } from '../queryClient';
import { MockHttpError, randomId, type Handler, type MockContext } from './context';
import { createStorageDb } from './db';
import {
  acknowledgeServiceRequest,
  branchService,
  markOrderServed,
  resolveServiceRequest,
} from './handlers/adminService';
import {
  createAdminSession,
  endAdminSession,
  listAdminBranches,
  setBranchStatus,
} from './handlers/adminSessions';
import {
  branchSettings,
  createBranch,
  removeBranch,
  updateBranchSettings,
} from './handlers/adminSettings';
import {
  branchMenu,
  listBranches,
  branchConfig,
  branchStatus,
  createDish,
  removeDish,
  reorderDishes,
  setDishAvailability,
  updateCategories,
  updateDish,
  uploadDishImage,
} from './handlers/adminMenu';
import {
  addStaffRound,
  branchOrdersToday,
  cancelByStaff,
  collectPayment,
  collectTablePayment,
  refundOrder,
  editStaffRound,
  takeTableOrder,
} from './handlers/adminOrders';
import {
  createReservation,
  listReservations,
  setReservationStatus,
  updateReservation,
} from './handlers/adminReservations';
import {
  branchFloorPlan,
  branchFloors,
  branchTable,
  freeTable,
  tableQrCodes,
  updateFloors,
} from './handlers/adminTables';
import { setKitchenStatus } from './handlers/kitchen';
import { addRound, cancelOrder, changeOrder } from './handlers/orderChanges';
import { getOrder, listSessionOrders, listTableOrders, placeOrder } from './handlers/orders';
import { sendOtp, verifyOtp } from './handlers/otp';
import { createPayment, simulatePayment } from './handlers/payments';
import {
  cancelServiceRequest,
  createServiceRequest,
  listServiceRequests,
} from './handlers/serviceRequests';
import { deliveryQuote } from './handlers/orderPricing';
import { branchPromotions, validatePromo } from './handlers/promos';
import { createSession, updateSession } from './handlers/sessions';
import { querySeed } from './seed';

/*
 * The mock server: an in-browser router from method + path to a handler, standing in for the
 * backend (see api/contracts for every endpoint). Requests it doesn't own (the dummy JSON:
 * menu, branches, content…) fall through to the static files.
 */

const ROUTES: [HttpMethod, string, Handler][] = [
  ['POST', 'admin/sessions', createAdminSession],
  ['DELETE', 'admin/sessions/current', endAdminSession],
  ['GET', 'admin/branches', listAdminBranches],
  ['POST', 'admin/branches', createBranch],
  ['DELETE', 'admin/branches/:branchId', removeBranch],
  ['PATCH', 'admin/branches/:branchId/status', setBranchStatus],
  ['GET', 'admin/branches/:branchId/settings', branchSettings],
  ['PATCH', 'admin/branches/:branchId/settings', updateBranchSettings],
  ['GET', 'admin/branches/:branchId/service', branchService],
  ['GET', 'admin/branches/:branchId/tables', branchFloorPlan],
  ['GET', 'admin/branches/:branchId/floors', branchFloors],
  ['PATCH', 'admin/branches/:branchId/floors', updateFloors],
  ['GET', 'admin/branches/:branchId/tables/qr-codes', tableQrCodes],
  ['GET', 'admin/branches/:branchId/tables/:table', branchTable],
  ['POST', 'admin/branches/:branchId/tables/:table/orders', takeTableOrder],
  ['POST', 'admin/branches/:branchId/tables/:table/payment', collectTablePayment],
  ['POST', 'admin/branches/:branchId/tables/:table/free', freeTable],
  ['GET', 'admin/branches/:branchId/reservations', listReservations],
  ['POST', 'admin/branches/:branchId/reservations', createReservation],
  ['PATCH', 'admin/branches/:branchId/reservations/:id', updateReservation],
  ['PATCH', 'admin/branches/:branchId/reservations/:id/status', setReservationStatus],
  ['GET', 'admin/branches/:branchId/orders', branchOrdersToday],
  ['PATCH', 'admin/branches/:branchId/menu/dishes/:slug/availability', setDishAvailability],
  ['POST', 'admin/branches/:branchId/menu/dishes', createDish],
  ['PATCH', 'admin/branches/:branchId/menu/dishes/:slug', updateDish],
  ['DELETE', 'admin/branches/:branchId/menu/dishes/:slug', removeDish],
  ['PATCH', 'admin/branches/:branchId/menu/categories/:categoryId/order', reorderDishes],
  ['PATCH', 'admin/branches/:branchId/menu/categories', updateCategories],
  ['POST', 'admin/branches/:branchId/menu/images', uploadDishImage],
  ['GET', 'branches/:branchId/menu', branchMenu],
  ['GET', 'branches/:branchId/promotions', branchPromotions],
  ['GET', 'branches', listBranches],
  ['GET', 'branches/:branchId/config', branchConfig],
  ['GET', 'branches/:branchId/status', branchStatus],
  ['POST', 'admin/branches/:branchId/orders/:id/rounds', addStaffRound],
  ['PATCH', 'admin/branches/:branchId/orders/:id/rounds/:round', editStaffRound],
  ['PATCH', 'admin/branches/:branchId/orders/:id/rounds/:round/status', setKitchenStatus],
  ['POST', 'admin/branches/:branchId/orders/:id/payment', collectPayment],
  ['POST', 'admin/branches/:branchId/orders/:id/cancel', cancelByStaff],
  ['POST', 'admin/branches/:branchId/orders/:id/refund', refundOrder],
  ['POST', 'admin/service-requests/:id/acknowledge', acknowledgeServiceRequest],
  ['POST', 'admin/service-requests/:id/resolve', resolveServiceRequest],
  ['POST', 'admin/orders/:id/served', markOrderServed],
  ['POST', 'sessions', createSession],
  ['PATCH', 'sessions/:id', updateSession],
  ['POST', 'delivery/quote', deliveryQuote],
  ['POST', 'promos/validate', validatePromo],
  ['POST', 'otp', sendOtp],
  ['POST', 'otp/verify', verifyOtp],
  ['POST', 'orders', placeOrder],
  ['GET', 'orders/:id', getOrder],
  ['PATCH', 'orders/:id', changeOrder],
  ['POST', 'orders/:id/rounds', addRound],
  ['POST', 'orders/:id/cancel', cancelOrder],
  ['GET', 'sessions/:id/orders', listSessionOrders],
  ['GET', 'tables/:branchId/:table/orders', listTableOrders],
  ['POST', 'payments', createPayment],
  ['POST', 'payments/:id/simulate', simulatePayment],
  ['POST', 'service-requests', createServiceRequest],
  ['DELETE', 'service-requests/:id', cancelServiceRequest],
  ['GET', 'sessions/:id/service-requests', listServiceRequests],
];

export { matchPath };

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
      const req = {
        params: found.params,
        body: wire(request.body),
        headers: request.headers ?? {},
      };
      return wire(await found.handler(ctx, req));
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
let storage: ReturnType<typeof createStorageDb> | undefined;

/** The mock's tables in Web Storage, one set per tab. */
const mockDb = () => (storage ??= createStorageDb());

/** The app's mock server: Web Storage tables, the dummy JSON as seed, the real clock. */
export async function handleMockRequest(request: ApiRequest): Promise<ApiResponse | null> {
  if (!route(request)) return null;
  if (!server) {
    const db = mockDb();
    server = createMockServer({
      db,
      seed: querySeed(getQueryClient(), db),
      now: () => Date.now(),
      newId: randomId,
    });
  }
  const delay = latencyFor(request);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  return server(request);
}
