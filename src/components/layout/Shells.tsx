import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './Shells.module.css';

/** Full-height page column. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.page, className)}>{children}</div>;
}

export interface MenuShellProps {
  sidebar: ReactNode;
  /** Desktop right column (the cart panel). */
  cart: ReactNode;
  children: ReactNode;
  /** 20px gaps in the centre column (category, search). */
  tight?: boolean;
  /** Props for the centre <main>. */
  mainProps?: { 'aria-busy'?: boolean; role?: string };
}

/** Categories | Menu | Cart on desktop; just the menu column below 1024px. */
export function MenuShell({ sidebar, cart, children, tight, mainProps }: MenuShellProps) {
  return (
    <div className={styles.shell}>
      {sidebar}
      <main id="main" className={cx(styles.center, tight && styles.tight)} {...mainProps}>
        {children}
      </main>
      <div className={styles.cart}>{cart}</div>
    </div>
  );
}

export interface ColumnsProps {
  children: ReactNode;
  /** Two equal columns (food detail). */
  even?: boolean;
  className?: string;
}

/** Two-column grid from 1024px; a plain stack below. */
export function Columns({ children, even, className }: ColumnsProps) {
  return <div className={cx(styles.cols, even && styles.even, className)}>{children}</div>;
}

/** Desktop: content centred under the header (status cards). Mobile: normal flow. */
export function Centered({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.centered, className)}>{children}</div>;
}
