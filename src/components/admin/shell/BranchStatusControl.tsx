'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useNow } from '@/hooks/useNow';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { cx } from '@/lib/cx';
import { BranchStatus } from './BranchStatus';
import { useAdminWorkspace } from './AdminWorkspace';
import styles from './BranchStatusControl.module.css';

// Downloaded the first time it opens.
const BranchStatusDialog = dynamic(
  () => import('./BranchStatusDialog').then((m) => m.BranchStatusDialog),
  { ssr: false, loading: () => <LoadingSignal /> },
);

/**
 * The branch's status as a button: it opens "Taking orders?" — open, pause new orders for a
 * while (back by itself), or close for the rest of today (open again tomorrow). Guests see it
 * within a minute; waiters can still take orders at the table.
 */
export function BranchStatusControl({
  onDark = false,
  className,
}: {
  onDark?: boolean;
  className?: string;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={cx(styles.button, onDark && styles.onDark, className)}
        onClick={() => setOpen(true)}
        aria-label={t('adminShell.statusControl.label', {
          status: t(`adminShell.status.${branch.status}`),
        })}
      >
        <BranchStatus status={branch.status} onDark={onDark} />
        <Icon name="chevd" size="xs" className={styles.chevron} />
      </button>
      {/* <LastOrders onDark={onDark} /> */}
      {open && <BranchStatusDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/** Within this many minutes of last orders, staff are warned. */
const SOON_MINUTES = 15;

/**
 * While the branch takes orders: when it stops ("Last orders 8:30 PM"), and in the last
 * minutes a warning ("Last orders in 12 min"), so staff aren't caught out.
 */
function LastOrders({ onDark }: { onDark: boolean }) {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const now = useNow();
  if (!now || branch.status !== 'open' || !branch.statusUntil) return null;
  const left = Math.ceil((Date.parse(branch.statusUntil) - now.getTime()) / 60_000);
  if (left <= 0) return null;
  const soon = left <= SOON_MINUTES;
  return (
    <span
      className={cx(styles.lastOrders, onDark && styles.onDark, soon && styles.soon)}
      role={soon ? 'status' : undefined}
    >
      {soon
        ? t('adminShell.lastOrdersSoon', { minutes: left })
        : t('adminShell.lastOrders', { time: clock.time(branch.statusUntil) })}
    </span>
  );
}
