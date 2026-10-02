'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, TablePill } from '@/components/ui';
import { restaurant } from '@/data/restaurant';
import { useCart } from '@/hooks/useCart';
import { useTable } from '@/hooks/useTable';
import { cx } from '@/lib/cx';
import { formatINR } from '@/lib/format';
import { HeaderSearch } from './HeaderSearch';
import { CheckoutStepsBar, type CheckoutStep } from './CheckoutSteps';
import styles from './SiteHeader.module.css';

export type SiteHeaderVariant = 'default' | 'checkout' | 'payment';

export interface SiteHeaderProps {
  variant?: SiteHeaderVariant;
  /** Current checkout step (checkout variant). */
  step?: CheckoutStep;
  /** Show the cart button (pages without the cart panel). */
  showCart?: boolean;
  className?: string;
}

const NAV = [
  { href: '/menu/', label: 'Menu', icon: 'menu', match: ['/menu', '/dish', '/search', '/cart'] },
  { href: '/orders/', label: 'My orders', icon: 'list', match: ['/orders', '/order/'] },
  { href: '/help/', label: 'Service', icon: 'bell', match: ['/help'] },
] as const;

export function statusLine(): string {
  if (restaurant.status === 'closed') return 'Closed now';
  if (restaurant.status === 'paused') return 'Ordering paused';
  return `Open · until ${restaurant.closesAt}`;
}

/** Desktop header (≥1024px). Hidden below 1024px; MobileHeader takes over. */
export function SiteHeader({ variant = 'default', step, showCart, className }: SiteHeaderProps) {
  const pathname = usePathname();
  const table = useTable();
  const { count, bill, hydrated } = useCart();
  const isCheckout = variant !== 'default';

  return (
    <header className={cx(styles.wh, 'hide-mobile', className)}>
      <div className={styles.wrap}>
        <Link href={isCheckout ? '/menu/' : '/'} className={styles.brand}>
          <Icon name="olive" />
          <span>
            <span className={styles.brandName}>{restaurant.name}</span>
            <span className={styles.brandSub}>{isCheckout ? 'Checkout' : statusLine()}</span>
          </span>
        </Link>

        {variant === 'default' && (
          <>
            <div className={styles.searchSlot}>
              <HeaderSearch />
            </div>
            <nav className={styles.nav} aria-label="Primary">
              {NAV.map((item) => {
                const on = item.match.some((m) => pathname.startsWith(m));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cx(styles.navLink, on && styles.navOn)}
                    aria-current={on ? 'page' : undefined}
                  >
                    <Icon name={item.icon} size="sm" />
                    {item.label}
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
            {variant === 'payment' ? 'Secure payment' : 'Secure'}
          </span>
        )}

        <TablePill table={table} />

        {showCart && (
          <Link
            href="/cart/"
            className={cx(styles.cart, (!hydrated || count === 0) && styles.cartEmpty)}
            aria-label={
              hydrated && count > 0
                ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}, ${bill.itemTotal} rupees`
                : 'Cart, empty'
            }
          >
            <Icon name="bag" size="sm" />
            {hydrated && count > 0 ? `${count} · ${formatINR(bill.itemTotal)}` : 'Cart'}
          </Link>
        )}
      </div>
    </header>
  );
}
