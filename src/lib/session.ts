import type { GuestSession } from '@/types/session';
import { isOrderMode } from './fulfilment';

/**
 * A session as saved on the device. One from before branches has no `branchId` (it was at the
 * default branch); one from before order modes has no `mode` (it was dine-in, at its table).
 */
export type SavedSession = Omit<GuestSession, 'branchId' | 'mode'> & {
  branchId?: string;
  mode?: GuestSession['mode'];
};

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isOptional = (v: unknown, type: 'string' | 'number') => v === undefined || typeof v === type;

/** Runtime guard for a saved guest session. */
export function isSavedSession(v: unknown): v is SavedSession {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<keyof GuestSession, unknown>;
  const mode = s.mode ?? 'dineIn';
  return (
    typeof s.id === 'string' &&
    s.id !== '' &&
    isOptional(s.branchId, 'string') &&
    isOrderMode(mode) &&
    isOptional(s.table, 'number') &&
    (s.table === undefined || Number.isInteger(s.table)) &&
    // Dine-in is at a table.
    (mode !== 'dineIn' || s.table !== undefined) &&
    isOptional(s.deliveryArea, 'string') &&
    isFiniteNumber(s.startedAt) &&
    isFiniteNumber(s.expiresAt) &&
    s.expiresAt > s.startedAt &&
    isOptional(s.qrToken, 'string')
  );
}

/** A saved session with its branch (the default one for sessions from before branches) and mode. */
export const fromSaved = (saved: SavedSession, defaultBranchId: string): GuestSession => ({
  ...saved,
  branchId: saved.branchId ?? defaultBranchId,
  mode: saved.mode ?? 'dineIn',
});

/** Runtime guard for a full guest session (as POST /sessions returns it). */
export const isGuestSession = (v: unknown): v is GuestSession =>
  isSavedSession(v) && typeof v.branchId === 'string' && v.mode !== undefined;

/** Between its start and its expiry. */
export const isLiveSession = (
  session: Pick<GuestSession, 'startedAt' | 'expiresAt'>,
  now: number,
) => now >= session.startedAt && now < session.expiresAt;
