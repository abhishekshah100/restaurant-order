import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './styleguide.module.css';

/** One styleguide card: a small caps title and its examples. */
export function Section({
  id,
  title,
  wide,
  children,
}: {
  id: string;
  title: ReactNode;
  /** Spans both grid columns. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cx(styles.card, wide && styles.wide)} aria-labelledby={id}>
      <h2 id={id} className={styles.cardTitle}>
        {title}
      </h2>
      {children}
    </section>
  );
}
