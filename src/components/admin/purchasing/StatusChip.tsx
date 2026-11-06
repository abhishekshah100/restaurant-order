'use client';

import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import type { PoStatus } from '@/types/purchasing';
import styles from '../inventory/Inventory.module.css';

const TONE: Record<PoStatus, string | undefined> = {
  draft: styles.low,
  approved: undefined,
  sent: undefined,
  partly_received: styles.low,
  received: styles.ok,
  cancelled: styles.out,
  closed: undefined,
};

/** A purchase order's status, coloured: to approve and part-received amber, done green. */
export function StatusChip({ status }: { status: PoStatus }) {
  const t = useContent('common');
  return (
    <span className={cx(styles.chip, TONE[status])}>{t(`adminPurchasing.status.${status}`)}</span>
  );
}
