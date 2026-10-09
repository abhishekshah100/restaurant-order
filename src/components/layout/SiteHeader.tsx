'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui';
import { useBranch, useContent, useRegion } from '@/api/hooks';
import { useCart } from '@/hooks/useCart';
import { useCartItemTotal } from '@/hooks/useOffers';
import { useRegionCopy } from '@/hooks/useRegionCopy';
import { useStatusLine } from '@/hooks/useRestaurantStatus';
import { cx } from '@/lib/cx';
import { HeaderSearch } from './HeaderSearch';
import { CheckoutStepsBar, type CheckoutStep } from './CheckoutSteps';
import { NAV_ITEMS, isNavActive } from './navItems';
import { VisitPill } from './VisitPill';
import styles from './SiteHeader.module.css';

/** minimal: brand and table pill only (restaurant closed / offline, ws01 · ws03). */
export type SiteHeaderVariant = 'default' | 'minimal' | 'checkout' | 'payment';

export interface SiteHeaderProps {
  variant?: SiteHeaderVariant;
  /** Current checkout step (checkout variant). */
  step?: CheckoutStep;
  /** Show the cart button (pages without the cart panel). */
  showCart?: boolean;
  /** Line under the brand in the checkout and payment variants (default "Checkout"). */
  subtitle?: string;
  className?: string;
}

/** Desktop header (≥1024px). Hidden below 1024px; MobileHeader takes over. */
export function SiteHeader({
  variant = 'default',
  step,
  showCart,
  subtitle,
  className,
}: SiteHeaderProps) {
  const t = useContent('common');
  const branch = useBranch();
  const { money } = useRegion();
  const pathname = usePathname();
  const { count, hydrated } = useCart();
  // After the offers on now (happy hour): what the menu showed.
  const itemTotal = useCartItemTotal();
  const { currencyName } = useRegionCopy();
  const status = useStatusLine();
  const isCheckout = variant === 'checkout' || variant === 'payment';

  return (
    <header className={cx(styles.wh, 'hide-mobile', className)}>
      <div className={styles.wrap}>
        <Link href={isCheckout ? '/menu/' : '/'} className={styles.brand}>
          <Icon name="olive" />
          <span>
            <span className={styles.brandName}>{branch.name}</span>
            <span
              className={cx(
                styles.brandSub,
                !isCheckout && status.tone === 'error' && styles.subError,
                !isCheckout && status.tone === 'warn' && styles.subWarn,
              )}
            >
              {isCheckout ? (subtitle ?? t('header.checkout')) : status.text}
            </span>
          </span>
        </Link>

        {variant === 'default' && (
          <>
            <div className={styles.searchSlot}>
              <HeaderSearch />
            </div>
            <nav className={styles.nav} aria-label={t('nav.label')}>
              {NAV_ITEMS.map((item) => {
                const on = isNavActive(item, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cx(styles.navLink, on && styles.navOn)}
                    aria-current={on ? 'page' : undefined}
                  >
                    <Icon name={item.icon} size="sm" />
                    {t(`nav.${item.id}`)}
                  </Link>
                );
              })}
            </nav>
          </>
        )}

        {variant === 'checkout' && step && (
          <CheckoutStepsBar current={step} className={styles.steps} />
        )}
        {isCheckout && (
          <span className={styles.secure}>
            <Icon name="lock" size="sm" />
            {variant === 'payment' ? t('header.securePayment') : t('header.secure')}
          </span>
        )}

        <VisitPill className={variant === 'minimal' ? styles.pushEnd : undefined} />

        {showCart && (
          <Link
            href="/cart/"
            className={cx(styles.cart, (!hydrated || count === 0) && styles.cartEmpty)}
            aria-label={
              hydrated && count > 0
                ? t('cart.summaryLabel', {
                    items: t.plural('itemCount', count),
                    total: itemTotal,
                    currencyName,
                  })
                : t('cart.emptyLabel')
            }
          >
            <Icon name="bag" size="sm" />
            {hydrated && count > 0 ? `${count} · ${money.format(itemTotal)}` : t('cart.label')}
          </Link>
        )}
      </div>
    </header>
  );
}
