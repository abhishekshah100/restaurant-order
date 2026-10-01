import { cx } from '@/lib/cx';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  shape?: 'line' | 'title' | 'block' | 'circle';
  /** CSS length; dynamic per use, so applied inline. */
  width?: string | number;
  height?: string | number;
  className?: string;
}

/** Decorative placeholder. Wrap groups in an element with aria-busy and a text label. */
export function Skeleton({ shape = 'line', width, height, className }: SkeletonProps) {
  return (
    <span
      className={cx(styles.sk, styles[shape], className)}
      style={width !== undefined || height !== undefined ? { width, height } : undefined}
      aria-hidden="true"
    />
  );
}
