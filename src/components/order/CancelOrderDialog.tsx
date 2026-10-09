'use client';

import { useContent, useRegion } from '@/api/hooks';
import { Button, Dialog } from '@/components/ui';
import { paidAmount } from '@/lib/lifecycle';
import type { Order } from '@/types/order';
import styles from './CancelOrderDialog.module.css';

export interface CancelOrderDialogProps {
  open: boolean;
  order: Order;
  /** The round being taken back; the whole order when it's the only one. */
  round: number;
  /** A running order with more rounds: only this round is cancelled. */
  isTab: boolean;
  cancelling: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** "Cancel order #A105?" — what happens to the food and to anything paid online. */
export function CancelOrderDialog({
  open,
  order,
  round,
  isTab,
  cancelling,
  onConfirm,
  onClose,
}: CancelOrderDialogProps) {
  const t = useContent('orders');
  const common = useContent('common');
  const { money } = useRegion();
  // A round's refund is worked out by the server against the re-priced tab; the whole order's is what was paid.
  const paid = isTab ? 0 : paidAmount(order);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      presentation="adaptive"
      title={
        isTab ? t('cancelDialog.titleRound', { round }) : t('cancelDialog.title', { id: order.id })
      }
      footer={
        <div className={styles.actions}>
          <Button variant="secondary" block onClick={onClose}>
            {t('cancelDialog.keep')}
          </Button>
          <Button block iconStart="x" loading={cancelling} onClick={onConfirm}>
            {t('cancelDialog.confirm')}
          </Button>
        </div>
      }
    >
      <p className={styles.body}>
        {isTab ? t('cancelDialog.bodyRound', { round }) : t('cancelDialog.body')}{' '}
        {paid > 0
          ? t('cancelDialog.refund', {
              amount: money.format(paid),
              method: order.payment.detail ?? common('paymentMethods.online'),
            })
          : !isTab && t('cancelDialog.notCharged')}
      </p>
    </Dialog>
  );
}
