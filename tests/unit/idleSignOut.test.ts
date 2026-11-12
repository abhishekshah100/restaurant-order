import { describe, expect, it } from 'vitest';
import {
  ACTIVE_KEY,
  clearIdleSignOut,
  IDLE_LIMIT_MS,
  idleState,
  noteIdleSignOut,
  readLastActive,
  signedOutIdle,
  writeLastActive,
} from '@/lib/idleSignOut';

/* Signing out a staff screen nobody is using. */

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
};

describe('idle sign-out', () => {
  const last = 1_000_000;

  it('stays signed in while used, warns in the last minute, then signs out', () => {
    expect(idleState(last + 5 * 60_000, last)).toEqual({ kind: 'active' });
    expect(idleState(last + IDLE_LIMIT_MS - 60_001, last)).toEqual({ kind: 'active' });
    expect(idleState(last + IDLE_LIMIT_MS - 60_000, last)).toEqual({
      kind: 'warning',
      secondsLeft: 60,
    });
    expect(idleState(last + IDLE_LIMIT_MS - 1_500, last)).toEqual({
      kind: 'warning',
      secondsLeft: 2,
    });
    expect(idleState(last + IDLE_LIMIT_MS, last)).toEqual({ kind: 'expired' });
    // Nothing written yet: counts as just used.
    expect(idleState(last, null)).toEqual({ kind: 'active' });
  });

  it('keeps the last use on the device and says why it signed out until the next sign-in', () => {
    const storage = memoryStorage();
    expect(readLastActive(storage)).toBeNull();
    writeLastActive(storage, last);
    expect(readLastActive(storage)).toBe(last);
    storage.setItem(ACTIVE_KEY, 'not a time');
    expect(readLastActive(storage)).toBeNull();

    expect(signedOutIdle(storage)).toBe(false);
    noteIdleSignOut(storage);
    expect(signedOutIdle(storage)).toBe(true);
    clearIdleSignOut(storage);
    expect(signedOutIdle(storage)).toBe(false);
    // Blocked storage never throws.
    expect(readLastActive(null)).toBeNull();
    expect(signedOutIdle(null)).toBe(false);
  });
});
