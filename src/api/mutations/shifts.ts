'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminToken } from '@/hooks/useAdminSession';
import type {
  AddShiftRequest,
  FixShiftRequest,
  SaveRotaShiftRequest,
  ShiftTypeRequest,
} from '@/types/admin';
import { api } from '../endpoints';
import { branchOf, refreshAfter } from '../refreshAfter';
import { requireToken } from './shared';

/* ---------- Shifts and attendance ---------- */

/** POST …/shifts/start or …/end: clock in or out; my shift (and, out, the floor) read again. */
export function useShiftClock() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, action }: { branchId: string; action: 'start' | 'end' }) =>
      action === 'start'
        ? api.startShift(requireToken(token), branchId)
        : api.endShift(requireToken(token), branchId),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'shiftChanged', branchOf(variables)),
  });
}

/**
 * Team › Attendance: fix a shift's times (`id`) or add a forgotten one (`add`); the list, my
 * shift and (a shift closed) the floor read again.
 */
export function useFixAttendance() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (
      target:
        | { branchId: string; id: string; body: FixShiftRequest }
        | { branchId: string; add: AddShiftRequest },
    ): Promise<unknown> =>
      'add' in target
        ? api.addShift(requireToken(token), target.branchId, target.add)
        : api.fixShift(requireToken(token), target.branchId, target.id, target.body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'shiftChanged', branchOf(variables)),
  });
}

/** POST …/rota/types (no `id`) or PATCH …/rota/types/:id, or archive (`archive`). */
export function useSaveShiftType() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (
      target:
        | { branchId: string; id?: undefined; body: ShiftTypeRequest }
        | { branchId: string; id: string; body: Partial<ShiftTypeRequest> }
        | { branchId: string; id: string; archive: true },
    ): Promise<unknown> =>
      'archive' in target
        ? api.archiveShiftType(requireToken(token), target.branchId, target.id)
        : target.id === undefined
          ? api.addShiftType(requireToken(token), target.branchId, target.body)
          : api.updateShiftType(requireToken(token), target.branchId, target.id, target.body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'rotaChanged', branchOf(variables)),
  });
}

/** POST …/rota/shifts (someone's shift on a day), or DELETE …/rota/shifts/:id (`remove`). */
export function useSaveRotaShift() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (
      target:
        { branchId: string; body: SaveRotaShiftRequest } | { branchId: string; remove: string },
    ): Promise<unknown> =>
      'remove' in target
        ? api.removeRotaShift(requireToken(token), target.branchId, target.remove)
        : api.saveRotaShift(requireToken(token), target.branchId, target.body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'rotaChanged', branchOf(variables)),
  });
}

/** PATCH …/rota/settings: the weekly hours warning. */
export function useRotaSettings() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      weekHoursLimit,
    }: {
      branchId: string;
      weekHoursLimit: number | null;
    }) => api.rotaSettings(requireToken(token), branchId, weekHoursLimit),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'rotaChanged', branchOf(variables)),
  });
}

/** Time off: ask (staff), cancel (one's own) or decide (a planner). */
export function useTimeOff() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (
      target:
        | { branchId: string; ask: { from: string; to: string; reason: string } }
        | { branchId: string; id: string; cancel: true }
        | { branchId: string; id: string; decide: { approve: boolean; note?: string } },
    ) =>
      'ask' in target
        ? api.askTimeOff(requireToken(token), target.branchId, target.ask)
        : 'cancel' in target
          ? api.timeOffAction(requireToken(token), target.branchId, target.id, 'cancel')
          : api.timeOffAction(
              requireToken(token),
              target.branchId,
              target.id,
              'decide',
              target.decide,
            ),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'rotaChanged', branchOf(variables)),
  });
}

/** Swaps: ask a colleague, the colleague's answer, cancel (the asker) or decide (a planner). */
export function useShiftSwap() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (
      target:
        | { branchId: string; ask: { shiftId: string; toStaffId: string; note?: string } }
        | { branchId: string; id: string; respond: boolean }
        | { branchId: string; id: string; cancel: true }
        | { branchId: string; id: string; decide: { approve: boolean; note?: string } },
    ) =>
      'ask' in target
        ? api.askSwap(requireToken(token), target.branchId, target.ask)
        : 'respond' in target
          ? api.swapAction(requireToken(token), target.branchId, target.id, 'respond', {
              accept: target.respond,
            })
          : 'cancel' in target
            ? api.swapAction(requireToken(token), target.branchId, target.id, 'cancel')
            : api.swapAction(
                requireToken(token),
                target.branchId,
                target.id,
                'decide',
                target.decide,
              ),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'rotaChanged', branchOf(variables)),
  });
}

/** POST …/rota/copy | clear | publish {week}. */
export function useRotaWeekAction() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      action,
      week,
    }: {
      branchId: string;
      action: 'copy' | 'clear' | 'publish';
      week: string;
    }) => api.rotaWeekAction(requireToken(token), branchId, action, week),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'rotaChanged', branchOf(variables)),
  });
}
