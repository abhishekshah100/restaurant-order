'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import styles from './BottomNav.module.css';

const ITEMS = [
  { href: '/menu/', label: 'Menu', icon: 'menu', match: ['/menu'] },
  { href: '/orders/', label: 'My orders', icon: 'list', match: ['/orders', '/order/'] },
  { href: '/help/', label: 'Service', icon: 'bell', match: ['/help'] },
] as const;

/** Mobile primary navigation (<1024px). */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <>
      <div className={cx(styles.spacer, 'hide-desktop')} aria-hidden="true" />
      <nav className={cx(styles.nav, 'hide-desktop')} aria-label="Primary">
        {ITEMS.map((item) => {
          const on = item.match.some((m) => pathname.startsWith(m));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(styles.link, on && styles.on)}
              aria-current={on ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
