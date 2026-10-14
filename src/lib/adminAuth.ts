import type { AdminSession } from '@/types/admin';
import type { Branch } from '@/types/branch';
import { readJSON, removeKey, writeJSON } from './storage';

const SESSION_KEY = 'olive.admin.session.v1';
const BRANCH_KEY = 'olive.admin.branch.v1';

const isString = (v: unknown): v is string => typeof v === 'string';

/** A stored value shaped like the session POST /admin/sessions returns. */
export function isAdminSession(value: unknown): value is AdminSession {
  if (typeof value !== 'object' || value === null) return false;
  const { token, admin, expiresAt } = value as Partial<AdminSession>;
  return (
    isString(token) &&
    token !== '' &&
    typeof expiresAt === 'number' &&
    typeof admin === 'object' &&
    admin !== null &&
    isString(admin.name) &&
    isString(admin.email) &&
    isString(admin.phone)
  );
}

/** Keeps the session the server returned on this device. */
export function signInAdmin(session: AdminSession) {
  writeJSON(SESSION_KEY, session);
}

/** The stored session while it hasn't expired, else null. */
export function adminSession(now = Date.now()): AdminSession | null {
  const session = readJSON(SESSION_KEY, isAdminSession);
  return session && session.expiresAt > now ? session : null;
}

export const isAdminSignedIn = (now = Date.now()): boolean => adminSession(now) !== null;

/** The signed-in admin's name, as the server sent it. */
export function adminUsername(): string | undefined {
  return adminSession()?.admin.name.trim() || undefined;
}

export function selectAdminBranch(branchId: string) {
  window.localStorage.setItem(BRANCH_KEY, branchId);
}

export function selectedAdminBranch(branches: readonly Branch[]): Branch | undefined {
  const id = window.localStorage.getItem(BRANCH_KEY);
  return branches.find((branch) => branch.id === id);
}

export function signOutAdmin() {
  removeKey(SESSION_KEY);
  removeKey(BRANCH_KEY);
}
