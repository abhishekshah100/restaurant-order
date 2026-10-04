'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useBranch, useContent } from '@/api/hooks';
import { Dialog, Icon } from '@/components/ui';
import { ModeOptions } from '@/components/start/ModeOptions';
import { useVisit, useVisitActions } from '@/context/GuestSessionContext';
import { useToast } from '@/context/ToastContext';
import type { OrderMode } from '@/types/branch';
import styles from './ModeSwitchDialog.module.css';

/**
 * Change how to order from the header: another mode at this outlet applies at once and keeps
 * the cart (PATCH /sessions/:id); another outlet goes to the start screen, which asks before
 * emptying the cart.
 */
export function ModeSwitchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const branch = useBranch();
  const visit = useVisit();
  const { update } = useVisitActions();
  const { showToast } = useToast();
  const t = useContent('home');
  const [busy, setBusy] = useState(false);

  const choose = async (mode: OrderMode) => {
    if (busy) return;
    if (mode === visit.mode) {
      onClose();
      return;
    }
    setBusy(true);
    const ok = await update({ mode });
    setBusy(false);
    if (ok) {
      onClose();
      showToast(t(`modeSwitch.switched.${mode}`));
    } else {
      showToast(t('modeSwitch.failed'), { tone: 'error' });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('modeSwitch.title')} presentation="adaptive">
      <div className={styles.body} aria-busy={busy || undefined}>
        <div className={styles.outlet}>
          <span className={styles.outletIcon} aria-hidden="true">
            <Icon name="store" size="sm" />
          </span>
          <span className={styles.outletText}>
            <span className="t-caption c3">{t('modeSwitch.from')}</span>
            <span className={styles.outletName}>{branch.name}</span>
            <span className={styles.outletAddress}>{branch.address}</span>
          </span>
          <Link href="/start/" className={styles.change} onClick={onClose}>
            {t('modeSwitch.changeOutlet')}
          </Link>
        </div>
        <ModeOptions
          branch={branch}
          value={visit.mode}
          current={visit.mode}
          onChange={(mode) => void choose(mode)}
          scannedTable={visit.scannedTable}
          label={t('start.modesLabel')}
        />
      </div>
    </Dialog>
  );
}
