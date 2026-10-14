import type { Branch } from '@/types/branch';

const AUTH_KEY = 'olive.admin.auth.v1';
const BRANCH_KEY = 'olive.admin.branch.v1';
const IDENTITY_KEY = 'olive.admin.identity.v1';

/** Temporary browser-only admin state until the authentication API is available. */
export function signInAdmin(identity: string) {
  window.localStorage.setItem(AUTH_KEY, 'true');
  window.localStorage.setItem(IDENTITY_KEY, identity.trim());
}

export function isAdminSignedIn(): boolean {
  return window.localStorage.getItem(AUTH_KEY) === 'true';
}

export function adminUsername(): string | undefined {
  const identity = window.localStorage.getItem(IDENTITY_KEY)?.trim();
  if (!identity || !identity.includes('@')) return undefined;

  return identity
    .split('@', 1)[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(' ');
}

export function selectAdminBranch(branchId: string) {
  window.localStorage.setItem(BRANCH_KEY, branchId);
}

export function selectedAdminBranch(branches: readonly Branch[]): Branch | undefined {
  const id = window.localStorage.getItem(BRANCH_KEY);
  return branches.find((branch) => branch.id === id);
}

export function signOutAdmin() {
  window.localStorage.removeItem(AUTH_KEY);
  window.localStorage.removeItem(BRANCH_KEY);
  window.localStorage.removeItem(IDENTITY_KEY);
}
