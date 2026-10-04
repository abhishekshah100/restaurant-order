import type { BranchStatus } from './branch';

/** What the guest can do right now: the branch status, or 'offline' when the device has no connection. */
export type OrderingState = BranchStatus | 'offline';

/** GET /restaurant: the brand, shared by every branch. Branch details are in GET /branches. */
export interface Restaurant {
  name: string;
  tagline: string;
  /** Branch a QR link without `?branch=` belongs to (and the one pages are prerendered for). */
  defaultBranchId: string;
  /** Social profiles shown under "Follow us" on the Help page. */
  social: SocialLink[];
}

export type SocialNetwork = 'instagram' | 'facebook' | 'youtube' | 'x';

export interface SocialLink {
  network: SocialNetwork;
  /** Platform name shown under the icon, e.g. "Instagram". */
  label: string;
  url: string;
}
