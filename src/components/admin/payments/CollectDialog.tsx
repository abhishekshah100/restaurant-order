'use client';

import { useContent } from '@/api/hooks';
import { useCollectPayment, useCollectTablePayment } from '@/api/mutations';
import { Button, Dialog } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import type { Order } from '@/types/order';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { CollectFields, useCollectChoice } from './CollectFields';
import { usePaymentText } from './usePaymentText';
import styles from './PaymentDialogs.module.css';

/** What's being paid: one order, or everything due at a table. */
export type CollectTarget =
  { kind: 'order'; order: Order } | { kind: 'table'; table: number; orders: Order[] };

/**
 * Collect payment in person, for one order or a whole table, in full: the bill with every charge
 * on it, what's due, how it was paid and, for cash, what was handed over and the change
 * (CollectFields, the form staff see everywhere). The bill prints from here too.
 */
export function CollectDialog({
  target,
  onClose,
  onPrint,
}: {
  target: CollectTarget | null;
  onClose: () => void;
  onPrint: (target: CollectTarget) => void;
}) {
  if (!target) return null;
  const key = target.kind === 'order' ? target.order.id : `table-${target.table}`;
  return <CollectForm key={key} target={target} onClose={onClose} onPrint={onPrint} />;
}

function CollectForm({
  target,
  onClose,
  onPrint,
}: {
  target: CollectTarget;
  onClose: () => void;
  onPrint: (target: CollectTarget) => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { amount: format } = usePaymentText();
  const { showToast } = useToast();
  const collect = useCollectPayment();
  const collectTable = useCollectTablePayment();
  const orders = target.kind === 'order' ? [target.order] : target.orders;
  const choice = useCollectChoice(orders);
  const { method, due } = choice;

  const busy = collect.isPending || collectTable.isPending;
  const failed = () => showToast(t('adminPayments.failed'), { tone: 'error' });
  const done = (message: string) => {
    showToast(message, { tone: 'success' });
    onClose();
  };

  // The promise form: once nothing is due the page refreshes and closes this dialog, perhaps
  // before the answer is handled, and a mutate() callback would then never run.
  const submit = () => {
    if (!choice.ready) return;
    if (target.kind === 'table') {
      collectTable
        .mutateAsync({ branchId: branch.id, table: target.table, body: { method } })
        .then(
          () =>
            done(
              t('adminPayments.collect.doneTable', { table: target.table, amount: format(due) }),
            ),
          failed,
        );
      return;
    }
    collect
      .mutateAsync({ branchId: branch.id, orderId: target.order.id, body: { method } })
      .then(
        (order) =>
          done(t('adminPayments.collect.doneOrder', { amount: format(due), order: order.id })),
        failed,
      );
  };

  const title =
    target.kind === 'order'
      ? t('adminPayments.collect.titleOrder')
      : t('adminPayments.collect.titleTable', { table: target.table });
  const description =
    target.kind === 'order'
      ? t('adminPayments.collect.subtitleOrder', {
          order: target.order.id,
          name: target.order.customerName,
        })
      : t.plural('adminPayments.collect.subtitleTable', target.orders.length);

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={title}
      description={description}
      className={styles.dialog}
      footer={
        <div className={styles.footer}>
          <Button
            variant="secondary"
            iconStart="receipt"
            onClick={() => onPrint(target)}
            className={styles.footerSecondary}
          >
            {t('adminPayments.due.printBill')}
          </Button>
          <Button block iconStart="check" loading={busy} disabled={!choice.ready} onClick={submit}>
            {t('adminPayments.collect.confirm', { amount: format(due) })}
          </Button>
        </div>
      }
    >
      <CollectFields orders={orders} choice={choice} />
    </Dialog>
  );
}
