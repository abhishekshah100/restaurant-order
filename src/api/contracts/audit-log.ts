/* ---------- The audit log (Admin › Audit log, `audit.view`; the server's only) ---------- */

/** Everything the log records (restaurant-backend › audit.types.ts › AUDIT_ACTIONS). */
export type AuditAction =
  | 'order.cancelled'
  | 'order.roundCancelled'
  | 'order.roundChanged'
  | 'order.itemUnavailable'
  | 'order.refunded'
  | 'order.refundReceived'
  | 'order.discountGiven'
  | 'order.discountRemoved'
  | 'bill.waived'
  | 'table.freed'
  | 'table.moved'
  | 'table.qrShown'
  | 'invoice.issued'
  | 'invoice.creditNoteIssued'
  | 'invoice.printed'
  | 'order.buyerSet'
  | 'order.buyerCleared'
  | 'cash.opened'
  | 'cash.moved'
  | 'cash.closed'
  | 'cash.checked'
  | 'cash.signedOff'
  | 'cash.limitChanged'
  | 'menu.priceChanged'
  | 'menu.availabilityChanged'
  | 'menu.dishRemoved'
  | 'settings.changed'
  | 'staff.added'
  | 'staff.changed'
  | 'staff.removed'
  | 'staff.restored'
  | 'staff.passwordReset'
  | 'role.created'
  | 'role.changed'
  | 'role.removed'
  | 'session.signedIn'
  | 'session.signedOut';

/** The log's areas, as the page filters them. */
export type AuditArea = 'orders' | 'tables' | 'invoices' | 'cash' | 'menu' | 'settings' | 'staff';

/** One entry: who did what to what, when, why; `details` as the action recorded them (major units). */
export interface AuditEvent {
  id: string;
  at: string;
  /** Who, with the roles they held there then; none: the system did it. */
  by: { id: string; name: string; roles?: string[] } | null;
  action: AuditAction;
  target?: {
    type:
      | 'order'
      | 'invoice'
      | 'table'
      | 'cashSession'
      | 'cashDay'
      | 'dish'
      | 'branch'
      | 'staff'
      | 'role';
    id: string;
  };
  reason?: string;
  details?: Record<string, unknown>;
}

/** GET /admin/branches/:branchId/audit?from&to&area&staffId&before */
export interface AuditLogResponse {
  from: string;
  to: string;
  /** Newest first, 100 at a time. */
  events: AuditEvent[];
  /** `before` for the next (older) page; absent on the last. */
  next?: string;
  /** Everyone with an entry on these days: the staff filter's choices. */
  staff: { id: string; name: string }[];
}

export interface AuditQuery {
  from: string;
  to: string;
  area?: AuditArea;
  staffId?: string;
  before?: string;
}
