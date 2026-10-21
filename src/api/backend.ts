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
  // Guests' visits, their one-time codes, and the signed table QR links staff print.
  ['POST', 'sessions'],
  ['PATCH', 'sessions/:id'],
  ['POST', 'otp'],
  ['POST', 'otp/verify'],
  ['GET', 'admin/branches/:branchId/tables/qr-codes'],
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
