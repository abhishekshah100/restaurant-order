'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useRestaurant } from '@/api/hooks';
import { startGuestSession } from '@/api/session';
import { MAX_TABLE } from '@/lib/constants';
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';
import type { GuestSession, TableScan } from '@/types/session';

/**
 * Each guest gets their own session at a table, so several people at one table can
 * order separately. The QR link (/?table=12&qr=<token>) is read on the client:
 *
 * - a valid ?table with a live saved session for the same table keeps it (a re-scan or refresh);
 * - a valid ?table otherwise starts a new session for that table;
 * - no ?table reuses the live saved session, or starts one at the restaurant's default table.
 *
 * The session is saved on the device (localStorage) and followed across tabs. The cart,
 * checkout, service requests and "mine" on the bill are all scoped to its id.
 */

const listeners = new Set<() => void>();
/** The resolved session; null until the provider has read the URL and storage. */
let current: GuestSession | null = null;

function setSession(session: GuestSession) {
  if (session.id === current?.id) return;
  current = session;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => current;
const getServerSnapshot = () => null;

const isTable = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= MAX_TABLE;

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isGuestSession(v: unknown): v is GuestSession {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<keyof GuestSession, unknown>;
  return (
    typeof s.id === 'string' &&
    s.id !== '' &&
    isTable(s.table) &&
    isFiniteNumber(s.startedAt) &&
    isFiniteNumber(s.expiresAt) &&
    s.expiresAt > s.startedAt &&
    (s.qrToken === undefined || typeof s.qrToken === 'string')
  );
}

const isLive = (session: GuestSession, now: number) =>
  now >= session.startedAt && now < session.expiresAt;

/** The saved session if it hasn't expired (the in-memory one when storage is blocked). */
function liveSavedSession(now: number): GuestSession | null {
  const saved = readJSON(STORAGE_KEYS.session, isGuestSession) ?? current;
  return saved && isLive(saved, now) ? saved : null;
}

/** QR tokens are opaque (e.g. a JWT); anything else is ignored. */
const QR_TOKEN = /^[\w.~-]{1,512}$/;

/** The table (and token) from the QR link, or null when there's no valid ?table. */
function parseScan(search: string): TableScan | null {
  const params = new URLSearchParams(search);
  const raw = params.get('table');
  if (!raw || !/^\d{1,3}$/.test(raw)) return null;
  const table = Number(raw);
  if (!isTable(table)) return null;
  const qrToken = params.get('qr');
  return qrToken && QR_TOKEN.test(qrToken) ? { table, qrToken } : { table };
}

/** Keeps the live saved session when it fits the scan, otherwise starts a new one. */
function resolveSession(scan: TableScan | null, defaultTable: number, now: number): GuestSession {
  const saved = liveSavedSession(now);
  if (saved && (!scan || scan.table === saved.table)) return saved;
  const session = startGuestSession(scan ?? { table: defaultTable }, now);
  writeJSON(STORAGE_KEYS.session, session);
  return session;
}

interface GuestSessionValue {
  session: GuestSession | null;
  table: number;
}

const GuestSessionContext = createContext<GuestSessionValue | null>(null);

export function GuestSessionProvider({ children }: { children: ReactNode }) {
  const { defaultTable } = useRestaurant();
  // The prerendered HTML (and so the first client render) has no session yet.
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    setSession(resolveSession(parseScan(window.location.search), defaultTable, Date.now()));
  }, [defaultTable]);

  // Another tab scanned a QR code: this device now has that guest session.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEYS.session) return;
      const saved = readJSON(STORAGE_KEYS.session, isGuestSession);
      if (saved && isLive(saved, Date.now())) setSession(saved);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(
    () => ({ session, table: session?.table ?? defaultTable }),
    [session, defaultTable],
  );
  return <GuestSessionContext.Provider value={value}>{children}</GuestSessionContext.Provider>;
}

function useGuestSessionContext(): GuestSessionValue {
  const ctx = useContext(GuestSessionContext);
  if (!ctx) throw new Error('useGuestSession must be used inside <GuestSessionProvider>');
  return ctx;
}

/** The current table: the restaurant's default table until the session is read. */
export function useTableContext(): number {
  return useGuestSessionContext().table;
}

/** This guest's session, or null before hydration. */
export function useGuestSession(): GuestSession | null {
  return useGuestSessionContext().session;
}
