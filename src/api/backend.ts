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
  ['PATCH', 'admin/sessions/current/password'],
  // Settings › Staff.
  ['GET', 'admin/branches/:branchId/staff'],
  ['POST', 'admin/branches/:branchId/staff'],
  ['PATCH', 'admin/branches/:branchId/staff/:staffId'],
  ['POST', 'admin/branches/:branchId/staff/:staffId/password'],
  ['GET', 'admin/branches'],
  ['POST', 'admin/branches'],
  ['DELETE', 'admin/branches/:branchId'],
  ['PATCH', 'admin/branches/:branchId/status'],
  // Settings and the floor plan.
  ['GET', 'admin/branches/:branchId/settings'],
  ['PATCH', 'admin/branches/:branchId/settings'],
  ['POST', 'admin/branches/:branchId/settings/image'],
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
  ['GET', 'branches/:branchId/menu/suggestions'],
  ['GET', 'admin/branches/:branchId/menu/suggestions'],
  ['PATCH', 'admin/branches/:branchId/menu/suggestions'],
  ['GET', 'branches/:branchId/menu/cart-suggestions'],
  ['GET', 'admin/branches/:branchId/menu/cart-suggestions'],
  ['PATCH', 'admin/branches/:branchId/menu/cart-suggestions'],
  ['POST', 'admin/branches/:branchId/payment-proofs'],
  ['POST', 'admin/branches/:branchId/reservations/:id/deposit'],
  ['POST', 'admin/branches/:branchId/reservations/:id/reminded'],
  ['GET', 'admin/branches/:branchId/reservations/guests/:phone'],
  ['PATCH', 'admin/branches/:branchId/reservations/rules'],
  ['POST', 'admin/branches/:branchId/orders/:id/refunds/:seq/received'],
  ['GET', 'admin/branches/:branchId/cash-register'],
  ['GET', 'admin/branches/:branchId/cash-register/sessions/:id'],
  ['POST', 'admin/branches/:branchId/cash-register/open'],
  ['POST', 'admin/branches/:branchId/cash-register/movements'],
  ['POST', 'admin/branches/:branchId/cash-register/close'],
  ['GET', 'admin/branches/:branchId/cash-register/days/:day'],
  ['POST', 'admin/branches/:branchId/cash-register/days/:day/sign-off'],
  ['GET', 'admin/branches/:branchId/cash-register/report'],
  ['PATCH', 'admin/branches/:branchId/cash-register/limit'],
  // Inventory: ingredients, each branch's stock, the ledger.
  ['GET', 'admin/branches/:branchId/inventory/stock'],
  ['GET', 'admin/branches/:branchId/inventory/stock/:ingredientId'],
  ['PATCH', 'admin/branches/:branchId/inventory/stock/:ingredientId'],
  ['GET', 'admin/branches/:branchId/inventory/movements'],
  ['GET', 'admin/branches/:branchId/inventory/alerts'],
  ['POST', 'admin/branches/:branchId/inventory/opening'],
  ['POST', 'admin/branches/:branchId/inventory/adjustments'],
  ['POST', 'admin/branches/:branchId/inventory/wastage'],
  ['GET', 'admin/branches/:branchId/inventory/ingredients'],
  ['POST', 'admin/branches/:branchId/inventory/ingredients'],
  ['PATCH', 'admin/branches/:branchId/inventory/ingredients/:id'],
  ['DELETE', 'admin/branches/:branchId/inventory/ingredients/:id'],
  ['POST', 'admin/branches/:branchId/inventory/categories'],
  ['PATCH', 'admin/branches/:branchId/inventory/categories/:id'],
  ['DELETE', 'admin/branches/:branchId/inventory/categories/:id'],
  ['POST', 'admin/branches/:branchId/inventory/production'],
  ['GET', 'admin/branches/:branchId/inventory/dashboard'],
  ['GET', 'admin/branches/:branchId/inventory/batches'],
  ['POST', 'admin/branches/:branchId/inventory/batches/write-off'],
  ['PATCH', 'admin/branches/:branchId/inventory/batches/:id'],
  ['GET', 'admin/branches/:branchId/inventory/counts'],
  ['POST', 'admin/branches/:branchId/inventory/counts'],
  ['GET', 'admin/branches/:branchId/inventory/counts/:id'],
  ['PATCH', 'admin/branches/:branchId/inventory/counts/:id/lines'],
  ['POST', 'admin/branches/:branchId/inventory/counts/:id/:step'],
  ['GET', 'admin/branches/:branchId/inventory/transfers'],
  ['POST', 'admin/branches/:branchId/inventory/transfers'],
  ['POST', 'admin/branches/:branchId/inventory/transfers/:id/:step'],
  ['GET', 'admin/branches/:branchId/inventory/usage'],
  ['GET', 'admin/branches/:branchId/inventory/exports/:kind'],
  ['GET', 'admin/branches/:branchId/inventory/recipes'],
  ['GET', 'admin/branches/:branchId/inventory/recipes/:slug'],
  ['PATCH', 'admin/branches/:branchId/inventory/recipes/:slug'],
  ['PATCH', 'admin/branches/:branchId/inventory/settings'],
  // The restaurant's optional modules (super admins switch them).
  ['GET', 'admin/branches/:branchId/features'],
  ['PATCH', 'admin/branches/:branchId/features'],
  // Purchasing: suppliers, purchase orders, deliveries, returns, invoice photos.
  ['GET', 'admin/branches/:branchId/purchasing/suppliers'],
  ['POST', 'admin/branches/:branchId/purchasing/suppliers'],
  ['PATCH', 'admin/branches/:branchId/purchasing/suppliers/:id'],
  ['DELETE', 'admin/branches/:branchId/purchasing/suppliers/:id'],
  ['PATCH', 'admin/branches/:branchId/purchasing/suppliers/:id/items'],
  ['GET', 'admin/branches/:branchId/purchasing/orders'],
  ['POST', 'admin/branches/:branchId/purchasing/orders'],
  ['POST', 'admin/branches/:branchId/purchasing/orders/suggest'],
  ['GET', 'admin/branches/:branchId/purchasing/orders/:id'],
  ['PATCH', 'admin/branches/:branchId/purchasing/orders/:id'],
  ['POST', 'admin/branches/:branchId/purchasing/orders/:id/:step'],
  ['PATCH', 'admin/branches/:branchId/purchasing/settings'],
  ['GET', 'admin/branches/:branchId/purchasing/receipts'],
  ['POST', 'admin/branches/:branchId/purchasing/receipts'],
  ['GET', 'admin/branches/:branchId/purchasing/receipts/:id'],
  ['POST', 'admin/branches/:branchId/purchasing/receipts/:id/prices'],
  ['GET', 'admin/branches/:branchId/purchasing/price-changes'],
  ['GET', 'admin/branches/:branchId/purchasing/returns'],
  ['POST', 'admin/branches/:branchId/purchasing/returns'],
  ['POST', 'admin/branches/:branchId/purchasing/proofs'],
  ['GET', 'admin/branches/:branchId/purchasing/proofs/:key'],
  // Pricing: promotions, and the quotes the cart and checkout ask for.
  ['GET', 'branches/:branchId/promotions'],
  // Settings › Offers: staff manage the automatic offers.
  // Settings › Roles & permissions.
  ['GET', 'admin/branches/:branchId/roles'],
  ['POST', 'admin/branches/:branchId/roles'],
  ['PATCH', 'admin/branches/:branchId/roles/:roleId'],
  ['DELETE', 'admin/branches/:branchId/roles/:roleId'],
  ['GET', 'admin/branches/:branchId/offers'],
  ['POST', 'admin/branches/:branchId/offers'],
  ['PATCH', 'admin/branches/:branchId/offers/:offerId'],
  ['DELETE', 'admin/branches/:branchId/offers/:offerId'],
  ['POST', 'promos/validate'],
  ['POST', 'delivery/quote'],
  // Guests' visits, their one-time codes, and the signed table QR links staff print.
  ['POST', 'sessions'],
  ['GET', 'sessions/:id'],
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
  ['GET', 'sessions/:id/wifi'],
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
  ['GET', 'admin/branches/:branchId/orders/history'],
  ['GET', 'admin/branches/:branchId/orders/:id'],
  ['POST', 'admin/branches/:branchId/tables/:table/orders'],
  ['POST', 'admin/branches/:branchId/orders/:id/rounds'],
  ['PATCH', 'admin/branches/:branchId/orders/:id/rounds/:round'],
  ['PATCH', 'admin/branches/:branchId/orders/:id/rounds/:round/status'],
  ['PATCH', 'admin/branches/:branchId/orders/:id/rounds/:round/items/:position/plated'],
  ['POST', 'admin/branches/:branchId/orders/:id/rounds/:round/dismiss'],
  ['PATCH', 'admin/branches/:branchId/orders/:id/rush'],
  ['POST', 'admin/branches/:branchId/orders/:id/messages'],
  ['POST', 'admin/branches/:branchId/orders/:id/rounds/:round/cancel'],
  ['POST', 'admin/branches/:branchId/orders/:id/rounds/:round/items/:position/unavailable'],
  ['POST', 'admin/branches/:branchId/orders/:id/unavailable'],
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
  ['GET', 'admin/branches/:branchId/service-requests/history'],
  ['GET', 'admin/branches/:branchId/payments/history'],
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
