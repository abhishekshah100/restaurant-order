import type { OrderingState, RestaurantStatus } from '@/types/restaurant';

/** Colour of the header subline: error when closed, warning when paused, default when open. */
export function statusTone(status: RestaurantStatus): 'error' | 'warn' | null {
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

export interface OrderingAvailability {
  /** What the guest sees: the restaurant status, or offline (which wins). */
  state: OrderingState;
  /** Restaurant status shown in the header (stays as-is while offline). */
  status: RestaurantStatus;
  /** Dishes can go into the cart (everything but closed; the cart is local). */
  canAdd: boolean;
  /** An order can be checked out and placed (open and online). */
  canCheckout: boolean;
}

/** Combines the restaurant status with connectivity. */
export function resolveOrdering(status: RestaurantStatus, online: boolean): OrderingAvailability {
  const state: OrderingState = online ? status : 'offline';
  return { state, status, canAdd: status !== 'closed', canCheckout: state === 'open' };
}

/**
 * Applies a preview to the live values: a status preview replaces the restaurant
 * status, and 'offline' forces the offline state.
 */
export function applyPreview(
  preview: StatusPreview | null,
  live: { status: RestaurantStatus; online: boolean },
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
