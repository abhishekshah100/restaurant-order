'use client';

import type { ReactNode } from 'react';
import { Icon, IconButton, TablePill } from '@/components/ui';
import { restaurant } from '@/data/restaurant';
import { useTable } from '@/hooks/useTable';
import { cx } from '@/lib/cx';
import { statusLine } from './SiteHeader';
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
  const table = useTable();

  if (props.variant === 'restaurant') {
    return (
      <header className={cx(styles.rhead, 'hide-desktop', props.className)}>
        <Icon name="olive" />
        <div className={styles.rheadText}>
          <p className={styles.rheadName}>{restaurant.name}</p>
          <span className={styles.rheadSub}>{statusLine()}</span>
        </div>
        <TablePill table={table} />
      </header>
    );
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
    backLabel = 'Back',
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
