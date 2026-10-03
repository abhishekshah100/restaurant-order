import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TABLE_SESSION_HOURS } from '@/lib/constants';
import { STORAGE_KEYS } from '@/lib/storage';
import type { GuestSession } from '@/types/session';
import { ApiTestProvider, seedGuestSession, testRestaurant } from '../apiState';

const { defaultTable } = testRestaurant();

const HOUR = 3_600_000;

/** Opens the app at `url`: the session is resolved once per page load, so each gets a fresh module. */
async function openPage(url = '/') {
  window.history.replaceState(null, '', url);
  vi.resetModules();
  const { GuestSessionProvider, useGuestSession, useTableContext } =
    await import('@/context/GuestSessionContext');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiTestProvider>
      <GuestSessionProvider>{children}</GuestSessionProvider>
    </ApiTestProvider>
  );
  const { result } = renderHook(() => ({ session: useGuestSession(), table: useTableContext() }), {
    wrapper,
  });
  const { session, table } = result.current;
  if (!session) throw new Error('expected a guest session');
  return { session, table };
}

const stored = () =>
  JSON.parse(window.localStorage.getItem(STORAGE_KEYS.session) ?? 'null') as GuestSession | null;

describe('GuestSessionProvider', () => {
  beforeEach(() => vi.useFakeTimers({ now: 10 * 24 * HOUR, toFake: ['Date'] }));
  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
  });

  it('starts a session for the scanned table and saves it', async () => {
    const { session, table } = await openPage('/?table=7');
    expect(table).toBe(7);
    expect(session).toMatchObject({
      table: 7,
      startedAt: Date.now(),
      expiresAt: Date.now() + TABLE_SESSION_HOURS * HOUR,
    });
    expect(session.id).not.toBe('');
    expect(stored()).toEqual(session);
  });

  it('keeps the session when the same table is scanned again (or the page is refreshed)', async () => {
    const first = await openPage('/?table=7');
    vi.setSystemTime(Date.now() + HOUR);
    expect((await openPage('/?table=7')).session).toEqual(first.session);
  });

  it('starts a new session for a different table', async () => {
    const first = await openPage('/?table=7');
    const { session, table } = await openPage('/?table=5');
    expect(table).toBe(5);
    expect(session.id).not.toBe(first.session.id);
    expect(stored()).toEqual(session);
  });

  it('starts a new session once the saved one has expired', async () => {
    const first = await openPage('/?table=7');
    vi.setSystemTime(first.session.expiresAt);
    const { session } = await openPage('/?table=7');
    expect(session.id).not.toBe(first.session.id);
    expect(session.startedAt).toBe(Date.now());
  });

  it('reuses the saved session when the link has no table', async () => {
    const saved = seedGuestSession({ table: 9 });
    const { session, table } = await openPage('/menu/');
    expect(session).toEqual(saved);
    expect(table).toBe(9);
  });

  it('starts a session at the default table when there is none', async () => {
    const { session, table } = await openPage('/menu/');
    expect(table).toBe(defaultTable);
    expect(session.table).toBe(defaultTable);
    expect(stored()).toEqual(session);
  });

  it('ignores the old saved table', async () => {
    window.localStorage.setItem(
      'olive.table.v1',
      JSON.stringify({ table: 7, savedAt: Date.now() }),
    );
    const { table } = await openPage();
    expect(table).toBe(defaultTable);
  });

  it('ignores malformed saved sessions and invalid table numbers', async () => {
    window.localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ id: 'x', table: 1000 }));
    expect((await openPage()).table).toBe(defaultTable);
    expect((await openPage('/?table=1000')).table).toBe(defaultTable);
    expect((await openPage('/?table=0')).table).toBe(defaultTable);
  });

  it('keeps the QR token with the session', async () => {
    expect((await openPage('/?table=7&qr=abc.DEF-123_x')).session.qrToken).toBe('abc.DEF-123_x');
    expect((await openPage('/?table=8&qr=<script>')).session.qrToken).toBeUndefined();
  });
});
