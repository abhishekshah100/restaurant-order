import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TABLE_SESSION_HOURS } from '@/api/mock/rules';
import { STORAGE_KEYS } from '@/lib/storage';
import type { GuestSession } from '@/types/session';
import { ApiTestProvider, seedGuestSession, testBranch } from '../apiState';

const { id: defaultBranchId } = testBranch();
const nepal = testBranch('ktm-thamel');

const HOUR = 3_600_000;

/**
 * Opens the app at `url` and waits for its session (a new one comes from POST /sessions): the
 * session is resolved once per page load, so each gets a fresh module.
 */
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
  // The first request loads the mock server, which can take a moment in a fresh module graph.
  await waitFor(() => expect(result.current.session).not.toBeNull(), { timeout: 5000 });
  const { session, table } = result.current;
  if (!session) throw new Error('expected a guest session');
  return { session, table, result };
}

/** Opens the app at `url` where no session follows: the start screen, with what the link chose. */
async function openStart(url = '/') {
  window.history.replaceState(null, '', url);
  vi.resetModules();
  const { GuestSessionProvider, useGuestSession, useVisit } =
    await import('@/context/GuestSessionContext');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiTestProvider>
      <GuestSessionProvider>{children}</GuestSessionProvider>
    </ApiTestProvider>
  );
  const { result } = renderHook(() => ({ session: useGuestSession(), visit: useVisit() }), {
    wrapper,
  });
  await waitFor(() => expect(result.current.visit.needsStart).toBe(true));
  expect(result.current.session).toBeNull();
  return result.current.visit;
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
      branchId: defaultBranchId,
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

  it('shows the start screen when there is no session and no QR code', async () => {
    const visit = await openStart('/menu/');
    expect(visit).toMatchObject({ needsStart: true, choice: {} });
    expect(stored()).toBeNull();
  });

  it('ignores the old saved table', async () => {
    window.localStorage.setItem(
      'olive.table.v1',
      JSON.stringify({ table: 7, savedAt: Date.now() }),
    );
    await openStart();
  });

  it('ignores malformed saved sessions and invalid table numbers', async () => {
    window.localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ id: 'x', table: 1000 }));
    await openStart();
    await openStart('/?table=1000');
    await openStart('/?table=0');
  });

  it('starts a takeaway session from an ordering link, without a table', async () => {
    const { session } = await openPage('/?branch=ktm-thamel&mode=takeaway');
    expect(session).toMatchObject({ branchId: 'ktm-thamel', mode: 'takeaway' });
    expect(session.table).toBeUndefined();
  });

  it('switches the saved session to an ordering link’s mode, keeping it', async () => {
    const saved = seedGuestSession({ table: 9 });
    const { result } = await openPage('/?mode=takeaway');
    await waitFor(() => expect(result.current.session?.mode).toBe('takeaway'));
    expect(result.current.session).toMatchObject({ id: saved.id, table: 9 });
  });

  it("starts a session at the QR link's branch and table", async () => {
    const { session, table } = await openPage('/?branch=ktm-thamel&table=5');
    expect(session).toMatchObject({ branchId: 'ktm-thamel', table: 5 });
    expect(table).toBe(5);
    expect(stored()).toEqual(session);
  });

  it('starts a new session for another branch, even at the same table number', async () => {
    const india = await openPage('/?table=5');
    const { session } = await openPage('/?branch=ktm-thamel&table=5');
    expect(session.id).not.toBe(india.session.id);
    expect(session.branchId).toBe('ktm-thamel');
    // Back at the India table: another new session.
    expect((await openPage('/?table=5')).session).toMatchObject({ branchId: defaultBranchId });
  });

  it('opens the start screen at the branch when the link names only a branch', async () => {
    expect(await openStart('/?branch=ktm-thamel')).toMatchObject({
      choice: { branchId: 'ktm-thamel' },
    });
    // A session there is kept.
    const { session } = await openPage('/?branch=ktm-thamel&table=3');
    expect((await openPage('/?branch=ktm-thamel')).session.id).toBe(session.id);
  });

  it('falls back to the default branch for an unknown branch', async () => {
    const { session } = await openPage('/?branch=nowhere&table=7');
    expect(session).toMatchObject({ branchId: defaultBranchId, table: 7 });
  });

  it("ignores a table outside the branch's range", async () => {
    const visit = await openStart(`/?branch=ktm-thamel&table=${nepal.tables.last + 1}`);
    expect(visit.choice).toEqual({ branchId: 'ktm-thamel' });
  });

  it('keeps a session saved before branches, at the default branch', async () => {
    const { branchId: _branch, ...legacy } = seedGuestSession({ table: 9 });
    window.localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(legacy));
    const { session } = await openPage('/menu/');
    expect(session).toEqual({ ...legacy, branchId: defaultBranchId });
  });

  it('keeps the QR token with the session', async () => {
    expect((await openPage('/?table=7&qr=abc.DEF-123_x')).session.qrToken).toBe('abc.DEF-123_x');
    expect((await openPage('/?table=8&qr=<script>')).session.qrToken).toBeUndefined();
  });

  it('shows the scanned table while its session opens, and opens it after a reload', async () => {
    window.history.replaceState(null, '', '/?table=7');
    vi.resetModules();
    const { GuestSessionProvider, useGuestSession, useTableContext } =
      await import('@/context/GuestSessionContext');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApiTestProvider>
        <GuestSessionProvider>{children}</GuestSessionProvider>
      </ApiTestProvider>
    );
    const { result, unmount } = renderHook(
      () => ({ session: useGuestSession(), table: useTableContext() }),
      { wrapper },
    );
    // Before POST /sessions answers: the scanned table, no session yet.
    expect(result.current).toEqual({ session: null, table: 7 });
    // The page is left before the answer: the next load (without the link) opens it.
    unmount();
    const { session } = await openPage('/menu/');
    expect(session.table).toBe(7);
    expect(window.sessionStorage.getItem(STORAGE_KEYS.pendingScan)).toBeNull();
  });
});
