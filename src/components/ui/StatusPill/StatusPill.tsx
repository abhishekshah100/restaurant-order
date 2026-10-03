'use client';

import type { ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import type { OrderStatus } from '@/types/order';
import styles from './StatusPill.module.css';

/** Order status words from the API: `const statusLabel = useStatusLabel(); statusLabel('ready')`. */
export function useStatusLabel(): (status: OrderStatus) => string {
  const t = useContent('common');
  return (status) => t(`orderStatus.${status}`);
}

export interface StatusPillProps {
  status: OrderStatus;
  /** Override the label, e.g. "Preparing · 12 min". */
  children?: ReactNode;
  className?: string;
}

export function StatusPill({ status, children, className }: StatusPillProps) {
  const statusLabel = useStatusLabel();
  return (
    <span className={cx(styles.status, styles[status], className)}>
      {children ?? statusLabel(status)}
    </span>
  );
}
