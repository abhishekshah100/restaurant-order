'use client';

import { useBranchStatusPolling } from '@/api/hooks';

/**
 * Keeps the branch's status fresh on a page where guests order (menu, dish, search, cart,
 * checkout): a pause or a close from staff reaches them within a minute. Renders nothing.
 */
export function BranchStatusWatch() {
  useBranchStatusPolling();
  return null;
}
