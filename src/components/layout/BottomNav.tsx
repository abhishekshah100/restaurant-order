'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import { NAV_ITEMS, isNavActive } from './navItems';
import styles from './BottomNav.module.css';

/** Mobile primary navigation (<1024px). */
export function BottomNav() {
  const t = useContent('common');
  const pathname = usePathname();
  return (
    <>
      <div className={cx(styles.spacer, 'hide-desktop')} aria-hidden="true" />
      <nav className={cx(styles.nav, 'hide-desktop')} aria-label={t('nav.label')}>
        {NAV_ITEMS.map((item) => {
          const on = isNavActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(styles.link, on && styles.on)}
              aria-current={on ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              {t(`nav.${item.id}`)}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
