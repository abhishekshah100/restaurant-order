import type { Price } from '@/types/menu';

/* ---------- Reservations: deposits, reminders, rules ---------- */

/**
 * `POST /admin/branches/:branchId/reservations/:id/deposit` — the guest paid an advance (one per
 * booking, while booked): cash goes into the open cash register (409 register_closed); proof
 * photos only for other ways. → the `Reservation`. 409 deposit_exists, reservation_closed. A
 * held deposit is kept for a no-show; cancelled `depositCancelHours` or more ahead it's
 * refunded (cash from the drawer), later it's kept; a seated party's is put towards their bill
 * (`deposit` on POST …/payment). `POST …/:id/reminded` → the `Reservation` (staff reminded the
 * guest). `GET …/reservations/guests/:phone` → `GuestHistory`. `PATCH …/reservations/rules`
 * (`ReservationRules`, needs `branch.settings.manage`) → the rules. Backend only.
 */
export interface DepositRequest {
  amount: Price;
  method: string;
  proofs?: string[];
}

/**
 * POST /admin/branches/:branchId/orders/:id/discounts: off the bill, or one item (its round and
 * line); a percentage (0.01 to 100) or an amount, one of the two; why, and a note.
 */
export interface DiscountRequest {
  scope: 'bill' | 'item';
  round?: number;
  position?: number;
  percent?: number;
  amount?: number;
  reason: 'regular' | 'complaint' | 'staffMeal' | 'manager' | 'other';
  note?: string;
}
