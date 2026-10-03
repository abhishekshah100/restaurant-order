import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from '../Icon';
import styles from './Tag.module.css';

export type TagVariant = 'chef' | 'new' | 'best' | 'pop' | 'out' | 'ok' | 'warn' | 'err' | 'plain';

const DEFAULT_ICON: Partial<Record<TagVariant, IconName>> = {
  chef: 'chef',
  new: 'sparkle',
  best: 'star',
  ok: 'check',
};

export interface TagProps {
  variant: TagVariant;
  children: ReactNode;
  /** Override the variant's default icon; pass null for none. */
  icon?: IconName | null;
  className?: string;
}

export function Tag({ variant, children, icon, className }: TagProps) {
  const glyph = icon === null ? undefined : (icon ?? DEFAULT_ICON[variant]);
  return (
    <span className={cx(styles.tag, styles[variant], className)}>
      {glyph && <Icon name={glyph} size="xs" />}
      {children}
    </span>
  );
}
