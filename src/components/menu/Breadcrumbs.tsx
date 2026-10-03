import Link from 'next/link';
import { Fragment } from 'react';
import { Icon } from '@/components/ui';
import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import styles from './MenuViews.module.css';

export interface Crumb {
  label: string;
  href?: string;
}

/** Desktop breadcrumb: Menu › Mains › Truffle Mushroom Pasta. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const t = useContent('menu');
  return (
    <nav className={cx(styles.crumbs, 'hide-mobile', className)} aria-label={t('nav.breadcrumb')}>
      {items.map((item, i) => (
        <Fragment key={item.label}>
          {i > 0 && <Icon name="chev" />}
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
