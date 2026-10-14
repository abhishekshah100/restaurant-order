'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isApiError } from '@/api/client';
import { useAdminBranches } from '@/api/hooks';
import { useHydrated } from '@/hooks/useHydrated';
import { useAdminToken, useSelectedAdminBranchId, useSignOutAdmin } from '@/hooks/useAdminSession';
import { adminAccess, adminPage } from '@/lib/adminBranches';
import { selectAdminBranch } from '@/lib/adminAuth';

/**
 * Guards the admin pages: signed in, and on the dashboard a selected branch among the ones
 * the admin manages (GET /admin/branches; see lib/adminBranches › adminAccess). Shows
 * `fallback` until the page may show (prerender, hydration, loading, redirecting).
 */
export function AdminAccess({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const hydrated = useHydrated();
  const token = useAdminToken();
  const branches = useAdminBranches();
  const selectedId = useSelectedAdminBranchId();
  const signOut = useSignOutAdmin();
  const pathname = usePathname();
  const router = useRouter();

  const page = adminPage(pathname);
  const unauthorized = isApiError(branches.error, 'unauthorized');
  const failed = branches.isError && !unauthorized;
  const decision = useMemo(
    () =>
      adminAccess({
        page,
        signedIn: token !== null,
        branches: branches.data,
        failed,
        unauthorized,
        selectedId,
      }),
    [branches.data, failed, page, selectedId, token, unauthorized],
  );

  useEffect(() => {
    if (!hydrated) return;
    if (decision.kind === 'select') selectAdminBranch(decision.branchId);
    if (decision.kind !== 'redirect') return;
    if (decision.signOut) signOut();
    if (decision.select) selectAdminBranch(decision.select);
    router.replace(decision.to);
  }, [decision, hydrated, router, signOut]);

  return hydrated && decision.kind === 'allow' ? children : fallback;
}
