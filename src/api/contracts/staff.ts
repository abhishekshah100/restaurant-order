import type {
  AdminRole,
  AdminStaffMember,
  RemovedStaffMember,
  StaffPermission,
  StaffScope,
} from '@/types/admin';

/* ---------- Staff and roles ---------- */

/**
 * `GET /admin/branches/:branchId/roles` — the roles the restaurant gives its staff (built in,
 * read-only; and its own) and every permission there is. Needs `staff.manage`. 200 → this.
 */
export interface RolesResponse {
  roles: AdminRole[];
  /** Every permission, and what each needs: a role with it is saved with those too. */
  permissions: { key: StaffPermission; description: string; needs: StaffPermission[] }[];
}

/**
 * `POST /admin/branches/:branchId/roles` — a role of the restaurant's own (201 → `AdminRole`) —
 * and `PATCH …/roles/:roleId` — one of its own, sent whole (200). `DELETE …/roles/:roleId` →
 * 204. Needs `staff.manage`. Errors: 400 invalid_request, 403 forbidden (a permission the one
 * granting doesn't hold), 404, 409 role_system (built in), 409 role_in_use (`staff`: how many
 * hold it; delete only).
 */
export interface RoleInput {
  name: string;
  description?: string;
  permissions: StaffPermission[];
  /** The most its staff may take off a bill by hand (basis points, 0–10000). Server only. */
  discountLimitBp?: number;
}

/**
 * `GET /admin/branches/:branchId/staff` — everyone with a role here (the branch's, and the
 * restaurant's admins) and the roles they can be given. Needs `staff.manage`. 200 → this.
 */
export interface StaffResponse {
  staff: AdminStaffMember[];
  /** Removed from the team here (soft) and not added back, newest first. */
  removed: RemovedStaffMember[];
  roles: { id: string; name: string; scope: StaffScope }[];
}

/**
 * `POST /admin/branches/:branchId/staff` — someone on the staff here: a new account with this
 * password (changed at their first sign-in), or an account the email has, given the role here.
 * 201 → `AdminStaffMember`. Errors: 400 (`field`: phone, roleId), 403 (a role with permissions
 * the one adding doesn't hold), 409 staff_exists (`field`: email — already here; phone —
 * someone else's).
 */
export interface AddStaffRequest {
  name: string;
  email: string;
  /** National digits, by the branch's mobile rules. */
  phone: string;
  roleId: string;
  /** At least 8 characters. */
  password: string;
}

/**
 * `PATCH /admin/branches/:branchId/staff/:staffId` — a new name, sign-in email or mobile number
 * (either signs them out everywhere but one's own device), a role here, on or off (off signs
 * them out everywhere and frees their tables). 200 → `AdminStaffMember`. Errors: 400 (`field`:
 * phone), 403, 404, 409 staff_exists (the email or number is someone else's), 409 own_account
 * (one's own role or status), 409 last_admin (the restaurant's only active admin).
 *
 * `POST …/staff/:staffId/remove` (`RemoveStaffRequest`) — removed from the team here (soft: their
 * history stays; signed out and switched off when they have no role anywhere else). 204.
 * Errors: 400 (no reason), 403, 404, 409 own_account, 409 last_admin.
 */
export interface UpdateStaffRequest {
  name?: string;
  email?: string;
  /** National digits, by the branch's mobile rules. */
  phone?: string;
  roleId?: string;
  /** Needed with `active: false`: why their sign-in is turned off (3–300 characters). */
  reason?: string;
  active?: boolean;
}

/**
 * `POST /admin/branches/:branchId/staff/:staffId/restore` — someone removed from here, back with
 * the role they had (or `roleId`). 200 → `AdminStaffMember`. Errors: 400 roleId (their old role
 * is gone), 403, 404.
 */
export interface RemoveStaffRequest {
  /** Why (3–300 characters). */
  reason: string;
}

export interface RestoreStaffRequest {
  roleId?: string;
}

/**
 * `POST /admin/branches/:branchId/staff/:staffId/password` — a new password for them, changed
 * at their next sign-in; signed out everywhere now. 204. Errors: 403, 404, 409 own_account.
 * `PATCH /admin/sessions/current/password` (`ChangePasswordRequest`) — one's own: 204; 401
 * wrong_password.
 */
export interface ResetStaffPasswordRequest {
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  /** At least 8 characters. */
  newPassword: string;
}
