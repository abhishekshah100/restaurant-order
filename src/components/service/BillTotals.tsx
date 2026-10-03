import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import { formatINR } from '@/lib/format';
import type { BillSummary } from '@/lib/service';
import type { BillScope } from '@/types/service';
import styles from './BillTotals.module.css';

interface BillTotalsProps {
  bill: BillSummary;
  scope: BillScope;
  /** list: rows with a dashed total (20 · w20 · 21) · tiles: three across (w21). */
  layout?: 'list' | 'tiles';
  /** Show the paid amount as a deduction (request page) or as a plain amount (confirmation). */
  signed?: boolean;
  /** Only the balance row: everything listed is due (the pay page). List layout only. */
  balanceOnly?: boolean;
  className?: string;
}

/** Total · already paid · balance due. */
export function BillTotals({
  bill,
  scope,
  layout = 'list',
  signed,
  balanceOnly,
  className,
}: BillTotalsProps) {
  const t = useContent('service');
  const totalLabel = scope === 'mine' ? t('billTotals.mine') : t('billTotals.table');
  const paid = signed ? `− ${formatINR(bill.paid)}` : formatINR(bill.paid);

  if (layout === 'tiles') {
    return (
      <dl className={cx(styles.tiles, className)}>
        <div className={styles.tile}>
          <dt>{totalLabel}</dt>
          <dd>{formatINR(bill.total)}</dd>
        </div>
        <div className={styles.tile}>
          <dt>{t('billTotals.paid')}</dt>
          <dd className={styles.ok}>{formatINR(bill.paid)}</dd>
        </div>
        <div className={styles.tile}>
          <dt>{t('billTotals.balance')}</dt>
          <dd className={styles.tileBalance}>{formatINR(bill.balance)}</dd>
        </div>
      </dl>
    );
  }

  return (
    <dl className={cx(styles.list, className)}>
      {!balanceOnly && (
        <div className={styles.row}>
          <dt>{totalLabel}</dt>
          <dd>{formatINR(bill.total)}</dd>
        </div>
      )}
      {!balanceOnly && bill.paid > 0 && (
        <div className={styles.row}>
          <dt>{t('billTotals.paid')}</dt>
          <dd className={styles.ok}>{paid}</dd>
        </div>
      )}
      <div className={styles.total}>
        <dt>{t('billTotals.balance')}</dt>
        <dd>{formatINR(bill.balance)}</dd>
      </div>
    </dl>
  );
}
