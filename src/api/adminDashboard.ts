'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { branchMenuQuery } from '@/api/queries';
import { createMenuCatalog } from '@/lib/menu';
import type { Branch } from '@/types/branch';

/* The branch's menu for staff screens (the Menu page, the waiter's order pad). */

/** The branch's menu catalog. */
export function useBranchMenu(branch: Branch) {
  const query = useQuery(branchMenuQuery(branch.id));
  const menu = useMemo(
    () => (query.data ? createMenuCatalog(query.data) : undefined),
    [query.data],
  );
  return { menu, loading: query.isPending, error: query.error };
}
