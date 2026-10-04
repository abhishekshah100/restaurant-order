'use client';

import Link from 'next/link';
import { useEffect, useState, type MouseEvent } from 'react';
import { useContent, useRegion } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { CartSlideOver } from '@/components/cart/CartSlideOver';
import { useCart } from '@/hooks/useCart';
import { useRegionCopy } from '@/hooks/useRegionCopy';
import { TABLET_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { cx } from '@/lib/cx';
import styles from './CartBar.module.css';

export interface CartBarProps {
  /** The page has no bottom nav, so the bar sits lower. */
  noNav?: boolean;
}

/**
 * Sticky "1 item · ₹549 — View cart" bar (<1024px). On tablets (768–1023px)
 * it opens the cart as a slide-over panel instead of navigating.
 */
export function CartBar({ noNav }: CartBarProps) {
  const t = useContent('common');
  const { money } = useRegion();
  const { count, bill, hydrated } = useCart();
  const { currencyName } = useRegionCopy();
  const isTablet = useMediaQuery(TABLET_QUERY);
  const [panelOpen, setPanelOpen] = useState(false);
  const [refocus, setRefocus] = useState(false);
  const empty = !hydrated || count === 0;

  // Emptying the cart inside the slide-over unmounts the bar (the panel's focus-return
  // target). Close the panel so the next add doesn't reopen it, and park focus on the page.
  if (panelOpen && empty) {
    setPanelOpen(false);
    setRefocus(true);
  }

  useEffect(() => {
    if (!refocus) return;
    const main = document.getElementById('main');
    if (!main) return;
    main.tabIndex = -1;
    main.focus({ preventScroll: true });
  }, [refocus]);

  if (empty) return null;

  const onClick = (event: MouseEvent) => {
    if (!isTablet) return;
    event.preventDefault();
    setRefocus(false);
    setPanelOpen(true);
  };

  const items = t.plural('itemCount', count);
  return (
    <>
      <div className={cx(styles.spacer, 'hide-desktop')} aria-hidden="true" />
      <Link
        href="/cart/"
        className={cx(styles.bar, noNav && styles.noNav, 'hide-desktop')}
        aria-label={t('cartBar.label', { items, total: bill.itemTotal, currencyName })}
        onClick={onClick}
      >
        <Icon name="bag" />
        <span className={styles.ct}>
          <b>
            {items} · {money.format(bill.itemTotal)}
          </b>
          <span>{t('cartBar.taxes')}</span>
        </span>
        <span className={styles.go}>
          {t('cartBar.viewCart')}
          <Icon name="arrow" size="sm" />
        </span>
      </Link>
      <CartSlideOver open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
