'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useBranches } from '@/api/hooks';
import { isAdminSignedIn, selectAdminBranch, selectedAdminBranch } from '@/lib/adminAuth';

const subscribe = () => () => {};

export function AdminAccess({ children }: { children: ReactNode }) {
  const branches = useBranches();
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const signedIn = hydrated && isAdminSignedIn();
  const selected = hydrated ? selectedAdminBranch(branches) : undefined;
  const needsBranch = pathname === '/admin/dashboard' && branches.length > 1 && !selected;
  const needsSingleBranchRedirect = pathname === '/admin/select-branch' && branches.length === 1;

  useEffect(() => {
    if (!hydrated) return;
    if (!signedIn) {
      router.replace('/admin/login/');
      return;
    }

    if (branches.length === 1) {
      selectAdminBranch(branches[0].id);
      if (needsSingleBranchRedirect) {
        router.replace('/admin/dashboard/');
        return;
      }
    } else if (needsBranch) {
      router.replace('/admin/select-branch/');
    }
  }, [branches, hydrated, needsBranch, needsSingleBranchRedirect, router, signedIn]);

  const allowed = hydrated && signedIn && !needsBranch && !needsSingleBranchRedirect;
  return allowed ? children : null;
}
