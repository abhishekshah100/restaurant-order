import { nextOpeningAfterToday, scheduleStatus } from '@/lib/branchHours';
import { createClock } from '@/lib/clock';
import type { Branch, BranchStatus, ModeStatus, OrderMode } from '@/types/branch';

/*
 * MOCK ONLY — a branch's status as staff left it: paused until a time (open again from then),
 * closed for the rest of a day (open again at the next day's opening time), or open. Applied on
 * top of the week, as the backend does, so the guest app, the admin pages and the order checks
 * all see it.
 */

export interface BranchStatusChange {
  status: BranchStatus;
  /** Paused: ISO, when it ends. */
  until?: string;
  /** Closed or opened: the branch's day it holds for ("2026-10-15"). */
  day?: string;
}

/** A way of ordering's status now, as the backend works it out (see withStatus). */
function statusOf(
  branch: Branch,
  change: BranchStatusChange | undefined,
  now: Date,
  mode: OrderMode,
): ModeStatus {
  const today = createClock(branch).dayKey(now);
  // A change without a day (a tester's override in storage) holds until it's taken back.
  const holds = (day: string | undefined) => day === undefined || day === today;
  if (change?.status === 'paused' && change.until && Date.parse(change.until) > now.getTime()) {
    return { status: 'paused', statusUntil: change.until };
  }
  if (change?.status === 'closed' && holds(change.day)) {
    const reopens = nextOpeningAfterToday(branch, now);
    return { status: 'closed', ...(reopens ? { statusUntil: reopens.at.toISOString() } : {}) };
  }
  if (change?.status === 'open' && holds(change.day)) {
    // Open for the rest of the day, sessions or not: until the branch's midnight.
    const midnight = createClock(branch).localTimestamp(-1, '00:00', now);
    return { status: 'open', statusUntil: new Date(midnight).toISOString() };
  }
  const week = scheduleStatus(branch, now, mode);
  return { status: week.status, ...(week.until ? { statusUntil: week.until.toISOString() } : {}) };
}

/**
 * The branch as now, as the backend works it out: what staff set while it lasts (paused until a
 * time, closed or open for the rest of a day, for every way of ordering), else its hours (open
 * inside a session until last orders, closed until the next one opens; takeaway and delivery by
 * their own when they have them), with `statusUntil` (ISO) the next change.
 */
export function withStatus(
  branch: Branch,
  change: BranchStatusChange | undefined,
  now: Date,
): Branch {
  const { statusUntil: _stale, ...rest } = branch;
  return {
    ...rest,
    ...statusOf(branch, change, now, 'dineIn'),
    modeStatus: {
      takeaway: statusOf(branch, change, now, 'takeaway'),
      delivery: statusOf(branch, change, now, 'delivery'),
    },
  };
}
