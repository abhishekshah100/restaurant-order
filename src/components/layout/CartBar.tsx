'use client';

import Link from 'next/link';
import { useEffect, useState, type MouseEvent } from 'react';
import { useContent, useRegion } from '@/api/hooks';
import { Icon } from '@/components/ui';
import dynamic from 'next/dynamic';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { useAddedFlash } from '@/context/CartContext';
import { useCart } from '@/hooks/useCart';
import { useCartItemTotal } from '@/hooks/useOffers';
import { useRegionCopy } from '@/hooks/useRegionCopy';
import { TABLET_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { cx } from '@/lib/cx';
import styles from './CartBar.module.css';

// Downloaded the first time the panel opens.
const CartSlideOver = dynamic(
  () => import('@/components/cart/CartSlideOver').then((m) => m.CartSlideOver),
  { ssr: false, loading: () => <LoadingSignal /> },
);

export interface CartBarProps {
  /** The page has no bottom nav, so the bar sits lower. */
  noNav?: boolean;
}

/**
 * Sticky "1 item · ₹549 — View cart" bar (<1024px). On tablets (768–1023px)
 * it opens the cart as a slide-over panel instead of navigating. When a dish goes in, the bar
 * says so for a moment ("✓ Paneer Tikka added", with a small bump) instead of a toast.
 */
export function CartBar({ noNav }: CartBarProps) {
  const t = useContent('common');
  const { money } = useRegion();
  const { count, hydrated } = useCart();
  // After the offers on now (happy hour): what the menu showed.
  const itemTotal = useCartItemTotal();
  const { currencyName } = useRegionCopy();
  const isTablet = useMediaQuery(TABLET_QUERY);
  const [panelOpen, setPanelOpen] = useState(false);
  const [refocus, setRefocus] = useState(false);
  const added = useAddedFlash();
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
      {/* Said once for screen readers; the bar shows it for a moment. */}
      <span className="visually-hidden" role="status">
        {added ? t('cartBar.added', { dish: added.dish }) : ''}
      </span>
      <Link
        href="/cart/"
        className={cx(styles.bar, added && styles.bump, noNav && styles.noNav, 'hide-desktop')}
        aria-label={t('cartBar.label', { items, total: itemTotal, currencyName })}
        onClick={onClick}
      >
        {/* A new key on each add replays the pop, even for adds in quick succession. */}
        <span key={added?.at ?? 'bag'} className={cx(styles.icon, added && styles.pop)}>
          <Icon name={added ? 'checkc' : 'bag'} />
        </span>
        {added ? (
          <span className={styles.ct}>
            <b className={styles.added}>{t('cartBar.added', { dish: added.dish })}</b>
            <span>
              {items} · {money.format(itemTotal)}
            </span>
          </span>
        ) : (
          <span className={styles.ct}>
            <b>
              {items} · {money.format(itemTotal)}
            </b>
            <span>{t('cartBar.taxes')}</span>
          </span>
        )}
        <span className={styles.go}>
          {t('cartBar.viewCart')}
          <Icon name="arrow" size="sm" />
        </span>
      </Link>
      {panelOpen && <CartSlideOver open onClose={() => setPanelOpen(false)} />}
    </>
  );
}
