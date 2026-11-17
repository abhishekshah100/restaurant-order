'use client';

import { useEffect } from 'react';
import { isBackendEnabled } from '@/api/backend';
import { api } from '@/api/endpoints';
import { adminSession, extendAdminSession } from '@/lib/adminAuth';
import { IDLE_LIMIT_MS, localStore, readLastActive } from '@/lib/idleSignOut';

/** How often a sign-in in use is renewed. */
export const RENEW_EVERY_MS = 30 * 60_000;

/**
 * Keeps a sign-in in use from ending mid-service: every half hour, while this device's staff
 * screens are being used (lib/idleSignOut: a tap on an admin page, or a kitchen screen open and
 * on screen), the server renews it (POST /admin/sessions/current/renew), up to a day after
 * signing in. A device nobody uses isn't renewed, and signs out as before. Backend only (the
 * mock's sign-in doesn't end). Mounted once, under every staff page (WorkspaceGate).
 */
export function SessionRenewal() {
  useEffect(() => {
    if (!isBackendEnabled()) return;
    const renew = async () => {
      const session = adminSession();
      const lastUse = readLastActive(localStore());
      if (!session || lastUse === null || Date.now() - lastUse > IDLE_LIMIT_MS) return;
      try {
        const { expiresAt } = await api.renewAdminSession(session.token);
        extendAdminSession(session.token, expiresAt);
      } catch {
        // Offline, or the sign-in has ended: the next try, or the sign-in page, follows.
      }
    };
    // Opened late in a sign-in (under an hour left): renewed at once, not in half an hour.
    const session = adminSession();
    if (session && session.expiresAt - Date.now() < 2 * RENEW_EVERY_MS) void renew();
    const timer = setInterval(() => void renew(), RENEW_EVERY_MS);
    return () => clearInterval(timer);
  }, []);
  return null;
}
