import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui';
import { cx } from '@/lib/cx';
import styles from './OptionsList.module.css';

/** One thing a "More" menu offers: what it is, a line on what it does, and doing it. */
export interface OptionItem {
  key: string;
  icon: IconName;
  title: string;
  body: string;
  /** Tapping it (an arrow shows). Without: a heading over `extra` (pick one of those). */
  onSelect?: () => void;
  /** Red: it takes something away (Clear week). */
  danger?: boolean;
  /** Under it: further choices (a category to reorder). */
  extra?: ReactNode;
}

/**
 * A page's "More" menu (Rota, Menu): the things done now and then, each with an icon, its name,
 * a line on what it does and an arrow; the risky ones in red.
 */
export function OptionsList({ items }: { items: readonly OptionItem[] }) {
  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const inner = (
          <>
            <span className={styles.icon} aria-hidden="true">
              <Icon name={item.icon} size="sm" />
            </span>
            <span className={styles.text}>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </span>
          </>
        );
        return (
          <li key={item.key} className={cx(item.extra !== undefined && styles.group)}>
            {item.onSelect ? (
              <button
                type="button"
                className={cx(styles.item, item.danger && styles.danger)}
                onClick={item.onSelect}
              >
                {inner}
                <Icon name="chev" size="xs" />
              </button>
            ) : (
              <span className={styles.item}>{inner}</span>
            )}
            {item.extra && <div className={styles.extra}>{item.extra}</div>}
          </li>
        );
      })}
    </ul>
  );
}
