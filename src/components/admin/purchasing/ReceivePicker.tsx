'use client';

import { useContent } from '@/api/hooks';
import { Dialog, Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import type { PurchaseOrder } from '@/types/purchasing';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { docNumber } from './usePurchasingText';
import styles from './Purchasing.module.css';

/**
 * Receiving › What arrived?: the orders on the way (late ones first, in red) to pick from, and
 * "Bought without an order" (the market, the milk van).
 */
export function ReceivePicker({
  onTheWay,
  today,
  onPick,
  onClose,
}: {
  onTheWay: readonly PurchaseOrder[];
  today: string;
  onPick: (source: string | 'direct') => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminPurchasing.receive.title')}
      description={t('adminPurchasing.receive.whichIntro')}
    >
      <div className={styles.editor}>
        {onTheWay.length > 0 ? (
          <ul className={styles.pickList}>
            {onTheWay.map((o) => {
              const late = o.expectedOn !== undefined && o.expectedOn < today;
              return (
                <li key={o.id}>
                  <button type="button" className={styles.pick} onClick={() => onPick(o.id)}>
                    <span className={styles.pickIcon} aria-hidden="true">
                      <Icon name="bag" size="sm" />
                    </span>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{o.supplier.name}</span>
                      <span className={cx(styles.rowMeta, late && styles.lateText)}>
                        {[
                          docNumber('PO', o.number),
                          t.plural('adminPurchasing.orders.lineCount', o.lines.length),
                          o.expectedOn &&
                            (late
                              ? t('adminPurchasing.today.lateSince', {
                                  date: clock.day(o.expectedOn),
                                })
                              : t('adminPurchasing.orders.expected', {
                                  date: clock.day(o.expectedOn),
                                })),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <Icon name="chev" size="sm" className={styles.rowChev} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.note}>
            <Icon name="info" size="xs" />
            {t('adminPurchasing.receive.noneOnTheWay')}
          </p>
        )}
        <button
          type="button"
          className={cx(styles.pick, styles.pickDirect)}
          onClick={() => onPick('direct')}
        >
          <span className={styles.pickIcon} aria-hidden="true">
            <Icon name="store" size="sm" />
          </span>
          <span className={styles.rowMain}>
            <span className={styles.rowTitle}>{t('adminPurchasing.receive.direct')}</span>
            <span className={styles.rowMeta}>{t('adminPurchasing.receive.directHint')}</span>
          </span>
          <Icon name="chev" size="sm" className={styles.rowChev} />
        </button>
      </div>
    </Dialog>
  );
}
