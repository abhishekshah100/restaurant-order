'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import {
  adminToken,
  adminUsername,
  selectedAdminBranchId,
  signOutAdmin,
  subscribeAdminSession,
} from '@/lib/adminAuth';

/*
 * The admin session on this device (lib/adminAuth), kept in sync with sign-in, sign-out and
 * branch changes in this tab and others. Nothing on the server render or the hydration pass:
 * gate admin screens with useHydrated so they never mismatch.
 */

const none = () => null;

/** The bearer token while signed in, else null. */
export const useAdminToken = (): string | null =>
  useSyncExternalStore(subscribeAdminSession, adminToken, none);

/** The signed-in admin's name. */
export const useAdminName = (): string | undefined =>
  useSyncExternalStore(subscribeAdminSession, adminUsername, () => undefined);

/** The branch the admin last selected on this device. */
export const useSelectedAdminBranchId = (): string | null =>
  useSyncExternalStore(subscribeAdminSession, selectedAdminBranchId, none);

/** Signs out: forgets the session and the selected branch, and drops cached admin data. */
export function useSignOutAdmin(): () => void {
  const client = useQueryClient();
  return useCallback(() => {
    signOutAdmin();
    client.removeQueries({ queryKey: ['admin'] });
  }, [client]);
}
