'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useBranch, useContent } from '@/api/hooks';
import { Icon, TablePill } from '@/components/ui';
import { MODE_ICON } from '@/components/start/ModeOptions';
import { useVisit } from '@/context/GuestSessionContext';
import { cx } from '@/lib/cx';
import { ModeSwitchDialog } from './ModeSwitchDialog';
import styles from './VisitPill.module.css';

export interface VisitPillProps {
  /** Text before the table, e.g. "The Olive Table · " (dine-in only, as drawn). */
  prefix?: string;
  className?: string;
}

/**
 * The header's "where and how" pill. Dine-in: the table pill, exactly as drawn. Takeaway and
 * delivery: "Takeaway · Thamel", which opens the mode switcher. No session yet: "Choose outlet",
 * a link to the start screen.
 */
export function VisitPill({ prefix, className }: VisitPillProps) {
  const visit = useVisit();
  const branch = useBranch();
  const t = useContent('common');
  const [open, setOpen] = useState(false);

  if (visit.needsStart) {
    return (
      <Link
        href="/start/"
        className={cx(styles.pill, styles.action, className)}
        aria-label={t('visit.chooseLabel')}
      >
        <Icon name="store" size="xs" />
        {t('visit.choose')}
        <Icon name="chev" size="xs" />
      </Link>
    );
  }

  if (visit.mode === 'dineIn') {
    return <TablePill table={visit.table} prefix={prefix} className={className} />;
  }

  const mode = t(`modes.${visit.mode}`);
  return (
    <>
      <button
        type="button"
        className={cx(styles.pill, styles.action, className)}
        aria-label={t('visit.pillLabel', { mode, branch: branch.shortName })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Icon name={MODE_ICON[visit.mode]} size="xs" />
        <span className={styles.text}>{t('visit.pill', { mode, branch: branch.shortName })}</span>
        <Icon name="chevd" size="xs" />
      </button>
      <ModeSwitchDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
