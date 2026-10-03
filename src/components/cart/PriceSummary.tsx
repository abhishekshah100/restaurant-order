import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import { formatINR, formatPaise, formatSignedPaise } from '@/lib/format';
import { taxesAndRoundOffPaise, type Bill } from '@/lib/pricing';
import styles from './PriceSummary.module.css';

export type PriceSummaryVariant =
  /** CGST, SGST, service charge, round off (cart). */
  | 'split'
  /** CGST, SGST, round off — a placed order's receipt (order details). */
  | 'receipt'
  /** CGST + SGST (5%), round off (desktop cart panel, payment). */
  | 'combined'
  /** GST 5% + round off on one line (checkout summary). */
  | 'compact';

export interface PriceSummaryProps {
  bill: Bill;
  variant?: PriceSummaryVariant;
  /** Defaults to "To pay" (cart › priceSummary.toPay); "Amount payable" on payment. */
  totalLabel?: string;
  /** Show "(4)" after Item total. */
  showCount?: boolean;
  /** Smaller gap above the total (payment card). */
  tight?: boolean;
}

export function PriceSummary({
  bill,
  variant = 'split',
  totalLabel,
  showCount,
  tight,
}: PriceSummaryProps) {
  const t = useContent('cart');
  const rows: [string, string][] = [
    [
      showCount
        ? t('priceSummary.itemTotalWithCount', { count: bill.itemCount })
        : t('priceSummary.itemTotal'),
      formatPaise(bill.itemTotalPaise),
    ],
  ];
  const roundOff = t('priceSummary.roundOff');
  if (variant === 'split' || variant === 'receipt') {
    rows.push([t('priceSummary.cgst'), formatPaise(bill.cgstPaise)]);
    rows.push([t('priceSummary.sgst'), formatPaise(bill.sgstPaise)]);
    if (variant === 'split') {
      rows.push([t('priceSummary.serviceCharge'), t('priceSummary.notAdded')]);
    }
    rows.push([roundOff, formatSignedPaise(bill.roundOffPaise)]);
  } else if (variant === 'combined') {
    rows.push([t('priceSummary.gstCombined'), formatPaise(bill.gstPaise)]);
    rows.push([roundOff, formatSignedPaise(bill.roundOffPaise)]);
  } else {
    rows.push([t('priceSummary.gstAndRoundOff'), formatPaise(taxesAndRoundOffPaise(bill))]);
  }

  return (
    <dl className={styles.sum}>
      {rows.map(([label, value]) => (
        <div key={label} className={styles.row}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
      <div className={cx(styles.total, tight && styles.tight)}>
        <dt className={styles.lbl}>{totalLabel ?? t('priceSummary.toPay')}</dt>
        <dd className={styles.amt}>{formatINR(bill.total)}</dd>
      </div>
    </dl>
  );
}
