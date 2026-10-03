import { cx } from '@/lib/cx';
import styles from './Badge.module.css';

export interface BadgeProps {
  count: number;
  /** Accessible text, e.g. "3 items in cart", read instead of the number. */
  label?: string;
  className?: string;
}

export function Badge({ count, label, className }: BadgeProps) {
  return (
    <span className={cx(styles.badge, className)}>
      {label ? (
        <>
          <span aria-hidden="true">{count}</span>
          <span className="visually-hidden">{label}</span>
        </>
      ) : (
        count
      )}
    </span>
  );
}
