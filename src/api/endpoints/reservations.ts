import type { GuestHistory, Reservation, ReservationRules } from '@/types/admin';
import { apiGet, apiPatch, apiPost } from '../client';
import type {
  DepositRequest,
  ReservationInput,
  ReservationsFilter,
  ReservationsResponse,
  SetReservationStatusRequest,
} from '../contracts';
import { bearer, searchOf, seg } from './shared';

/** Reservations, deposits and reminders. */
export const reservationsApi = {
  recordDeposit: (token: string, branchId: string, id: string, body: DepositRequest) =>
    apiPost<Reservation>(
      `admin/branches/${seg(branchId)}/reservations/${seg(id)}/deposit`,
      body,
      bearer(token),
    ),
  reservationReminded: (token: string, branchId: string, id: string) =>
    apiPost<Reservation>(
      `admin/branches/${seg(branchId)}/reservations/${seg(id)}/reminded`,
      {},
      bearer(token),
    ),
  guestHistory: (token: string, branchId: string, phone: string) =>
    apiGet<GuestHistory>(
      `admin/branches/${seg(branchId)}/reservations/guests/${seg(phone)}`,
      bearer(token),
    ),
  setReservationRules: (token: string, branchId: string, rules: ReservationRules) =>
    apiPatch<ReservationRules>(
      `admin/branches/${seg(branchId)}/reservations/rules`,
      rules,
      bearer(token),
    ),
  reservations: (token: string, branchId: string, filter: ReservationsFilter = {}) =>
    apiGet<ReservationsResponse>(
      `admin/branches/${seg(branchId)}/reservations${searchOf(filter)}`,
      bearer(token),
    ),
  createReservation: (token: string, branchId: string, body: ReservationInput) =>
    apiPost<Reservation>(`admin/branches/${seg(branchId)}/reservations`, body, bearer(token)),
  updateReservation: (token: string, branchId: string, id: string, body: ReservationInput) =>
    apiPatch<Reservation>(
      `admin/branches/${seg(branchId)}/reservations/${seg(id)}`,
      body,
      bearer(token),
    ),
  setReservationStatus: (
    token: string,
    branchId: string,
    id: string,
    body: SetReservationStatusRequest,
  ) =>
    apiPatch<Reservation>(
      `admin/branches/${seg(branchId)}/reservations/${seg(id)}/status`,
      body,
      bearer(token),
    ),
};
