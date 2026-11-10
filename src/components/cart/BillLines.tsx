'use client';

import { useBranch, useContent, useRegion } from '@/api/hooks';
import type { Bill } from '@/lib/pricing';
import { billRows } from './PriceSummary';
import styles from './BillLines.module.css';

/**
 * What an amount is made of, in small print under it (the payment screens): items, discounts,
 * service charge, each tax (CGST, SGST…) and round off; "No tax charged" when there's none, and
 * what was paid earlier when the amount is what's left.
 */
export function BillLines({ bill, paidEarlier = 0 }: { bill: Bill; paidEarlier?: number }) {
  const branch = useBranch();
  const { money } = useRegion();
  const t = useContent('cart');
  const taxed = bill.lines.some((l) => l.id !== 'serviceCharge');
  return (
    <dl className={styles.lines}>
      {billRows(bill, { t, money, tax: branch.tax }).map(([label, value, saving]) => (
        <div key={label} className={styles.row}>
          <dt>{label}</dt>
          <dd className={saving ? styles.saving : undefined}>{value}</dd>
        </div>
      ))}
      {!taxed && (
        <div className={styles.row}>
          <dt>{t('priceSummary.noTax')}</dt>
          <dd />
        </div>
      )}
      {paidEarlier > 0 && (
        <div className={styles.row}>
          <dt>{t('priceSummary.paidEarlier')}</dt>
          <dd className={styles.saving}>− {money.format(paidEarlier)}</dd>
        </div>
      )}
    </dl>
  );
}
