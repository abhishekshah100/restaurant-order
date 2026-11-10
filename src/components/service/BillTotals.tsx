import { useBranch, useContent, useRegion } from '@/api/hooks';
import { billRows } from '@/components/cart/PriceSummary';
import { cx } from '@/lib/cx';
import { orderBill } from '@/lib/orders';
import { combineBills } from '@/lib/pricing';
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
  /**
   * The orders' bills added up above the total: items, discounts, service charge, each tax
   * (CGST, SGST…) and round off, as on each order's own bill (list layout only).
   */
  breakdown?: boolean;
  className?: string;
}

/** Total · already paid · balance due. */
export function BillTotals({
  bill,
  scope,
  layout = 'list',
  signed,
  balanceOnly,
  breakdown,
  className,
}: BillTotalsProps) {
  const t = useContent('service');
  const { money } = useRegion();
  const totalLabel = scope === 'mine' ? t('billTotals.mine') : t('billTotals.table');
  const paid = signed ? `− ${money.format(bill.paid)}` : money.format(bill.paid);

  if (layout === 'tiles') {
    return (
      <dl className={cx(styles.tiles, className)}>
        <div className={styles.tile}>
          <dt>{totalLabel}</dt>
          <dd>{money.format(bill.total)}</dd>
        </div>
        <div className={styles.tile}>
          <dt>{t('billTotals.paid')}</dt>
          <dd className={styles.ok}>{money.format(bill.paid)}</dd>
        </div>
        <div className={styles.tile}>
          <dt>{t('billTotals.balance')}</dt>
          <dd className={styles.tileBalance}>{money.format(bill.balance)}</dd>
        </div>
      </dl>
    );
  }

  return (
    <dl className={cx(styles.list, className)}>
      {breakdown && !balanceOnly && <Breakdown bill={bill} />}
      {!balanceOnly && (
        <div className={cx(styles.row, breakdown && styles.subtotal)}>
          <dt>{totalLabel}</dt>
          <dd>{money.format(bill.total)}</dd>
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
        <dd>{money.format(bill.balance)}</dd>
      </div>
    </dl>
  );
}

/** The orders' charges added up, labelled as on a bill; "No tax charged" when there's none. */
function Breakdown({ bill }: { bill: BillSummary }) {
  const branch = useBranch();
  const { money } = useRegion();
  const cart = useContent('cart');
  const t = useContent('service');
  const combined = combineBills(bill.orders.map((o) => orderBill(o, branch)));
  const taxed = combined.lines.some((l) => l.id !== 'serviceCharge');
  return (
    <>
      {billRows(combined, { t: cart, money, tax: branch.tax }).map(([label, value, saving]) => (
        <div key={label} className={styles.row}>
          <dt>{label}</dt>
          <dd className={saving ? styles.ok : undefined}>{value}</dd>
        </div>
      ))}
      {!taxed && (
        <div className={styles.row}>
          <dt>{t('billTotals.noTax')}</dt>
          <dd />
        </div>
      )}
    </>
  );
}
