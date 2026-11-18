'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminToken } from '@/hooks/useAdminSession';
import type {
  AddStaffRequest,
  ChangePasswordRequest,
  CreateBranchRequest,
  OfferRequest,
  RoleInput,
  SetBranchStatusRequest,
  UpdateBranchSettingsRequest,
  UpdateStaffRequest,
} from '../contracts';
import { api } from '../endpoints';
import { branchOf, refreshAfter } from '../refreshAfter';
import { branchSettingsQuery } from '../queries';
import { requireToken } from './shared';

/* ---------- Settings, branches, staff and offers ---------- */

/**
 * PATCH …/features (super admins): a module switched on or off for the restaurant. Everything
 * it changes is read again: permissions (the branches), the menu (dishes stock had taken off).
 */
export function useSetFeatures() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, inventory }: { branchId: string; inventory: boolean }) =>
      api.setFeatures(requireToken(token), branchId, { inventory }),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'featuresChanged', branchOf(variables)),
  });
}

/**
 * PATCH /admin/branches/:branchId/status: pause new orders, close for the day, or open again.
 * The admin's branches and the branch data guests read are read again.
 */
export function useSetBranchStatus() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: SetBranchStatusRequest }) =>
      api.setBranchStatus(requireToken(token), branchId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'branchStatusChanged', branchOf(variables)),
  });
}

/**
 * PATCH /admin/branches/:branchId/settings (a Settings page's section): the page's draft
 * becomes the saved settings at once, then the branch data is read again everywhere.
 */
export function useUpdateBranchSettings() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: UpdateBranchSettingsRequest }) =>
      api.updateBranchSettings(requireToken(token), branchId, body),
    onSuccess: (saved, { branchId }) =>
      client.setQueryData(branchSettingsQuery(token, branchId).queryKey, saved),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'branchSetupChanged', branchOf(variables)),
  });
}

/** POST /admin/branches (Settings › Branches › Add branch). */
export function useCreateBranch() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (body: CreateBranchRequest) => api.createBranch(requireToken(token), body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'branchSetupChanged', branchOf(variables)),
  });
}

/** DELETE /admin/branches/:branchId (Settings › Branches › Remove). */
export function useRemoveBranch() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (branchId: string) => api.removeBranch(requireToken(token), branchId),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'branchSetupChanged', branchOf(variables)),
  });
}

/** Offers changed: Settings › Offers lists them again, and the menu's prices follow. */
/** POST …/staff (no `id`) or PATCH …/staff/:staffId. */
export function useSaveStaff() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (
      target:
        | { branchId: string; id?: undefined; body: AddStaffRequest }
        | { branchId: string; id: string; body: UpdateStaffRequest },
    ) =>
      target.id === undefined
        ? api.addStaff(requireToken(token), target.branchId, target.body)
        : api.updateStaff(requireToken(token), target.branchId, target.id, target.body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'staffChanged', branchOf(variables)),
  });
}

/** POST …/staff/:staffId/password: a new password for them, changed at their next sign-in. */
export function useResetStaffPassword() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, password }: { branchId: string; id: string; password: string }) =>
      api.resetStaffPassword(requireToken(token), branchId, id, { password }),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'staffChanged', branchOf(variables)),
  });
}

/** POST …/staff/:staffId/remove: removed from the team here, with why (soft; history stays). */
export function useRemoveStaff() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, reason }: { branchId: string; id: string; reason: string }) =>
      api.removeStaff(requireToken(token), branchId, id, { reason }),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'staffChanged', branchOf(variables)),
  });
}

/** POST …/staff/:staffId/restore: someone removed, back on the team. */
export function useRestoreStaff() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, roleId }: { branchId: string; id: string; roleId?: string }) =>
      api.restoreStaff(requireToken(token), branchId, id, roleId ? { roleId } : {}),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'staffChanged', branchOf(variables)),
  });
}

/** PATCH /admin/sessions/current/password: one's own password (the first sign-in's step too). */
export function useChangeOwnPassword() {
  const token = useAdminToken();
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) => api.changeOwnPassword(requireToken(token), body),
  });
}

/** POST …/roles (no `id`) or PATCH …/roles/:roleId: a role of the restaurant's own. */
export function useSaveRole() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, body }: { branchId: string; id?: string; body: RoleInput }) =>
      id
        ? api.updateRole(requireToken(token), branchId, id, body)
        : api.createRole(requireToken(token), branchId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'rolesChanged', branchOf(variables)),
  });
}

/** DELETE …/roles/:roleId: one of the restaurant's own nobody holds. */
export function useRemoveRole() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id }: { branchId: string; id: string }) =>
      api.removeRole(requireToken(token), branchId, id),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'rolesChanged', branchOf(variables)),
  });
}

/** POST or PATCH …/offers: a new automatic offer, or one replaced in full. */
export function useSaveOffer() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, body }: { branchId: string; id?: string; body: OfferRequest }) =>
      id
        ? api.updateOffer(requireToken(token), branchId, id, body)
        : api.createOffer(requireToken(token), branchId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'offersChanged', branchOf(variables)),
  });
}

/** DELETE …/offers/:offerId. */
export function useRemoveOffer() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id }: { branchId: string; id: string }) =>
      api.removeOffer(requireToken(token), branchId, id),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'offersChanged', branchOf(variables)),
  });
}
