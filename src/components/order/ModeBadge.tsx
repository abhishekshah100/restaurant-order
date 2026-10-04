'use client';

import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { MODE_ICON } from '@/components/start/ModeOptions';
import { cx } from '@/lib/cx';
import type { OrderMode } from '@/types/branch';
import styles from './ModeBadge.module.css';

/** "Takeaway" / "Delivery" tag on an order (dine-in orders show their table instead). */
export function ModeBadge({
  mode,
  className,
}: {
  mode: Exclude<OrderMode, 'dineIn'>;
  className?: string;
}) {
  const t = useContent('common');
  return (
    <span className={cx(styles.badge, className)}>
      <Icon name={MODE_ICON[mode]} size="xs" />
      {t(`modes.${mode}`)}
    </span>
  );
}
