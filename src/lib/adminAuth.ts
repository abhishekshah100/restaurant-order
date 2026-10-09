import type { Branch } from '@/types/branch';

const AUTH_KEY = 'olive.admin.auth.v1';
const BRANCH_KEY = 'olive.admin.branch.v1';

/** Temporary browser-only admin state until the authentication API is available. */
export function signInAdmin() {
  window.localStorage.setItem(AUTH_KEY, 'true');
}

export function isAdminSignedIn(): boolean {
  return window.localStorage.getItem(AUTH_KEY) === 'true';
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
}
