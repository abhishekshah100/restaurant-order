'use client';

import { useIsFetching, useIsMutating, type Query } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useContent } from '@/api/hooks';
import styles from './GlobalLoader.module.css';

/*
 * One loader for the whole app (guest and staff pages): a bar across the top of the screen
 * while the app waits on the server or on code it hasn't downloaded yet. It shows for:
 *
 * - a first read of data (nothing on screen yet), not a refresh of data already shown, so
 *   polling (orders, the service board) never flashes it;
 * - anything sent to the server (POST, PATCH, DELETE);
 * - a lazily loaded part of a page (a popup) being downloaded: render <LoadingSignal /> as its
 *   placeholder.
 *
 * A query or mutation can opt out with `meta: { silent: true }`. Quick answers never show it:
 * it appears only once the wait passes SHOW_AFTER_MS.
 */

const SHOW_AFTER_MS = 300;

/** Parts of the page still downloading (LoadingSignal), counted outside React. */
let pendingParts = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getPendingParts = () => pendingParts;
const getServerPendingParts = () => 0;

/** Keeps the global loader up while mounted: the placeholder of a lazily loaded component. */
export function LoadingSignal() {
  useEffect(() => {
    pendingParts += 1;
    notify();
    return () => {
      pendingParts -= 1;
      notify();
    };
  }, []);
  return null;
}

const isSilent = (meta: Record<string, unknown> | undefined) => meta?.silent === true;

/** A first read: nothing to show until it answers. */
const isFirstRead = (query: Query) => query.state.data === undefined && !isSilent(query.meta);

export function GlobalLoader() {
  const t = useContent('common');
  const reading = useIsFetching({ predicate: isFirstRead });
  const sending = useIsMutating({ predicate: (m) => !isSilent(m.options.meta) });
  const parts = useSyncExternalStore(subscribe, getPendingParts, getServerPendingParts);
  const busy = reading + sending + parts > 0;
  const [shown, setShown] = useState(false);
  // Hidden as soon as nothing is pending (during render, so it never lingers a frame).
  if (!busy && shown) setShown(false);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => setShown(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [busy]);

  if (!shown) return null;
  return (
    <div className={styles.loader} role="status" aria-live="polite">
      <span className={styles.bar} aria-hidden="true" />
      <span className="visually-hidden">{t('globalLoader')}</span>
    </div>
  );
}
