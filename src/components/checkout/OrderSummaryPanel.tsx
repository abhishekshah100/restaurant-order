'use client';

import Link from 'next/link';
import Image from 'next/image';
import { PriceSummary, type PriceSummaryVariant } from '@/components/cart/PriceSummary';
import { Icon, VegMark } from '@/components/ui';
import { useCart } from '@/hooks/useCart';
import { useOrderBill } from '@/hooks/useFulfilment';
import { etaMinutes } from '@/lib/fulfilment';
import { describeOptionsShort } from '@/lib/cartLine';
import { cx } from '@/lib/cx';
import { useBranch, useContent, useMenu, useRegion } from '@/api/hooks';
import { dishImage } from '@/lib/menu';
import { useCartLineLabels } from '@/hooks/useCartLineLabels';
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
  const { lines } = useCart();
  const { bill, mode, quote } = useOrderBill();
  const menu = useMenu();
  const branch = useBranch();
  const t = useContent('checkout');
  const { money } = useRegion();
  const labels = useCartLineLabels();
  return (
    <aside className={cx(styles.summary, 'hide-mobile')} aria-labelledby="order-summary">
      <div className={styles.summaryHead}>
        <h2 id="order-summary" className="t-h2">
          {t('summary.title')}
        </h2>
        {editable && (
          <Link href="/cart/" className={styles.editLink}>
            {t('summary.edit')}
          </Link>
        )}
      </div>
      <ul className={styles.sumItems}>
        {lines.map((line) => {
          const dish = menu.getDish(line.dishSlug);
          if (!dish) return null;
          const thumb = dishImage(dish, 'thumb');
          const options = describeOptionsShort(dish, line, labels);
          return (
            <li key={line.key} className={styles.sumItem}>
              <span className={styles.sumThumb} aria-hidden="true">
                {thumb ? (
                  <Image
                    src={thumb.src}
                    alt={''}
                    width={thumb.width}
                    height={thumb.height}
                    sizes="44px"
                  />
                ) : (
                  dish.name.charAt(0)
                )}
                <span className={styles.sumQty}>{line.quantity}</span>
              </span>
              <span className={styles.sumText}>
                <span className={styles.sumName}>
                  <VegMark veg={dish.veg} />
                  <span>
                    <span className="visually-hidden">
                      {t('summary.quantity', { count: line.quantity })}
                    </span>
                    {dish.name}
                  </span>
                </span>
                {options && <span className={styles.sumOpts}>{options}</span>}
              </span>
              <span className={styles.sumPrice}>
                {money.format(line.quantity * line.unitPrice)}
              </span>
            </li>
          );
        })}
      </ul>
      <hr className={styles.hr} />
      <PriceSummary bill={bill} variant={variant} totalLabel={totalLabel} />
      <span className={styles.etaPill}>
        <Icon name="clock" size="xs" />
        {mode === 'dineIn'
          ? t('summary.eta', { time: branch.prepTime })
          : t(`summary.etaMode.${mode}`, { minutes: etaMinutes(branch, mode, quote) })}
      </span>
      {footnote && <p className="t-small c3">{footnote}</p>}
    </aside>
  );
}
