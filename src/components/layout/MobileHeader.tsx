'use client';

import type { ReactNode } from 'react';
import { Icon, IconButton, TablePill } from '@/components/ui';
import { useContent, useRestaurant } from '@/api/hooks';
import { useStatusLine } from '@/hooks/useRestaurantStatus';
import { useTable } from '@/hooks/useTable';
import { cx } from '@/lib/cx';
import styles from './MobileHeader.module.css';

interface Common {
  className?: string;
}

export interface RestaurantHeaderProps extends Common {
  variant: 'restaurant';
}

export interface TopbarHeaderProps extends Common {
  variant: 'topbar';
  title?: string;
  /** Visible title is an <h1> unless the page has its own. */
  titleAs?: 'h1' | 'p';
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
  /** Extra buttons before the table pill (e.g. search). */
  actions?: ReactNode;
  /** Replace the default content (e.g. the search field). */
  children?: ReactNode;
  hideTable?: boolean;
}

export interface PillHeaderProps extends Common {
  /** Only the table pill: centered (payment processing) or right-aligned (results). */
  variant: 'pill-center' | 'pill-end';
}

export type MobileHeaderProps = RestaurantHeaderProps | TopbarHeaderProps | PillHeaderProps;

/** Mobile / tablet header (<1024px). Hidden from 1024px, where SiteHeader takes over. */
export function MobileHeader(props: MobileHeaderProps) {
  const t = useContent('common');
  const restaurant = useRestaurant();
  const table = useTable();

  if (props.variant === 'restaurant') {
    return <RestaurantHeader table={table} className={props.className} />;
  }

  if (props.variant !== 'topbar') {
    return (
      <header
        className={cx(
          styles.topbar,
          props.variant === 'pill-center' ? styles.centered : styles.end,
          'hide-desktop',
          props.className,
        )}
      >
        <TablePill
          table={table}
          prefix={props.variant === 'pill-center' ? `${restaurant.name} · ` : undefined}
        />
      </header>
    );
  }

  const {
    title,
    titleAs = 'h1',
    backHref,
    backLabel = t('header.back'),
    onBack,
    actions,
    children,
    hideTable,
  } = props;
  const Title = titleAs;
  return (
    <header className={cx(styles.topbar, 'hide-desktop', props.className)}>
      {backHref && <IconButton icon="back" label={backLabel} href={backHref} onClick={onBack} />}
      {!backHref && onBack && <IconButton icon="back" label={backLabel} onClick={onBack} />}
      {children ??
        (title ? (
          <Title className={styles.title}>{title}</Title>
        ) : (
          <span className={styles.spacer} />
        ))}
      {actions}
      {!hideTable && <TablePill table={table} />}
    </header>
  );
}

/** Brand, live status line and table pill (menu home and the restaurant-state screens). */
function RestaurantHeader({ table, className }: { table: number; className?: string }) {
  const restaurant = useRestaurant();
  const status = useStatusLine();
  return (
    <header className={cx(styles.rhead, 'hide-desktop', className)}>
      <Icon name="olive" />
      <div className={styles.rheadText}>
        <p className={styles.rheadName}>{restaurant.name}</p>
        <span
          className={cx(
            styles.rheadSub,
            status.tone === 'error' && styles.subError,
            status.tone === 'warn' && styles.subWarn,
          )}
        >
          {status.text}
        </span>
      </div>
      <TablePill table={table} />
    </header>
  );
}
