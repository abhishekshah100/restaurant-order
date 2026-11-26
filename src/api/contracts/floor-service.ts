import type {
  AdminBranchService,
  AdminFloorPlan,
  AdminTableDetail,
  AdminTableQrCodes,
  TableQrCode,
} from '@/types/admin';
import type { OrderLineRequest } from './orders';
import type { DeliveryAddress } from '@/types/order';

/* ---------- Admin: floor service ---------- */

/**
 * `GET /admin/branches/:branchId/service` — what the floor staff of one branch need to act on
 * now (the waiter home). Authorised like GET /admin/branches. 200 → `BranchServiceResponse`:
 * the open waiter and bill requests (oldest first, with who's on the way); those dealt with in
 * the last 30 minutes (`doneRequests`, newest first, with who dealt with them); today's orders (branch time zone) that are
 * still active or not paid in full, newest first, each with its rounds ready to serve; the tables
 * with activity today and where each is in its visit; and the counts. Errors: 401 unauthorized,
 * 403 forbidden (not one of the admin's branches, or no such branch). Poll it (the app: every
 * 15 s and on returning to the tab). Mock: from the orders and requests on this device plus the
 * drawn history; takeaway and delivery orders have no table.
 */
export type BranchServiceResponse = AdminBranchService;

/**
 * `GET /admin/branches/:branchId/tables` — the floor plan: every area of the branch (in the
 * order staff walk them) with its tables, each with its seats and where it is now: available,
 * or taken (needs a waiter, wants the bill, waiting for food, eating), with its open orders
 * counted, what's still due and since when the guests are seated. An order stays open until
 * it's both served and paid. Authorised like GET /admin/branches. 200 → `FloorPlanResponse`.
 * Errors: 401 unauthorized, 403 forbidden. Poll it like the service (every 15 s). Mock: the
 * areas from GET /branches/:id/floors (the dummy JSON), the activity as for the service.
 */
export type FloorPlanResponse = AdminFloorPlan;

/**
 * `GET /admin/branches/:branchId/tables/:table` — one table as on the floor plan, with its
 * area, its open orders in full (newest first) and its open requests (oldest first).
 * Authorised like GET /admin/branches. 200 → `TableDetailResponse`. Errors: 401 unauthorized,
 * 403 forbidden, 404 not_found (no area has the table).
 */
export type TableDetailResponse = AdminTableDetail;

/**
 * `GET /admin/branches/:branchId/tables/qr-codes` — the link to print on each table: the guest
 * app's path with the branch, the table and a token the backend signs (so a guest can't change
 * the table number in the link); POST /sessions checks it. The app adds its own address in front
 * and draws the QR code. Authorised like GET /admin/branches. 200 → `TableQrCodesResponse`.
 * Errors: 401, 403. Mock: a token worked out from the branch and table (not a real signature).
 */
export type TableQrCodesResponse = AdminTableQrCodes;

/**
 * `GET /admin/branches/:branchId/tables/:table/qr` — one table's QR link (as in
 * TableQrCodesResponse), for staff who may show it (`tables.qr`: a torn sticker, a guest who
 * can't scan) or manage tables. Each one shown is in the audit log. 200 → `TableQrCodeResponse`.
 * Errors: 401, 403, 404 (no such table, or not in use).
 */
export type TableQrCodeResponse = TableQrCode;

/**
 * `POST /admin/branches/:branchId/tables/:table/free` — the guests have left: the table's
 * `freed` flag is set, so it's available on the floor plan whatever its earlier orders say
 * (those still unpaid stay on GET …/orders to collect). The backend clears the flag with the
 * next order or request at the table. No body. Authorised like GET /admin/branches. 200 →
 * `TableDetailResponse` (the table as now). Errors: 401, 403, 404 not_found (no such table).
 * Mock: the time it was freed is kept per table; GET /branches/:id/floors (the dummy JSON)
 * carries the flag as `freed: false` on every table.
 */
export type FreeTableResponse = TableDetailResponse;

/**
 * `POST /admin/branches/:branchId/tables/:table/orders` — a waiter takes an order at the table
 * for a guest who doesn't order on their phone. Priced like a guest's order (the menu, the
 * offers on now, the branch's taxes), dine-in, paid at the counter; no guest session. Its
 * timeline says who took it. Authorised like GET /admin/branches. 201 → `Order`. Errors: 400
 * invalid_request (no name, a malformed line), 401, 403, 404 not_found (no area has the table),
 * 409 mode_unavailable (no dine-in), 422 empty_order / item_unavailable.
 */
export interface TakeTableOrderRequest {
  /** The guest's name, or what the waiter calls them ("Table 5 guest"). */
  customerName: string;
  kitchenNote?: string;
  lines: OrderLineRequest[];
  /** The pad's key for this order (8–64 of A–Z a–z 0–9 _ -): sent again, it's placed once. */
  idempotencyKey?: string;
}

/**
 * POST /admin/branches/:branchId/orders/phone: staff take a takeaway or delivery order for a
 * customer who called (`orders.take`), by the rules a guest's order follows (the mode on and
 * open, a pickup time on offer, an area served, the minimum). Unpaid: at pickup or cash to the
 * rider; a payment made now is collected as usual. 201 → `Order` with the day's token and
 * `customerPhone`. Errors: 400 invalid_request (`customer.phone`), 401, 403, 409
 * mode_unavailable / ordering_unavailable, 422 pickup_unavailable / area_not_served /
 * below_minimum / empty_order / item_unavailable.
 */
export interface PhoneOrderRequest {
  customer: {
    name: string;
    /** The mobile number's digits, without the country code. */
    phone: string;
  };
  fulfilment:
    | {
        mode: 'takeaway';
        /** A pickup slot (ISO), or null for as soon as possible. */ pickupAt: string | null;
      }
    | { mode: 'delivery'; address: DeliveryAddress };
  kitchenNote?: string;
  lines: OrderLineRequest[];
  /** The pad's key for this order: sent again, it's taken once. */
  idempotencyKey?: string;
}
