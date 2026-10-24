import type { BranchSummary, OrderMode } from '@/types/branch';
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
  /** The table number the link carries: a QR scan (the server checks it's the branch's). */
  table: number | null;
  /** Takeaway or delivery, from `?mode=`. */
  mode: Exclude<OrderMode, 'dineIn'> | null;
  qrToken?: string;
}

/** QR tokens are opaque (e.g. a JWT); anything else is ignored. */
const QR_TOKEN = /^[\w.~-]{1,512}$/;

/** The branch with this id (e.g. GET /restaurant › defaultBranchId), or the first one listed. */
export const resolveBranch = <B extends { id: string }>(branches: readonly B[], id: string): B =>
  branches.find((b) => b.id === id) ?? branches[0];

/** A table number as a QR link carries it: 1 to 9999. Whether the branch has it, the server says. */
const TABLE = /^[1-9]\d{0,3}$/;

const LINK_MODES = new Set<string>(['takeaway', 'delivery']);

/**
 * Reads `?branch=<id>&table=<n>&qr=<token>&mode=<mode>`. An unknown branch falls back to the
 * default one; a table that isn't a number, or a mode the branch doesn't offer, is ignored. The
 * table itself (the branch's, in service, the QR code its own) is the server's to check when the
 * session opens. Null when the link names none of branch, table and mode.
 */
export function parseScan(
  search: string,
  branches: readonly BranchSummary[],
  defaultBranchId: string,
): ScanRequest | null {
  const params = new URLSearchParams(search);
  const named = params.get('branch');
  const branch = branches.find((b) => b.id === named) ?? resolveBranch(branches, defaultBranchId);
  const raw = params.get('table');
  const table = raw && TABLE.test(raw) ? Number(raw) : null;
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

/** Whether a saved session still fits the branches: its branch is still there. */
export function fitsBranches(session: GuestSession, branches: readonly BranchSummary[]): boolean {
  return branches.some((b) => b.id === session.branchId);
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
 *   otherwise starts a dine-in session there. Another branch or table is another session. The
 *   server refuses a table out of service or not the branch's (refusedScan says why).
 * - An ordering link at the session's branch (or naming none) keeps the session, switching it
 *   to the link's mode; at another branch it starts a session there. With no session and no
 *   branch, the start screen opens with the mode chosen.
 * - A link naming only a branch keeps a session there, or opens the start screen at it.
 * - No link keeps the session, or opens the start screen.
 */
export function resolveScan(
  saved: GuestSession | null,
  request: ScanRequest | null,
  branches: readonly BranchSummary[],
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

/**
 * A table scan the server refused for good: the start screen says why (takeaway still works).
 * Any other failure (offline, the server busy) is tried again on the next load.
 */
export function refusedScan(request: SessionStart, code: string | undefined): StartChoice | null {
  if (request.mode !== 'dineIn') return null;
  // A table the branch doesn't have (400), or a QR code that isn't this table's (403): the link
  // is wrong, so asking again won't help.
  if (code === 'qr_invalid' || code === 'invalid_request') {
    return { branchId: request.branchId, invalidTable: request.table };
  }
  if (code === 'table_disabled') return { branchId: request.branchId, closedTable: request.table };
  return null;
}
