import { useBranch, useContent, useRegion } from '@/api/hooks';
import { cx } from '@/lib/cx';
import { extrasMinor, totalTaxRate, type Bill, type BillLine } from '@/lib/pricing';
import styles from './PriceSummary.module.css';

export type PriceSummaryVariant =
  /** Each charge and tax part (CGST, SGST), "Service charge · Not added" when none, round off (cart). */
  | 'split'
  /** Each charge and tax part, round off — a placed order's receipt (order details). */
  | 'receipt'
  /** Each charge and tax as one line (CGST + SGST 5%), round off (desktop cart panel, payment). */
  | 'combined'
  /** Everything on top of the items on one line, "GST 5% + round off" (checkout summary). */
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

/** One line of the summary: its label, amount, and whether it's a discount (shown as a saving). */
type Row = [label: string, value: string, saving?: boolean];

/** A bill's lines, labelled from content (cart › priceSummary) by the keys in the branch's tax rules. */
export function PriceSummary({
  bill,
  variant = 'split',
  totalLabel,
  showCount,
  tight,
}: PriceSummaryProps) {
  const t = useContent('cart');
  const { tax } = useBranch();
  const { money } = useRegion();
  const line = (l: BillLine): Row => [
    t(`priceSummary.lines.${l.labelKey}`, l.vars),
    money.formatMinor(l.amountMinor),
  ];
  const roundOff: Row[] = bill.showRoundOff
    ? [[t('priceSummary.roundOff'), money.formatSignedMinor(bill.roundOffMinor)]]
    : [];

  const rows: Row[] = [
    [
      showCount
        ? t('priceSummary.itemTotalWithCount', { count: bill.itemCount })
        : t('priceSummary.itemTotal'),
      money.formatMinor(bill.itemTotalMinor),
    ],
    // Discounts come straight off the items: "Happy hour −₹40.00", "Promo WELCOME10 −₹100.00".
    ...bill.discounts.map((d): Row => [
      d.kind === 'offer'
        ? t(`priceSummary.offers.${d.labelKey}`)
        : t('priceSummary.promoCode', { code: d.code }),
      money.formatMinor(-d.amountMinor),
      true,
    ]),
  ];
  // Delivery orders: the fee comes right after the items (it isn't a tax).
  if (bill.deliveryFeeMinor !== null) {
    rows.push([
      t('priceSummary.deliveryFee'),
      bill.deliveryFeeMinor === 0
        ? t('priceSummary.deliveryFree')
        : money.formatMinor(bill.deliveryFeeMinor),
    ]);
  }
  if (variant === 'compact') {
    rows.push([
      t(`priceSummary.compact.${tax.compactLabelKey}`, { rate: totalTaxRate(tax) }),
      money.formatMinor(extrasMinor(bill)),
    ]);
  } else if (variant === 'combined') {
    rows.push(...bill.lines.map(line), ...roundOff);
  } else {
    rows.push(...bill.lines.flatMap((l) => (l.parts ?? [l]).map(line)));
    if (variant === 'split' && !bill.serviceCharged) {
      rows.push([t('priceSummary.serviceCharge'), t('priceSummary.notAdded')]);
    }
    rows.push(...roundOff);
  }

  return (
    <dl className={styles.sum}>
      {rows.map(([label, value, saving]) => (
        <div key={label} className={styles.row}>
          <dt>{label}</dt>
          <dd className={saving ? styles.saving : undefined}>{value}</dd>
        </div>
      ))}
      <div className={cx(styles.total, tight && styles.tight)}>
        <dt className={styles.lbl}>{totalLabel ?? t('priceSummary.toPay')}</dt>
        <dd className={styles.amt}>{money.format(bill.total)}</dd>
      </div>
    </dl>
  );
}
