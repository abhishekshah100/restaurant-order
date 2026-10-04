'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useBranch, useContent } from '@/api/hooks';
import {
  applyPreview,
  isStatusPreview,
  parseStatusPreview,
  statusTone,
  type OrderingAvailability,
  type StatusPreview,
} from '@/lib/restaurantStatus';
import { STORAGE_KEYS, readJSON, removeKey, writeJSON } from '@/lib/storage';
import { recheckOnline, useOnlineStatus } from './useOnlineStatus';
import { useQueryParam } from './useQueryParam';

/**
 * Preview of the restaurant states for demos and tests: `?status=closed|paused|offline`
 * on any page is remembered for the tab (sessionStorage), so it persists while browsing.
 * `?status=open` clears it.
 */

const listeners = new Set<() => void>();
let saved: StatusPreview | null | undefined;

function getSaved(): StatusPreview | null {
  if (saved === undefined) saved = readJSON(STORAGE_KEYS.statusPreview, isStatusPreview, 'session');
  return saved;
}

function setSaved(next: StatusPreview | null) {
  saved = next === 'open' ? null : next;
  if (saved) writeJSON(STORAGE_KEYS.statusPreview, saved, 'session');
  else removeKey(STORAGE_KEYS.statusPreview, 'session');
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The active preview, or null. Always null during prerender and hydration. */
function useStatusPreview(): StatusPreview | null {
  const fromUrl = parseStatusPreview(useQueryParam('status'));
  const stored = useSyncExternalStore(subscribe, getSaved, () => null);
  useEffect(() => {
    if (fromUrl) setSaved(fromUrl);
  }, [fromUrl]);
  return fromUrl ?? stored;
}

export interface OrderingAvailabilityResult extends OrderingAvailability {
  /** "Try again" on the offline screen: re-checks the connection (and ends an offline preview). */
  retry: () => void;
}

/**
 * Whether the guest can add dishes and place an order right now: the restaurant
 * status (GET /branches, the guest's branch) combined with
 * navigator.onLine. Matches the prerendered HTML until hydration has finished.
 */
export function useOrderingAvailability(): OrderingAvailabilityResult {
  const { status } = useBranch();
  const preview = useStatusPreview();
  const online = useOnlineStatus();

  const retry = useCallback(() => {
    if (preview === 'offline') {
      setSaved(null);
      const url = new URL(window.location.href);
      if (url.searchParams.has('status')) {
        url.searchParams.delete('status');
        window.history.replaceState(window.history.state, '', url);
      }
    }
    recheckOnline();
  }, [preview]);

  return useMemo(
    () => ({ ...applyPreview(preview, { status, online }), retry }),
    [preview, status, online, retry],
  );
}

/** The header subline ("Open · until 11:00 PM", "Closed now", "Ordering paused") and its colour. */
export function useStatusLine(): { text: string; tone: 'error' | 'warn' | null } {
  const { closesAt } = useBranch();
  const { status } = useOrderingAvailability();
  const t = useContent('status');
  return { text: t(`line.${status}`, { time: closesAt }), tone: statusTone(status) };
}
