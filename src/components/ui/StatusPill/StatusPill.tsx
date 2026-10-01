import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import type { OrderStatus } from '@/types/order';
import styles from './StatusPill.module.css';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'Received',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  cancelled: 'Cancelled',
};

export interface StatusPillProps {
  status: OrderStatus;
  /** Override the label, e.g. "Preparing · 12 min". */
  children?: ReactNode;
  className?: string;
}

export function StatusPill({ status, children, className }: StatusPillProps) {
  return (
    <span className={cx(styles.status, styles[status], className)}>
      {children ?? STATUS_LABEL[status]}
    </span>
  );
}
