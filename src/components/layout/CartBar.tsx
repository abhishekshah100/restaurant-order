'use client';

import Link from 'next/link';
import { useState, type MouseEvent } from 'react';
import { Icon } from '@/components/ui';
import { CartSlideOver } from '@/components/cart/CartSlideOver';
import { useCart } from '@/hooks/useCart';
import { TABLET_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { cx } from '@/lib/cx';
import { formatINR, pluralize } from '@/lib/format';
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
  const { count, bill, hydrated } = useCart();
  const isTablet = useMediaQuery(TABLET_QUERY);
  const [panelOpen, setPanelOpen] = useState(false);

  if (!hydrated || count === 0) return null;

  const onClick = (event: MouseEvent) => {
    if (!isTablet) return;
    event.preventDefault();
    setPanelOpen(true);
  };

  const items = pluralize(count, 'item');
  return (
    <>
      <div className={cx(styles.spacer, 'hide-desktop')} aria-hidden="true" />
      <Link
        href="/cart/"
        className={cx(styles.bar, noNav && styles.noNav, 'hide-desktop')}
        aria-label={`View cart, ${items}, ${bill.itemTotal} rupees plus taxes`}
        onClick={onClick}
      >
        <Icon name="bag" />
        <span className={styles.ct}>
          <b>
            {items} · {formatINR(bill.itemTotal)}
          </b>
          <span>Plus taxes</span>
        </span>
        <span className={styles.go}>
          View cart
          <Icon name="arrow" size="sm" />
        </span>
      </Link>
      <CartSlideOver open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
