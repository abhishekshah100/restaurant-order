import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import type { PaymentStatus } from '@/types/order';
import styles from './PaymentBadge.module.css';

/** An order's payment status as a small pill (paid, unpaid, refunded). */
export function PaymentBadge({ status, children }: { status: PaymentStatus; children: ReactNode }) {
  return <span className={cx(styles.paymentStatus, styles[status])}>{children}</span>;
}
