'use client';

import { isBackendEnabled } from '@/api/backend';
import { useFeatures } from '@/api/hooks';
import { useAdminWorkspace } from '../shell/AdminWorkspace';

/**
 * Whether the signed-in staff member is the platform (a super admin): the server says so with
 * the restaurant's features (`canChange`). Only they see Settings › Modules.
 */
export function usePlatformAdmin(): boolean {
  const { branch } = useAdminWorkspace();
  return useFeatures(branch.id, isBackendEnabled()).data?.canChange ?? false;
}
