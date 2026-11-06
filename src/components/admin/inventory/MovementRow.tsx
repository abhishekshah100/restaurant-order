'use client';

import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import type { StockMovement } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useDayText } from './BatchList';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';

/**
 * One ledger row: what happened (the kind and its reason), when, by whom and any note; the
 * change, what it left, and its value for staff who see costs.
 */
export function MovementRow({
  movement: m,
  showName = true,
}: {
  movement: StockMovement;
  /** The ingredient's name first (the ledger); not within one item's history. */
  showName?: boolean;
}) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  const text = useInventoryText();
  const day = useDayText();
  const what = m.reason
    ? `${t(`adminInventory.kinds.${m.kind}`)} · ${t(`adminInventory.reasons.${m.reason}`)}`
    : t(`adminInventory.kinds.${m.kind}`);
  return (
    <div className={styles.row}>
      <span className={styles.rowMain}>
        <span className={styles.rowName}>{showName ? m.name : what}</span>
        <span className={styles.muted}>
          {[
            showName ? what : null,
            clock.dateTime(m.at),
            m.by && t('adminInventory.by', { name: m.by }),
            m.note,
            m.kind === 'revaluation' && m.cost !== undefined
              ? t('adminInventory.newCost', { cost: text.cost(m.cost, m.unit) })
              : null,
            m.batches?.length
              ? t('adminInventory.expiry.batchesMoved', {
                  dates: m.batches
                    .map((b) =>
                      b.expiresOn ? day(b.expiresOn) : t('adminInventory.expiry.undated'),
                    )
                    .join(', '),
                })
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className={styles.rowSide}>
        {m.kind !== 'revaluation' && (
          <span
            className={cx(
              styles.quantity,
              m.quantity < 0 ? styles.negative : m.quantity > 0 && styles.positive,
            )}
          >
            {text.change(m.quantity, m.unit)}
          </span>
        )}
        <span className={styles.muted}>
          {t('adminInventory.leaves', { quantity: text.quantity(m.balanceAfter, m.unit) })}
          {m.value !== undefined && m.value !== 0 ? ` · ${text.signedValue(m.value)}` : ''}
        </span>
      </span>
    </div>
  );
}
