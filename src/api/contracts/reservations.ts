import type { AdminReservations, Reservation } from '@/types/admin';

/* ---------- Reservations (staff) ---------- */

/**
 * `GET /admin/branches/:branchId/reservations` — the branch's bookings from the start of today
 * (its time zone) on, every status, by time. Authorised like GET /admin/branches. 200 →
 * `ReservationsResponse`. Errors: 401, 403. Polled like the floor (every 15 s). A booked table
 * shows as `reserved` on the floor plan from an hour before its time until 30 minutes after
 * (`booking` on GET …/tables says for whom); seated guests with nothing ordered yet show as
 * `seated`. Mock: kept on this device (`olive.mock.reservations.v1`); under `npm run dev` each
 * branch starts with sample bookings.
 */
export type ReservationsResponse = AdminReservations;

/**
 * `?from=&to=` on GET …/reservations (Reservations › History): the bookings due on those days of
 * the branch's calendar ("2026-10-01"), every status, by time; one alone means that day. Up to
 * 92 days at once (400 `{ field: 'from' }` past that, or the wrong way round).
 */
export interface ReservationsFilter {
  from?: string;
  to?: string;
}

/**
 * `POST /admin/branches/:branchId/reservations` — a booking taken by phone or at the door — and
 * `PATCH /admin/branches/:branchId/reservations/:id` — a booking changed (only while booked).
 * The table must exist and be free for `minutes` from `at`: a booked or seated booking there
 * overlapping it is refused. Authorised like GET /admin/branches. 201 / 200 → `Reservation`.
 * Errors: 400 invalid_request (no name, party not 1–20, a mobile number the branch's rules
 * refuse, a time in the past or over 60 days ahead, `minutes` not one of 60, 90, 120, 150, 180,
 * a note over 200 characters), 401, 403, 404 not_found (no such table, or booking), 409
 * table_taken (with `reservation`: the booking in the way), 409 reservation_closed (edit only:
 * no longer booked).
 */
export interface ReservationInput {
  /** The main table: the first of `tables` (servers before `tables` read only this). */
  table: number;
  /**
   * Every table, the main one first: all in one area, seating the whole party between them
   * (400 `{ field: 'tables' }` otherwise). Up to 6.
   */
  tables: number[];
  guestName: string;
  /** National mobile digits; optional. */
  phone?: string;
  partySize: number;
  /** ISO. */
  at: string;
  /** Default 90. */
  minutes?: number;
  note?: string;
}

/**
 * `PATCH /admin/branches/:branchId/reservations/:id/status` — the guests arrived (`seated`:
 * booked only, from an hour before its time; the table shows as seated until they order or
 * staff free it), called it off (`cancelled`: booked only), didn't come (`noShow`: booked, once
 * its time has passed), or a cancelled or no-show booking is restored (`booked`: if the table is
 * still free then). Records who and when. Authorised like GET /admin/branches. 200 →
 * `Reservation`. Errors: 400, 401, 403, 404 not_found, 409 reservation_closed (not that change
 * from where it is), 409 table_taken (restoring).
 */
export interface SetReservationStatusRequest {
  status: Reservation['status'];
}
