import { cx } from '@/lib/cx';
import styles from './VegMark.module.css';

export interface VegMarkProps {
  veg: boolean;
  /** Show "Vegetarian" / "Non-vegetarian" next to the mark. */
  showLabel?: boolean;
  /** Hide from assistive tech when a sibling already says veg / non-veg. */
  decorative?: boolean;
  className?: string;
}

export function VegMark({ veg, showLabel, decorative, className }: VegMarkProps) {
  const text = veg ? 'Vegetarian' : 'Non-vegetarian';
  const mark = (
    <span
      className={cx(styles.vm, veg ? styles.veg : styles.nv, !showLabel && className)}
      role={decorative || showLabel ? undefined : 'img'}
      aria-label={decorative || showLabel ? undefined : text}
      aria-hidden={decorative || showLabel ? true : undefined}
    />
  );
  if (!showLabel) return mark;
  return (
    <span className={cx(styles.labelled, veg ? styles.veg : styles.nv, className)}>
      {mark}
      {text}
    </span>
  );
}
