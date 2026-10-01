import { cx } from '@/lib/cx';
import type { IconName } from './iconNames';
import styles from './Icon.module.css';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface IconProps {
  name: IconName;
  /** xs 16 · sm 20 · md 24 (default) · lg 32 · xl 44 */
  size?: IconSize;
  className?: string;
  /** Accessible name. Omit for decorative icons (the default). */
  label?: string;
}

export function Icon({ name, size = 'md', className, label }: IconProps) {
  return (
    <span
      className={cx(styles.i, size !== 'md' && styles[size], styles[name], className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
