import type { Branch, OrderMode } from '@/types/branch';
import type { GuestSession, SessionStart, StartChoice } from '@/types/session';

/*
 * The link a guest arrives with and the session it leads to. Pure, so it's unit-tested
 * without React: GuestSessionContext reads the URL and storage and applies the outcome.
 *
 * - A table QR code (`?branch=ktm-thamel&table=12&qr=<token>`) is dine-in at that table.
 * - An ordering link (`?mode=takeaway|delivery`, optionally with `&branch=`) orders that way.
 * - Anything else goes on with the guest's live session, or shows the start screen (choose an
 *   outlet, then how to order).
 */

/** What a link asks for. */
export interface ScanRequest {
  /** The branch it names (an unknown id means the default branch); null when it names none. */
  branchId: string | null;
  /** A table valid at that branch: a QR scan. */
  table: number | null;
  /** Takeaway or delivery, from `?mode=`. */
  mode: Exclude<OrderMode, 'dineIn'> | null;
  qrToken?: string;
}

/** QR tokens are opaque (e.g. a JWT); anything else is ignored. */
const QR_TOKEN = /^[\w.~-]{1,512}$/;

/** The branch with this id (e.g. GET /restaurant › defaultBranchId), or the first one listed. */
export const resolveBranch = (branches: readonly Branch[], id: string): Branch =>
  branches.find((b) => b.id === id) ?? branches[0];

export const isTableAt = (branch: Branch, table: number) =>
  Number.isInteger(table) && table >= branch.tables.first && table <= branch.tables.last;

const LINK_MODES = new Set<string>(['takeaway', 'delivery']);

/**
 * Reads `?branch=<id>&table=<n>&qr=<token>&mode=<mode>`. An unknown branch falls back to the
 * default one; a table outside the branch's range, or a mode the branch doesn't offer, is
 * ignored. Null when the link names none of branch, table and mode.
 */
export function parseScan(
  search: string,
  branches: readonly Branch[],
  defaultBranchId: string,
): ScanRequest | null {
  const params = new URLSearchParams(search);
  const named = params.get('branch');
  const branch = branches.find((b) => b.id === named) ?? resolveBranch(branches, defaultBranchId);
  const raw = params.get('table');
  const table = raw && /^\d{1,4}$/.test(raw) && isTableAt(branch, Number(raw)) ? Number(raw) : null;
  const rawMode = params.get('mode') ?? '';
  const mode =
    LINK_MODES.has(rawMode) && (!named || branch.modes[rawMode as OrderMode].enabled)
      ? (rawMode as ScanRequest['mode'])
      : null;
  if (!named && table === null && mode === null) return null;
  const qrToken = params.get('qr');
  return {
    branchId: named ? branch.id : null,
    table,
    mode,
    ...(qrToken && QR_TOKEN.test(qrToken) ? { qrToken } : {}),
  };
}

/** Whether a saved session still fits the branches: its branch exists, and has its table. */
export function fitsBranches(session: GuestSession, branches: readonly Branch[]): boolean {
  const branch = branches.find((b) => b.id === session.branchId);
  return Boolean(branch && (session.table === undefined || isTableAt(branch, session.table)));
}

export type ScanOutcome =
  /** Go on with the saved session. */
  | { keep: GuestSession }
  /** Open a new session. */
  | { start: SessionStart }
  /** Keep the saved session (and its cart) but order another way. */
  | { change: { session: GuestSession; mode: OrderMode } }
  /** No session: the guest chooses an outlet and a mode on the start screen. */
  | { choose: StartChoice };

/**
 * What a link leads to, given the live saved session:
 *
 * - A table QR keeps the session at the same branch and table (a re-scan or refresh), and
 *   otherwise starts a dine-in session there. Another branch or table is another session.
 * - An ordering link at the session's branch (or naming none) keeps the session, switching it
 *   to the link's mode; at another branch it starts a session there. With no session and no
 *   branch, the start screen opens with the mode chosen.
 * - A link naming only a branch keeps a session there, or opens the start screen at it.
 * - No link keeps the session, or opens the start screen.
 */
export function resolveScan(
  saved: GuestSession | null,
  request: ScanRequest | null,
  branches: readonly Branch[],
  defaultBranchId: string,
): ScanOutcome {
  if (!request) return saved ? { keep: saved } : { choose: {} };
  const branchId = request.branchId ?? resolveBranch(branches, defaultBranchId).id;
  const { table, mode, qrToken } = request;

  if (table !== null) {
    if (saved?.branchId === branchId && saved.table === table) return { keep: saved };
    return { start: { branchId, mode: 'dineIn', table, ...(qrToken ? { qrToken } : {}) } };
  }

  const sameBranch = saved && (request.branchId === null || saved.branchId === request.branchId);
  if (mode) {
    if (sameBranch)
      return saved.mode === mode ? { keep: saved } : { change: { session: saved, mode } };
    return request.branchId ? { start: { branchId, mode } } : { choose: { mode } };
  }
  return sameBranch ? { keep: saved } : { choose: { branchId } };
}
