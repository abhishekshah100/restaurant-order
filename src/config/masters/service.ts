/*
 * Master values for the floor: what a guest at a table can ask for, and where a table booking
 * stands. Words: service › waiterDialog.reasons (guest), common › adminHome.queue.reasons (staff),
 * common › adminReservations (bookings).
 */

/** The two kinds of request a guest sends from the table. */
export const SERVICE_REQUEST_KINDS = ['waiter', 'bill'] as const;
export type ServiceRequestKind = (typeof SERVICE_REQUEST_KINDS)[number];

/** Why a guest calls a waiter, in the order they're offered. */
export const WAITER_REQUEST_REASONS = ['waiter', 'water', 'cutlery', 'other'] as const;
export type WaiterRequestReason = (typeof WAITER_REQUEST_REASONS)[number];

/**
 * Customer request type: every request as staff see it — a waiter call (by reason) or the bill.
 */
export const CUSTOMER_REQUEST_TYPES = [
  { id: 'waiter', kind: 'waiter', reason: 'waiter' },
  { id: 'water', kind: 'waiter', reason: 'water' },
  { id: 'cutlery', kind: 'waiter', reason: 'cutlery' },
  { id: 'other', kind: 'waiter', reason: 'other' },
  { id: 'bill', kind: 'bill' },
] as const satisfies readonly {
  id: string;
  kind: ServiceRequestKind;
  reason?: WaiterRequestReason;
}[];
export type CustomerRequestType = (typeof CUSTOMER_REQUEST_TYPES)[number]['id'];

/** Whose orders a bill request is for: the guest's own, or the whole table. */
export const BILL_SCOPES = ['mine', 'table'] as const;
export type BillScopeCode = (typeof BILL_SCOPES)[number];

/**
 * Reservation status. `booked` is confirmed (a booking still to come); the guests are
 * `seated` when they arrive; or it's `cancelled`, or a `noShow`.
 */
export const RESERVATION_STATUSES = ['booked', 'seated', 'cancelled', 'noShow'] as const;
export type ReservationStatusCode = (typeof RESERVATION_STATUSES)[number];
