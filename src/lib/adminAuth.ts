import type { AdminSession } from '@/types/admin';
import { readJSON, removeKey, writeJSON } from './storage';

const SESSION_KEY = 'olive.admin.session.v1';
const BRANCH_KEY = 'olive.admin.branch.v1';

const isString = (v: unknown): v is string => typeof v === 'string';

/* ---------- Change notifications (this tab and other tabs) ---------- */

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const onStorage = (event: StorageEvent) => {
  if (event.key === null || event.key === SESSION_KEY || event.key === BRANCH_KEY) notify();
};

/**
 * Calls `listener` whenever the session or the selected branch changes, here or in another
 * tab; returns the unsubscribe function (for useSyncExternalStore).
 */
export function subscribeAdminSession(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

/* ---------- Session ---------- */

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
  notify();
}

/** The stored session while it hasn't expired, else null. */
export function adminSession(now = Date.now()): AdminSession | null {
  const session = readJSON(SESSION_KEY, isAdminSession);
  return session && session.expiresAt > now ? session : null;
}

export const isAdminSignedIn = (now = Date.now()): boolean => adminSession(now) !== null;

/** The bearer token for admin requests while signed in, else null. */
export const adminToken = (): string | null => adminSession()?.token ?? null;

/** The signed-in admin's name, as the server sent it. */
export function adminUsername(): string | undefined {
  return adminSession()?.admin.name.trim() || undefined;
}

/* ---------- Selected branch ---------- */

/** Remembers the branch the admin works in (and marks it "Last used" in the branch picker). */
export function selectAdminBranch(branchId: string) {
  try {
    window.localStorage.setItem(BRANCH_KEY, branchId);
  } catch {
    // Blocked storage: the choice lasts until the page reloads.
  }
  notify();
}

/** The id of the branch last selected on this device, if any. */
export function selectedAdminBranchId(): string | null {
  try {
    return window.localStorage.getItem(BRANCH_KEY);
  } catch {
    return null;
  }
}

/** The selected branch among these, if it's one of them. */
export function selectedAdminBranch<T extends { id: string }>(
  branches: readonly T[],
): T | undefined {
  const id = selectedAdminBranchId();
  return branches.find((branch) => branch.id === id);
}

export function signOutAdmin() {
  removeKey(SESSION_KEY);
  removeKey(BRANCH_KEY);
  notify();
}
