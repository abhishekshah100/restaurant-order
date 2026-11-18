import type { AdminBranch, AdminSession } from '@/types/admin';

/* ---------- Admin sessions ---------- */

/**
 * `POST /admin/sessions` — a staff member signs in with their email or mobile number
 * (`identity`, as typed: the server decides whether it matches an account) and password.
 * 201 → the session (`token` for admin requests, the admin's profile, `expiresAt`). Errors:
 * 400 invalid_request, 401 invalid_credentials (unknown identity or wrong password; the server
 * doesn't say which).
 */
export interface AdminSignInRequest {
  identity: string;
  password: string;
}

export type AdminSignInResponse = AdminSession;

/**
 * `POST /admin/sessions/current/renew` — a sign-in in use (the kitchen screen all service, an
 * admin page being worked on) lasts on: its new end (ms since epoch), the session length from
 * now but never past a day after signing in. Errors: 401 once it has ended. Backend only.
 */
export interface RenewSessionResponse {
  expiresAt: number;
}

/**
 * `DELETE /admin/sessions/current` — signs out: the session's token stops working at once, on
 * every device that holds it. No body. 204. Errors: 401 unauthorized.
 */

/**
 * `GET /admin/branches` — the branches the signed-in admin manages (not every branch), with
 * what the branch picker shows. Authorised by the session: `Authorization: Bearer <token>`.
 * 200 → `{ branches }` in the account's order. One branch: the app selects it and opens the
 * dashboard; several: the admin picks one. Errors: 401 unauthorized (no token, an unknown
 * token, or the session has expired).
 */
export interface AdminBranchesResponse {
  branches: AdminBranch[];
}
