'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { api } from '@/api/endpoints';
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

/**
 * Signs out: ends the session on the server (so its token stops working everywhere), forgets
 * it and the selected branch here, and drops cached admin data. Signing out never waits for the
 * server or fails because of it: the device forgets the session either way.
 */
export function useSignOutAdmin(): () => void {
  const client = useQueryClient();
  return useCallback(() => {
    const token = adminToken();
    if (token) void api.endAdminSession(token).catch(() => undefined);
    signOutAdmin();
    client.removeQueries({ queryKey: ['admin'] });
  }, [client]);
}
