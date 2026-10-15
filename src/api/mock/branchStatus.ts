import type { Clock } from '@/lib/clock';
import type { Branch, BranchStatus } from '@/types/branch';

/*
 * MOCK ONLY — a branch's status as staff left it: paused until a time (open again from then),
 * closed for the rest of a day (open again at the next day's opening time), or open. Applied on
 * top of the branch data, so the guest app, the admin pages and the order checks all see it.
 */

export interface BranchStatusChange {
  status: BranchStatus;
  /** Paused: ISO, when it ends. */
  until?: string;
  /** Closed: the branch's day it was closed for ("2026-10-15"). */
  day?: string;
}

/** The branch as now, with what staff set (none: as in the data). */
export function withStatus(
  branch: Branch,
  change: BranchStatusChange | undefined,
  now: Date,
  clock: Clock,
): Branch {
  if (!change) return branch;
  if (change.status === 'paused' && change.until) {
    const left = Date.parse(change.until) - now.getTime();
    return left > 0
      ? { ...branch, status: 'paused', pausedForMinutes: Math.ceil(left / 60_000) }
      : { ...branch, status: 'open' };
  }
  if (change.status === 'closed' && change.day) {
    return clock.dayKey(now) === change.day
      ? { ...branch, status: 'closed', reopensTomorrow: true }
      : { ...branch, status: 'open' };
  }
  return { ...branch, status: change.status };
}

/** ISO: when the status staff set ends by itself (a pause, or a day closed), if it does. */
export function statusUntil(
  branch: Branch,
  change: BranchStatusChange | undefined,
  now: Date,
  clock: Clock,
): string | undefined {
  const current = withStatus(branch, change, now, clock);
  if (current.status === 'paused' && change?.until) return change.until;
  if (current.status === 'closed' && change?.day) {
    return clock.localTimestamp(-1, branch.hours.opens, now);
  }
  return undefined;
}
