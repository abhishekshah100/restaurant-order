import type { ApiRequest, HttpMethod } from './client';
import { backendBaseUrl } from './config';
import { matchPath } from './paths';

/*
 * The endpoints restaurant-backend already serves (its README › Endpoints). With
 * NEXT_PUBLIC_BACKEND_URL set they go to it; every other endpoint stays on the mock server and
 * the dummy JSON until its module is built. Add a module's routes here as it lands.
 */
const BACKEND_ROUTES: readonly (readonly [HttpMethod, string])[] = [
  // Staff sign-in, sign-out, branches and their status.
  ['POST', 'admin/sessions'],
  ['DELETE', 'admin/sessions/current'],
  ['GET', 'admin/branches'],
  ['POST', 'admin/branches'],
  ['DELETE', 'admin/branches/:branchId'],
  ['PATCH', 'admin/branches/:branchId/status'],
  // Settings and the floor plan.
  ['GET', 'admin/branches/:branchId/settings'],
  ['PATCH', 'admin/branches/:branchId/settings'],
  ['GET', 'admin/branches/:branchId/floors'],
  ['PATCH', 'admin/branches/:branchId/floors'],
  // What guests read of the branches.
  ['GET', 'branches'],
  ['GET', 'branches/:branchId/config'],
  ['GET', 'branches/:branchId/status'],
  ['GET', 'branches/:branchId/floors'],
  // The menu: what everyone reads, and staff changing it.
  ['GET', 'branches/:branchId/menu'],
  ['PATCH', 'admin/branches/:branchId/menu/dishes/:slug/availability'],
  ['POST', 'admin/branches/:branchId/menu/dishes'],
  ['PATCH', 'admin/branches/:branchId/menu/dishes/:slug'],
  ['DELETE', 'admin/branches/:branchId/menu/dishes/:slug'],
  ['PATCH', 'admin/branches/:branchId/menu/categories/:categoryId/order'],
  ['PATCH', 'admin/branches/:branchId/menu/categories'],
  ['POST', 'admin/branches/:branchId/menu/images'],
  // Pricing: promotions, and the quotes the cart and checkout ask for.
  ['GET', 'branches/:branchId/promotions'],
  ['POST', 'promos/validate'],
  ['POST', 'delivery/quote'],
  // Guests' visits, their one-time codes, and the signed table QR links staff print.
  ['POST', 'sessions'],
  ['PATCH', 'sessions/:id'],
  ['POST', 'otp'],
  ['POST', 'otp/verify'],
  ['GET', 'admin/branches/:branchId/tables/qr-codes'],
  // Orders: the guest's checkout, rounds, changes and cancellations, their orders and bill.
  ['POST', 'orders'],
  ['GET', 'orders/:id'],
  ['POST', 'orders/:id/rounds'],
  ['PATCH', 'orders/:id'],
  ['POST', 'orders/:id/cancel'],
  ['GET', 'sessions/:id/orders'],
  ['GET', 'tables/:branchId/:table/orders'],
  // Paying online (the simulator stands in for the payment partner in development).
  ['POST', 'payments'],
  ['POST', 'payments/:id/simulate'],
  // Calling a waiter, asking for the bill.
  ['POST', 'service-requests'],
  ['DELETE', 'service-requests/:id'],
  ['GET', 'sessions/:id/service-requests'],
  // Staff: today's orders, the waiter's orders and rounds, the kitchen, payments in person.
  ['GET', 'admin/branches/:branchId/orders'],
  ['POST', 'admin/branches/:branchId/tables/:table/orders'],
  ['POST', 'admin/branches/:branchId/orders/:id/rounds'],
  ['PATCH', 'admin/branches/:branchId/orders/:id/rounds/:round'],
  ['PATCH', 'admin/branches/:branchId/orders/:id/rounds/:round/status'],
  ['POST', 'admin/orders/:id/served'],
  ['POST', 'admin/branches/:branchId/orders/:id/payment'],
  ['POST', 'admin/branches/:branchId/tables/:table/payment'],
  ['POST', 'admin/branches/:branchId/orders/:id/cancel'],
  ['POST', 'admin/branches/:branchId/orders/:id/refund'],
  // Staff: the floor, requests and bookings.
  ['GET', 'admin/branches/:branchId/service'],
  ['GET', 'admin/branches/:branchId/tables'],
  ['GET', 'admin/branches/:branchId/tables/:table'],
  ['POST', 'admin/branches/:branchId/tables/:table/free'],
  ['POST', 'admin/service-requests/:id/acknowledge'],
  ['POST', 'admin/service-requests/:id/resolve'],
  ['GET', 'admin/branches/:branchId/reservations'],
  ['POST', 'admin/branches/:branchId/reservations'],
  ['PATCH', 'admin/branches/:branchId/reservations/:id'],
  ['PATCH', 'admin/branches/:branchId/reservations/:id/status'],
];

/** Whether the backend is configured (NEXT_PUBLIC_BACKEND_URL). */
export const isBackendEnabled = (): boolean => backendBaseUrl() !== '';

/** Whether the backend is configured and serves this request. */
export function isBackendRequest({ method, path }: Pick<ApiRequest, 'method' | 'path'>): boolean {
  return (
    isBackendEnabled() &&
    BACKEND_ROUTES.some(([m, pattern]) => m === method && matchPath(pattern, path) !== null)
  );
}

/** The backend URL of an endpoint path: "admin/branches" → "http://…/v1/admin/branches". */
export const backendUrl = (path: string): string => `${backendBaseUrl()}/${path}`;
