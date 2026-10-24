'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
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
      {open && <BranchStatusDialog onClose={() => setOpen(false)} />}
    </>
  );
}
