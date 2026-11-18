import type { AdminRole, AdminStaffMember } from '@/types/admin';
import { apiDelete, apiGet, apiPatch, apiPost } from '../client';
import type {
  AddStaffRequest,
  AdminSignInRequest,
  AdminSignInResponse,
  ChangePasswordRequest,
  ResetStaffPasswordRequest,
  RemoveStaffRequest,
  RestoreStaffRequest,
  RoleInput,
  RolesResponse,
  StaffResponse,
  RenewSessionResponse,
  UpdateStaffRequest,
} from '../contracts';
import { bearer, seg } from './shared';

/** Staff accounts, sign-in and roles. */
export const staffApi = {
  createAdminSession: (body: AdminSignInRequest) =>
    apiPost<AdminSignInResponse>('admin/sessions', body),
  endAdminSession: (token: string) => apiDelete('admin/sessions/current', bearer(token)),
  renewAdminSession: (token: string) =>
    apiPost<RenewSessionResponse>('admin/sessions/current/renew', {}, bearer(token)),
  changeOwnPassword: (token: string, body: ChangePasswordRequest) =>
    apiPatch<void>('admin/sessions/current/password', body, bearer(token)),
  staff: (token: string, branchId: string) =>
    apiGet<StaffResponse>(`admin/branches/${seg(branchId)}/staff`, bearer(token)),
  addStaff: (token: string, branchId: string, body: AddStaffRequest) =>
    apiPost<AdminStaffMember>(`admin/branches/${seg(branchId)}/staff`, body, bearer(token)),
  updateStaff: (token: string, branchId: string, id: string, body: UpdateStaffRequest) =>
    apiPatch<AdminStaffMember>(
      `admin/branches/${seg(branchId)}/staff/${seg(id)}`,
      body,
      bearer(token),
    ),
  resetStaffPassword: (
    token: string,
    branchId: string,
    id: string,
    body: ResetStaffPasswordRequest,
  ) =>
    apiPost<void>(`admin/branches/${seg(branchId)}/staff/${seg(id)}/password`, body, bearer(token)),
  removeStaff: (token: string, branchId: string, id: string, body: RemoveStaffRequest) =>
    apiPost<void>(`admin/branches/${seg(branchId)}/staff/${seg(id)}/remove`, body, bearer(token)),
  restoreStaff: (token: string, branchId: string, id: string, body: RestoreStaffRequest) =>
    apiPost<AdminStaffMember>(
      `admin/branches/${seg(branchId)}/staff/${seg(id)}/restore`,
      body,
      bearer(token),
    ),
  roles: (token: string, branchId: string) =>
    apiGet<RolesResponse>(`admin/branches/${seg(branchId)}/roles`, bearer(token)),
  createRole: (token: string, branchId: string, body: RoleInput) =>
    apiPost<AdminRole>(`admin/branches/${seg(branchId)}/roles`, body, bearer(token)),
  updateRole: (token: string, branchId: string, id: string, body: RoleInput) =>
    apiPatch<AdminRole>(`admin/branches/${seg(branchId)}/roles/${seg(id)}`, body, bearer(token)),
  removeRole: (token: string, branchId: string, id: string) =>
    apiDelete(`admin/branches/${seg(branchId)}/roles/${seg(id)}`, bearer(token)),
};
