import { TABLE_SESSION_HOURS } from '@/lib/constants';
import type { GuestSession, TableScan } from '@/types/session';

/*
 * Guest sessions. Stands in for the backend call
 *
 *   POST /sessions { table, qrToken } → { sessionId, table, startedAt, expiresAt }
 *
 * where the server checks the signed QR token, opens a session for the table and
 * decides when it expires. Until then the session is made here, synchronously. With a
 * real backend this becomes an async `useMutation` that GuestSessionContext awaits
 * before saving the session (the rest of the app only reads the saved session).
 */

const HOUR = 3_600_000;

/** A random id: a UUID where the browser offers one (secure contexts only), else 128 random bits. */
function newSessionId(): string {
  const { crypto } = globalThis;
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto?.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Opens a new guest session at a table (mock of POST /sessions). */
export function startGuestSession({ table, qrToken }: TableScan, now = Date.now()): GuestSession {
  return {
    id: newSessionId(),
    table,
    startedAt: now,
    expiresAt: now + TABLE_SESSION_HOURS * HOUR,
    ...(qrToken ? { qrToken } : {}),
  };
}
