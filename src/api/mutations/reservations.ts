'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminToken } from '@/hooks/useAdminSession';
import type { ReservationRules } from '@/types/admin';
import type { DepositRequest, ReservationInput, SetReservationStatusRequest } from '../contracts';
import { api } from '../endpoints';
import { branchOf, refreshAfter } from '../refreshAfter';
import { requireToken } from './shared';

/* ---------- Reservations ---------- */

/** POST …/reservations/:id/deposit: the guest's advance recorded on the booking. */
export function useRecordDeposit() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, body }: { branchId: string; id: string; body: DepositRequest }) =>
      api.recordDeposit(requireToken(token), branchId, id, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'depositTaken', branchOf(variables)),
  });
}

/** POST …/reservations/:id/reminded: staff reminded the guest (WhatsApp or SMS). */
export function useMarkReminded() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id }: { branchId: string; id: string }) =>
      api.reservationReminded(requireToken(token), branchId, id),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'bookingChanged', branchOf(variables)),
  });
}

/** PATCH …/reservations/rules: the branch's no-show and deposit rules. */
export function useSetReservationRules() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, rules }: { branchId: string; rules: ReservationRules }) =>
      api.setReservationRules(requireToken(token), branchId, rules),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'bookingChanged', branchOf(variables)),
  });
}

/**
 * POST …/reservations (no `id`) or PATCH …/reservations/:id: a booking taken or changed. The
 * floor plan and the bookings are read again.
 */
export function useSaveReservation() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      id,
      body,
    }: {
      branchId: string;
      id?: string;
      body: ReservationInput;
    }) =>
      id
        ? api.updateReservation(requireToken(token), branchId, id, body)
        : api.createReservation(requireToken(token), branchId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'bookingChanged', branchOf(variables)),
  });
}

/** PATCH …/reservations/:id/status: seated, cancelled, a no-show, or restored. */
export function useSetReservationStatus() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      id,
      body,
    }: {
      branchId: string;
      id: string;
      body: SetReservationStatusRequest;
    }) => api.setReservationStatus(requireToken(token), branchId, id, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'bookingChanged', branchOf(variables)),
  });
}
