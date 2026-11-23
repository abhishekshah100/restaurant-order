'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { ActiveBranchContext } from '@/api/activeBranch';

/** The link's branch only changes with a new page load. */
const noChange = () => () => undefined;
const BRANCH_ID = /^[a-z0-9-]{1,64}$/;

/** `?branch=<id>` on the sign-in link, when it's a branch id; null otherwise (and when prerendered). */
function linkedBranch(): string | null {
  const id = new URLSearchParams(window.location.search).get('branch');
  return id && BRANCH_ID.test(id) ? id : null;
}

/**
 * The staff sign-in under the brand of the branch its link names (`/admin/login/?branch=<id>`,
 * as the developer setup page gives a client's staff), instead of the default branch's. An
 * unknown id falls back to the default, as everywhere.
 */
export function LoginBranch({ children }: { children: ReactNode }) {
  const branchId = useSyncExternalStore(noChange, linkedBranch, () => null);
  return <ActiveBranchContext.Provider value={branchId}>{children}</ActiveBranchContext.Provider>;
}
