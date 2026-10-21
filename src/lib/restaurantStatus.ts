import type { Branch, BranchLiveStatus, BranchStatus } from '@/types/branch';
import type { OrderingState } from '@/types/restaurant';

/** A branch's status now, as GET /branches/:branchId/status answers it. */
export const liveStatusOf = ({
  id,
  status,
  opensAt,
  opensIn,
  pausedForMinutes,
  reopensTomorrow,
  reopensOn,
}: Branch): BranchLiveStatus => ({
  id,
  status,
  opensAt,
  opensIn,
  pausedForMinutes,
  ...(reopensTomorrow ? { reopensTomorrow } : {}),
  ...(reopensOn ? { reopensOn } : {}),
});

/**
 * The branch with the newer of its two reads: the whole list (read once per visit) or its
 * status (polled while guests order). An older status never overrides a newer list.
 */
export function withLiveStatus(
  branch: Branch,
  listedAt: number,
  live: BranchLiveStatus | undefined,
  liveAt: number,
): Branch {
  if (!live || live.id !== branch.id || liveAt < listedAt) return branch;
  // The schedule fields the status leaves out are dropped with it, so they can't go stale.
  const { reopensTomorrow: _tomorrow, reopensOn: _on, ...rest } = branch;
  return { ...rest, ...live };
}

/** Colour of the header subline: error when closed, warning when paused, default when open. */
export function statusTone(status: BranchStatus): 'error' | 'warn' | null {
  if (status === 'closed') return 'error';
  if (status === 'paused') return 'warn';
  return null;
}

/** Values accepted by the `?status=` preview parameter. */
const STATUS_PREVIEWS = ['open', 'closed', 'paused', 'offline'] as const;
export type StatusPreview = (typeof STATUS_PREVIEWS)[number];

export const isStatusPreview = (value: unknown): value is StatusPreview =>
  typeof value === 'string' && (STATUS_PREVIEWS as readonly string[]).includes(value);

export const parseStatusPreview = (raw: string | null): StatusPreview | null =>
  isStatusPreview(raw) ? raw : null;

/** The shortest pause staff can choose (admin › BranchStatusControl). */
const PREVIEW_PAUSE_MINUTES = 15;

/**
 * About how long ordering stays paused. A paused branch always has a minute or more left; a
 * `?status=paused` preview of one that isn't paused reads like the shortest real pause.
 */
export const pausedMinutes = ({ pausedForMinutes }: { pausedForMinutes: number }) =>
  pausedForMinutes > 0 ? pausedForMinutes : PREVIEW_PAUSE_MINUTES;

export interface OrderingAvailability {
  /** What the guest sees: the restaurant status, or offline (which wins). */
  state: OrderingState;
  /** Restaurant status shown in the header (stays as-is while offline). */
  status: BranchStatus;
  /** Dishes can go into the cart (everything but closed; the cart is local). */
  canAdd: boolean;
  /** An order can be checked out and placed (open and online). */
  canCheckout: boolean;
}

/** Combines the restaurant status with connectivity. */
export function resolveOrdering(status: BranchStatus, online: boolean): OrderingAvailability {
  const state: OrderingState = online ? status : 'offline';
  return { state, status, canAdd: status !== 'closed', canCheckout: state === 'open' };
}

/**
 * Applies a preview to the live values: a status preview replaces the restaurant
 * status, and 'offline' forces the offline state.
 */
export function applyPreview(
  preview: StatusPreview | null,
  live: { status: BranchStatus; online: boolean },
): OrderingAvailability {
  if (preview === 'offline') return resolveOrdering(live.status, false);
  return resolveOrdering(preview ?? live.status, live.online);
}

/** "12:00 PM – 3:30 PM" → "12:00 – 3:30 PM" when both ends share AM / PM. */
export function compactTimeRange(range: string): string {
  const match = /^(\d{1,2}:\d{2}) (AM|PM) – (\d{1,2}:\d{2}) (AM|PM)$/.exec(range);
  if (!match || match[2] !== match[4]) return range;
  return `${match[1]} – ${match[3]} ${match[4]}`;
}
