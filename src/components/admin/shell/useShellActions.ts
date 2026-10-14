'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useSignOutAdmin } from '@/hooks/useAdminSession';
import { ADMIN_PATHS } from '@/lib/adminBranches';

/** Sign out (back to the login) and Switch branch (the branch picker), from any shell control. */
export function useShellActions() {
  const router = useRouter();
  const signOutAdmin = useSignOutAdmin();
  const signOut = useCallback(() => {
    signOutAdmin();
    router.replace(ADMIN_PATHS.login);
  }, [router, signOutAdmin]);
  const switchBranch = useCallback(() => router.push(ADMIN_PATHS.selectBranch), [router]);
  return { signOut, switchBranch };
}
