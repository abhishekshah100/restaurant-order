import { cx } from '@/lib/cx';
import styles from './Spinner.module.css';

export interface SpinnerProps {
  tone?: 'light' | 'brand';
  size?: 'md' | 'lg';
  className?: string;
}

/** Decorative spinner. Announce progress with text or aria-busy on the owner. */
export function Spinner({ tone = 'light', size = 'md', className }: SpinnerProps) {
  return (
    <span
      className={cx(
        styles.spinner,
        tone === 'brand' && styles.brand,
        size === 'lg' && styles.lg,
        className,
      )}
      aria-hidden="true"
    />
  );
}
