import { cx } from '@/lib/cx';
import { formatINR, formatPaise, formatSignedPaise } from '@/lib/format';
import { taxesAndRoundOffPaise, type Bill } from '@/lib/pricing';
import styles from './PriceSummary.module.css';

export type PriceSummaryVariant =
  /** CGST, SGST, service charge, round off (cart). */
  | 'split'
  /** CGST + SGST (5%), round off (desktop cart panel, payment). */
  | 'combined'
  /** GST 5% + round off on one line (checkout summary). */
  | 'compact'
  /** Only the total. */
  | 'total';

export interface PriceSummaryProps {
  bill: Bill;
  variant?: PriceSummaryVariant;
  /** "To pay" or "Amount payable". */
  totalLabel?: string;
  /** Show "(4)" after Item total. */
  showCount?: boolean;
  /** Smaller gap above the total (payment card). */
  tight?: boolean;
  className?: string;
}

export function PriceSummary({
  bill,
  variant = 'split',
  totalLabel = 'To pay',
  showCount,
  tight,
  className,
}: PriceSummaryProps) {
  const rows: [string, string][] = [];
  if (variant !== 'total') {
    rows.push([
      `Item total${showCount ? ` (${bill.itemCount})` : ''}`,
      formatPaise(bill.itemTotalPaise),
    ]);
  }
  if (variant === 'split') {
    rows.push(['CGST (2.5%)', formatPaise(bill.cgstPaise)]);
    rows.push(['SGST (2.5%)', formatPaise(bill.sgstPaise)]);
    rows.push(['Service charge', 'Not added']);
    rows.push(['Round off', formatSignedPaise(bill.roundOffPaise)]);
  } else if (variant === 'combined') {
    rows.push(['CGST + SGST (5%)', formatPaise(bill.gstPaise)]);
    rows.push(['Round off', formatSignedPaise(bill.roundOffPaise)]);
  } else if (variant === 'compact') {
    rows.push(['GST 5% + round off', formatPaise(taxesAndRoundOffPaise(bill))]);
  }

  return (
    <dl className={cx(styles.sum, className)}>
      {rows.map(([label, value]) => (
        <div key={label} className={styles.row}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
      <div
        className={cx(styles.total, variant === 'total' && styles.totalOnly, tight && styles.tight)}
      >
        <dt className={styles.lbl}>{totalLabel}</dt>
        <dd className={styles.amt}>{formatINR(bill.total)}</dd>
      </div>
    </dl>
  );
}

export interface SummaryLinesProps {
  lines: { label: string; amount: number }[];
}

/** "1 × Paneer Tikka (Full) ₹549" rows in checkout summaries. */
export function SummaryLines({ lines }: SummaryLinesProps) {
  return (
    <dl className={styles.sum}>
      {lines.map((line, i) => (
        <div key={`${line.label}-${i}`} className={styles.row}>
          <dt>{line.label}</dt>
          <dd>{formatINR(line.amount)}</dd>
        </div>
      ))}
    </dl>
  );
}
