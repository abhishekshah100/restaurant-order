'use client';

import Link from 'next/link';
import {
  PriceSummary,
  SummaryLines,
  type PriceSummaryVariant,
} from '@/components/cart/PriceSummary';
import { useCart } from '@/hooks/useCart';
import { summaryName } from '@/lib/cartLine';
import { cx } from '@/lib/cx';
import { getDish } from '@/lib/menu';
import styles from './Checkout.module.css';

export interface OrderSummaryPanelProps {
  variant?: PriceSummaryVariant;
  totalLabel?: string;
  /** Show the "Edit" link back to the cart. */
  editable?: boolean;
  footnote?: string;
}

/** Desktop checkout aside: line summary and bill (w09–w11). */
export function OrderSummaryPanel({
  variant = 'compact',
  totalLabel,
  editable = true,
  footnote,
}: OrderSummaryPanelProps) {
  const { lines, bill } = useCart();
  const rows = lines.flatMap((line) => {
    const dish = getDish(line.dishSlug);
    return dish
      ? [
          {
            label: `${line.quantity} × ${summaryName(dish, line)}`,
            amount: line.quantity * line.unitPrice,
          },
        ]
      : [];
  });

  return (
    <aside className={cx(styles.summary, 'hide-mobile')} aria-labelledby="order-summary">
      <div className={styles.summaryHead}>
        <h2 id="order-summary" className="t-h2">
          Order summary
        </h2>
        {editable && (
          <Link href="/cart/" className={styles.editLink}>
            Edit
          </Link>
        )}
      </div>
      <SummaryLines lines={rows} />
      {variant !== 'total' && <hr className={styles.hr} />}
      <PriceSummary bill={bill} variant={variant} totalLabel={totalLabel} />
      {footnote && <p className="t-small c3">{footnote}</p>}
    </aside>
  );
}
