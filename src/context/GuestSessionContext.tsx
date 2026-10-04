'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { ActiveBranchContext } from '@/api/activeBranch';
import type { UpdateSessionRequest } from '@/api/contracts';
import { useBranches, useRestaurant } from '@/api/hooks';
import { useStartSession, useUpdateSession } from '@/api/mutations';
import { isOrderMode } from '@/lib/fulfilment';
import { fitsBranches, parseScan, resolveBranch, resolveScan, type ScanOutcome } from '@/lib/scan';
import { fromSaved, isLiveSession, isSavedSession } from '@/lib/session';
import { STORAGE_KEYS, readJSON, removeKey, writeJSON } from '@/lib/storage';
import type { Branch, OrderMode } from '@/types/branch';
import type { GuestSession, SessionStart, StartChoice } from '@/types/session';

/**
 * Each guest gets their own session at a branch, so several people at one table can order
 * separately, and a session says how the guest orders (dine-in, takeaway or delivery). The
 * link is read on the client (lib/scan decides):
 *
 * - a table QR code (/?branch=ktm-thamel&table=12&qr=<token>) is dine-in at that table: it
 *   keeps a live saved session at the same branch and table, else starts a new one there;
 * - an ordering link (/?mode=takeaway, optionally &branch=) switches the saved session to that
 *   mode, or starts one at the named branch;
 * - otherwise the live saved session goes on; without one the guest chooses an outlet and a
 *   mode on the start screen (`useVisit().needsStart`).
 *
 * New sessions are opened by the server (POST /sessions) and changed with PATCH /sessions/:id
 * (another mode or delivery area keeps the session, and so the cart). While a session is being
 * opened its branch, table and mode are already shown, and the request is kept for the tab so
 * a reload meanwhile opens the same session. The session is saved on the device (localStorage)
 * and followed across tabs. The cart, checkout, service requests and "mine" on the bill are
 * scoped to its id, and the active branch (menu, prices, rules) is its branch.
 */

interface SessionState {
  /** The guest's session; null until it's been read or opened. */
  session: GuestSession | null;
  /** The session being opened (shown meanwhile). */
  opening: SessionStart | null;
  /** No session to go on with: the start screen, with what the link chose. */
  choosing: StartChoice | null;
}

const listeners = new Set<() => void>();
const EMPTY: SessionState = { session: null, opening: null, choosing: null };
let current: SessionState = EMPTY;

const sameSession = (a: GuestSession | null, b: GuestSession | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.id === b.id &&
    a.mode === b.mode &&
    a.table === b.table &&
    a.deliveryArea === b.deliveryArea);

function setState(next: SessionState) {
  if (
    sameSession(next.session, current.session) &&
    next.opening === current.opening &&
    next.choosing === current.choosing
  ) {
    return;
  }
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => current;
const getServerSnapshot = () => EMPTY;

/** A session request saved while it was opening. */
function isSessionStart(v: unknown): v is SessionStart {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.branchId === 'string' &&
    isOrderMode(s.mode) &&
    (s.mode === 'dineIn' ? typeof s.table === 'number' : s.table === undefined)
  );
}

/** The saved session (the in-memory one when storage is blocked) if it's live and still fits the branches. */
function liveSavedSession(
  now: number,
  branches: readonly Branch[],
  defaultBranchId: string,
): GuestSession | null {
  const stored = readJSON(STORAGE_KEYS.session, isSavedSession);
  const saved = stored ? fromSaved(stored, defaultBranchId) : current.session;
  return saved && isLiveSession(saved, now) && fitsBranches(saved, branches) ? saved : null;
}

/**
 * What this page load leads to: the link's outcome, else a session that was still opening when
 * the tab reloaded, else the saved session (or the start screen).
 */
function loadOutcome(
  search: string,
  saved: GuestSession | null,
  branches: readonly Branch[],
  defaultBranchId: string,
): ScanOutcome {
  const linked = parseScan(search, branches, defaultBranchId);
  if (linked) return resolveScan(saved, linked, branches, defaultBranchId);
  const pending = readJSON(STORAGE_KEYS.pendingScan, isSessionStart, 'session');
  if (pending && branches.some((b) => b.id === pending.branchId)) return { start: pending };
  return resolveScan(saved, null, branches, defaultBranchId);
}

function saveSession(session: GuestSession) {
  writeJSON(STORAGE_KEYS.session, session);
  removeKey(STORAGE_KEYS.pendingScan, 'session');
  setState({ session, opening: null, choosing: null });
}

/** One session opening at a time (Strict Mode runs effects twice). */
let opening: { key: string; promise: Promise<GuestSession> } | null = null;

/** How the guest is ordering right now. */
export interface Visit {
  mode: OrderMode;
  /** Dine-in: the table. Null when ordering takeaway or delivery. */
  table: number | null;
  /** The table a QR code was scanned at in this session (so dine-in can be chosen), if any. */
  scannedTable: number | null;
  /** Delivery: the area the guest is ordering to, once chosen. */
  deliveryArea?: string;
  /** No session and no link to open one: the guest chooses on the start screen. */
  needsStart: boolean;
  /** What the link already chose for the start screen. */
  choice: StartChoice;
}

export interface VisitActions {
  /** Opens a new session (POST /sessions); resolves false if the server didn't answer. */
  start: (request: SessionStart) => Promise<boolean>;
  /** Changes the mode or delivery area of this session (PATCH /sessions/:id); keeps the cart. */
  update: (change: UpdateSessionRequest) => Promise<boolean>;
}

interface GuestSessionValue {
  session: GuestSession | null;
  table: number;
  visit: Visit;
  actions: VisitActions;
}

const GuestSessionContext = createContext<GuestSessionValue | null>(null);

export function GuestSessionProvider({ children }: { children: ReactNode }) {
  const branches = useBranches();
  const { defaultBranchId } = useRestaurant();
  const { mutateAsync: startSession } = useStartSession();
  const { mutateAsync: patchSession } = useUpdateSession();
  // The prerendered HTML (and so the first client render) has no session yet.
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const open = useCallback(
    (request: SessionStart): Promise<GuestSession> => {
      const key = JSON.stringify(request);
      writeJSON(STORAGE_KEYS.pendingScan, request, 'session');
      setState({ session: null, opening: request, choosing: null });
      if (opening?.key !== key) opening = { key, promise: startSession(request) };
      const mine = opening;
      mine.promise.then(
        (session) => {
          if (opening === mine) saveSession(session);
        },
        () => {
          // Couldn't open one: the next page load tries again with the kept request.
          if (opening === mine) opening = null;
        },
      );
      return mine.promise;
    },
    [startSession],
  );

  const update = useCallback(
    async (change: UpdateSessionRequest) => {
      const session = current.session;
      if (!session) return false;
      try {
        saveSession(await patchSession({ id: session.id, ...change }));
        return true;
      } catch {
        return false;
      }
    },
    [patchSession],
  );

  useEffect(() => {
    const saved = liveSavedSession(Date.now(), branches, defaultBranchId);
    const outcome = loadOutcome(window.location.search, saved, branches, defaultBranchId);
    if ('start' in outcome) {
      void open(outcome.start).catch(() => undefined);
      return;
    }
    // A session still opening from before is no longer wanted.
    opening = null;
    removeKey(STORAGE_KEYS.pendingScan, 'session');
    if ('choose' in outcome) {
      setState({ session: null, opening: null, choosing: outcome.choose });
    } else if ('change' in outcome) {
      setState({ session: outcome.change.session, opening: null, choosing: null });
      void update({ mode: outcome.change.mode });
    } else {
      setState({ session: outcome.keep, opening: null, choosing: null });
    }
  }, [branches, defaultBranchId, open, update]);

  // Another tab opened or changed a session: this device now has that guest session.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEYS.session) return;
      const saved = liveSavedSession(Date.now(), branches, defaultBranchId);
      if (!saved) return;
      opening = null;
      setState({ session: saved, opening: null, choosing: null });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [branches, defaultBranchId]);

  const { session, opening: request, choosing } = state;
  const { defaultTable } = resolveBranch(branches, defaultBranchId);
  const actions = useMemo<VisitActions>(
    () => ({
      start: (next) => open(next).then(
        () => true,
        () => false,
      ),
      update,
    }),
    [open, update],
  );
  const value = useMemo<GuestSessionValue>(() => {
    const now = session ?? request;
    const table = (now?.mode === 'dineIn' ? now.table : session?.table) ?? null;
    const mode = now?.mode ?? 'dineIn';
    return {
      session,
      table: table ?? defaultTable,
      visit: {
        mode,
        // Before the session is read: the default table, as prerendered.
        table: mode === 'dineIn' ? (table ?? defaultTable) : null,
        scannedTable: table,
        deliveryArea: session?.deliveryArea ?? (request?.mode === 'delivery' ? request.deliveryArea : undefined),
        needsStart: choosing !== null,
        choice: choosing ?? {},
      },
      actions,
    };
  }, [session, request, choosing, defaultTable, actions]);
  return (
    <ActiveBranchContext.Provider
      value={session?.branchId ?? request?.branchId ?? choosing?.branchId ?? null}
    >
      <GuestSessionContext.Provider value={value}>{children}</GuestSessionContext.Provider>
    </ActiveBranchContext.Provider>
  );
}

function useGuestSessionContext(): GuestSessionValue {
  const ctx = useContext(GuestSessionContext);
  if (!ctx) throw new Error('useGuestSession must be used inside <GuestSessionProvider>');
  return ctx;
}

/** The current table: the default branch's default table until the session is read. */
export function useTableContext(): number {
  return useGuestSessionContext().table;
}

/** This guest's session, or null before hydration (and while a new one is being opened). */
export function useGuestSession(): GuestSession | null {
  return useGuestSessionContext().session;
}

/** How the guest is ordering: mode, table, delivery area, or that they still have to choose. */
export function useVisit(): Visit {
  return useGuestSessionContext().visit;
}

/** Open a new session (another outlet) or change this one's mode or delivery area. */
export function useVisitActions(): VisitActions {
  return useGuestSessionContext().actions;
}
