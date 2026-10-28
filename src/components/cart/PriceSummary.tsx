import { useId, useState } from 'react';
import { useBranch, useContent, useRegion } from '@/api/hooks';
import type { Translator } from '@/api/translator';
import type { ContentMap } from '@/api/queries';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import type { Money } from '@/lib/money';
import { extrasMinor, totalTaxRate, type Bill, type BillLine } from '@/lib/pricing';
import type { Branch } from '@/types/branch';
import styles from './PriceSummary.module.css';

export type PriceSummaryVariant =
  /** Each charge and tax part (CGST, SGST), round off (cart, checkout, staff's order). */
  | 'split'
  /** Each charge and tax part, round off — a placed order's receipt (order details). */
  | 'receipt'
  /** Each charge and tax as one line (CGST + SGST 5%), round off (desktop cart panel). */
  | 'combined'
  /** Everything on top of the items on one line, "GST 5% + round off". */
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
  /** Only the total, with ⌄ to open the lines above it (staff's order popup). */
  collapsible?: boolean;
}

/** One line of the summary: its label, amount, and whether it's a discount (shown as a saving). */
export type BillRow = [label: string, value: string, saving?: boolean];

/**
 * A bill's lines above its total, labelled from content (cart › priceSummary) by the keys in
 * the branch's tax rules: the items, discounts, delivery fee, service charge, taxes, round off.
 * A charge the bill doesn't have isn't listed.
 */
export function billRows(
  bill: Bill,
  {
    t,
    money,
    tax,
    variant = 'split',
    showCount = false,
  }: {
    t: Translator<ContentMap['cart']>;
    money: Money;
    tax: Branch['tax'];
    variant?: PriceSummaryVariant;
    showCount?: boolean;
  },
): BillRow[] {
  const line = (l: BillLine): BillRow => [
    t(`priceSummary.lines.${l.labelKey}`, l.vars),
    money.formatMinor(l.amountMinor),
  ];
  const roundOff: BillRow[] =
    bill.showRoundOff && bill.roundOffMinor !== 0
      ? [[t('priceSummary.roundOff'), money.formatSignedMinor(bill.roundOffMinor)]]
      : [];

  const rows: BillRow[] = [
    [
      showCount
        ? t('priceSummary.itemTotalWithCount', { count: bill.itemCount })
        : t('priceSummary.itemTotal'),
      money.formatMinor(bill.itemTotalMinor),
    ],
    // Discounts come straight off the items: "Happy hour −₹40.00", "Promo WELCOME10 −₹100.00".
    ...bill.discounts.map((d): BillRow => [
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
    rows.push(...bill.lines.flatMap((l) => (l.parts ?? [l]).map(line)), ...roundOff);
  }
  return rows;
}

/** A bill's lines and its total; with `collapsible`, the total alone until ⌄ opens the lines. */
export function PriceSummary({
  bill,
  variant = 'split',
  totalLabel,
  showCount,
  tight,
  collapsible = false,
}: PriceSummaryProps) {
  const t = useContent('cart');
  const { tax } = useBranch();
  const { money } = useRegion();
  const rows = billRows(bill, { t, money, tax, variant, showCount: showCount ?? false });
  return (
    <BillSummary
      rows={rows}
      totalLabel={totalLabel ?? t('priceSummary.toPay')}
      total={money.format(bill.total)}
      tight={tight}
      collapsible={collapsible}
    />
  );
}

/**
 * Rows over a total. Collapsible: the total is a button (⌄) that shows or hides the rows, and
 * says so to screen readers.
 */
export function BillSummary({
  rows,
  totalLabel,
  total,
  tight,
  collapsible = false,
}: {
  rows: readonly BillRow[];
  totalLabel: string;
  total: string;
  tight?: boolean;
  collapsible?: boolean;
}) {
  const t = useContent('cart');
  const [open, setOpen] = useState(false);
  const id = useId();
  const shown = !collapsible || open;

  return (
    <dl id={id} className={cx(styles.sum, collapsible && styles.collapsible)}>
      {shown &&
        rows.map(([label, value, saving]) => (
          <div key={label} className={styles.row}>
            <dt>{label}</dt>
            <dd className={saving ? styles.saving : undefined}>{value}</dd>
          </div>
        ))}
      <div className={cx(styles.total, tight && styles.tight, !shown && styles.alone)}>
        <dt className={styles.lbl}>
          {collapsible ? (
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={open}
              aria-controls={id}
              onClick={() => setOpen((o) => !o)}
            >
              {totalLabel}
              <Icon name="chevd" size="xs" className={cx(styles.chevron, open && styles.open)} />
              <span className="visually-hidden">
                {open ? t('priceSummary.hideDetails') : t('priceSummary.showDetails')}
              </span>
            </button>
          ) : (
            totalLabel
          )}
        </dt>
        <dd className={styles.amt}>{total}</dd>
      </div>
    </dl>
  );
}
