/*
 * Signing out a staff screen nobody is using: staff share tablets, so a session left open would
 * let the next person give refunds or open the drawer under someone else's name. Any touch, click
 * or key on any staff tab of this device counts as use (kept on the device, so one busy tab keeps
 * the others signed in too). A minute before the limit the screen asks "Still there?"; at the
 * limit it signs out and the sign-in page says why. The kitchen display isn't signed out: it's
 * meant to stay on all service. Pure (time and storage passed in), so it's unit-tested.
 */

/** Signed out after this long with nobody using a staff screen on this device. */
export const IDLE_LIMIT_MS = 30 * 60_000;
/** "Still there?" shows this long before. */
export const IDLE_WARNING_MS = 60_000;
/** Use is written down at most this often (a scroll fires many events). */
export const ACTIVITY_THROTTLE_MS = 5_000;

export const ACTIVE_KEY = 'olive.admin.active.v1';
export const SIGNED_OUT_KEY = 'olive.admin.signedOut.v1';

export type IdleState =
  { kind: 'active' } | { kind: 'warning'; secondsLeft: number } | { kind: 'expired' };

/** Where a screen stands, from when it was last used (none recorded: just now). */
export function idleState(
  now: number,
  lastActive: number | null,
  limit = IDLE_LIMIT_MS,
  warning = IDLE_WARNING_MS,
): IdleState {
  if (lastActive === null) return { kind: 'active' };
  const left = lastActive + limit - now;
  if (left <= 0) return { kind: 'expired' };
  if (left <= warning) return { kind: 'warning', secondsLeft: Math.ceil(left / 1000) };
  return { kind: 'active' };
}

/** The last use on this device, if any. */
export function readLastActive(storage: Pick<Storage, 'getItem'> | null): number | null {
  try {
    const value = Number(storage?.getItem(ACTIVE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Writes down a use (this tab and every other staff tab see it). */
export function writeLastActive(storage: Pick<Storage, 'setItem'> | null, at: number): void {
  try {
    storage?.setItem(ACTIVE_KEY, String(at));
  } catch {
    // Blocked storage: this tab still counts its own use in memory.
  }
}

/** Forgets the use (signed out). */
export function clearLastActive(storage: Pick<Storage, 'removeItem'> | null): void {
  try {
    storage?.removeItem(ACTIVE_KEY);
  } catch {
    // ignore
  }
}

/** The device's storage, or null where it's blocked. */
export function localStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Remembers that the device signed out because nobody used it (the sign-in page says so). */
export function noteIdleSignOut(storage: Pick<Storage, 'setItem'> | null): void {
  try {
    storage?.setItem(SIGNED_OUT_KEY, 'idle');
  } catch {
    // ignore
  }
}

/** Whether the last sign-out was for nobody using the screen (until the next sign-in). */
export function signedOutIdle(storage: Pick<Storage, 'getItem'> | null): boolean {
  try {
    return storage?.getItem(SIGNED_OUT_KEY) === 'idle';
  } catch {
    return false;
  }
}

/** Forgets why the last sign-out happened (signed in again). */
export function clearIdleSignOut(storage: Pick<Storage, 'removeItem'> | null): void {
  try {
    storage?.removeItem(SIGNED_OUT_KEY);
  } catch {
    // ignore
  }
}
