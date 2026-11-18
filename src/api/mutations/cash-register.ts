'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminToken } from '@/hooks/useAdminSession';
import type { CashMovementRequest, CloseRegisterRequest, OpenRegisterRequest } from '../contracts';
import { api } from '../endpoints';
import { branchOf, refreshAfter } from '../refreshAfter';
import { requireToken } from './shared';

/* ---------- Cash register ---------- */

/** POST …/cash-register/open: the drawer opens with a float. */
export function useOpenRegister() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: OpenRegisterRequest }) =>
      api.openRegister(requireToken(token), branchId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'cashChanged', branchOf(variables)),
  });
}

/** POST …/cash-register/movements: cash paid in or out. */
export function useMoveCash() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: CashMovementRequest }) =>
      api.moveCash(requireToken(token), branchId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'cashChanged', branchOf(variables)),
  });
}

/** POST …/cash-register/close: the count (409 count_differs until a difference has a reason). */
export function useCloseRegister() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: CloseRegisterRequest }) =>
      api.closeRegister(requireToken(token), branchId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'cashChanged', branchOf(variables)),
  });
}

/** POST …/cash-register/days/:day/sign-off: a manager accepts the day's register. */
export function useSignOffCashDay() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, day, note }: { branchId: string; day: string; note?: string }) =>
      api.signOffCashDay(requireToken(token), branchId, day, note),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'cashChanged', branchOf(variables)),
  });
}

/** POST …/cash-register/sessions/:id/check: a manager checked a drawer that needed it. */
export function useCheckCashSession() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, note }: { branchId: string; id: string; note?: string }) =>
      api.checkCashSession(requireToken(token), branchId, id, note),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'cashChanged', branchOf(variables)),
  });
}

/** PATCH …/cash-register/limit: how big a difference can be before it needs review. */
export function useSetCashLimit() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, differenceLimit }: { branchId: string; differenceLimit: number }) =>
      api.setCashLimit(requireToken(token), branchId, differenceLimit),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'cashChanged', branchOf(variables)),
  });
}
