'use client';

import type { ReactNode } from 'react';
import { useBranchStatusKnown, useContent } from '@/api/hooks';
import { Spinner } from '@/components/ui';
import { useOrderingAvailability } from '@/hooks/useRestaurantStatus';
import { StatusScreen } from './StatusScreen';
import styles from './OrderingGate.module.css';

/**
 * Shows the restaurant state screen (closed, paused or offline) instead of its children while an
 * order can't be placed. Wraps the welcome page and checkout. Until this visit has read the
 * branch's status (the page's built-in copy can be hours old), it shows neither: never "View
 * menu" for a branch that's closed now.
 */
export function OrderingGate({ children }: { children: ReactNode }) {
  const { state } = useOrderingAvailability();
  const known = useBranchStatusKnown();
  const t = useContent('status');
  // Offline: say so at once (the status can't be read until the connection is back).
  if (state === 'offline') return <StatusScreen state={state} />;
  if (!known) {
    return (
      <div className={styles.checking} role="status" aria-busy="true">
        <Spinner tone="brand" size="lg" />
        <span className="visually-hidden">{t('checking')}</span>
      </div>
    );
  }
  if (state === 'open') return children;
  return <StatusScreen state={state} />;
}
