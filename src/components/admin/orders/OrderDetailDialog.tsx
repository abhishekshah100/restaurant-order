'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useCancelByStaff, useCollectPayment, useMarkServed, useSetRush } from '@/api/mutations';
import { Button, Dialog } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { dueOn, editableRound } from '@/lib/adminOrders';
import { paidAmount } from '@/lib/lifecycle';
import { isFinished } from '@/lib/orders';
import type { CancelReason } from '@/types/admin';
import type { Order } from '@/types/order';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { CollectFields, useCollectChoice } from '../payments/CollectFields';
import { CancelOrderView } from './OrderActionViews';
import { OrderSummary } from './OrderSummary';
import styles from './OrderDetailDialog.module.css';

export type OrderDialogView = 'details' | 'collect' | 'cancel';

/**
 * One order for staff, with what can be done to it: Mark served / Handed over when it's ready,
 * Collect payment whenever something is due (before, during or after the meal), Add items to a
 * dine-in order and Change items the kitchen hasn't finished (when the page offers them), and
 * Rush (the kitchen takes it first) and Cancel while it isn't finished. Collecting and
 * cancelling open their own step in the dialog (how they paid; why it's cancelled), with Back
 * to the order.
 */
interface OrderDetailDialogProps {
  order: Order | undefined;
  onClose: () => void;
  /** Opens the order pad on this order; Add items shows only with it. */
  onAddItems?: (order: Order) => void;
  /** Opens the order pad on the round the kitchen hasn't finished; Change items needs it. */
  onChangeItems?: (order: Order) => void;
  /** The step it opens on (Collect from a list's quick action). */
  initialView?: OrderDialogView;
}

export function OrderDetailDialog({ order, ...props }: OrderDetailDialogProps) {
  if (!order) return null;
  return <OrderDialog key={order.id} order={order} {...props} />;
}

function OrderDialog({
  order,
  onClose,
  onAddItems,
  onChangeItems,
  initialView = 'details',
}: OrderDetailDialogProps & { order: Order }) {
  const t = useContent('common');
  const { branch, money, clock } = useAdminWorkspace();
  const { showToast } = useToast();
  const serve = useMarkServed();
  const collect = useCollectPayment();
  const cancel = useCancelByStaff();
  const rush = useSetRush();
  const [view, setView] = useState<OrderDialogView>(initialView);
  const choice = useCollectChoice([order]);
  const [reason, setReason] = useState<CancelReason>('outOfStock');

  const due = dueOn(order);
  const finished = isFinished(order);
  const failed = () => showToast(t('adminOrder.failed'), { tone: 'error' });
  const target = { branchId: branch.id, orderId: order.id };

  let title = t('adminOrder.title', { order: order.id });
  let description: string | undefined = t('adminOrder.subtitle', {
    name: order.customerName,
    where:
      order.mode === 'dineIn' && order.table !== undefined
        ? t('adminHome.queue.where.table', { table: order.table })
        : t(`modes.${order.mode}`),
    time: clock.dateTime(order.placedAt),
  });
  let body = <OrderSummary order={order} />;
  let footer;

  if (view === 'collect') {
    title = t('adminOrder.collect.title');
    description = t('adminOrder.collect.subtitle', { order: order.id, amount: money.format(due) });
    body = <CollectFields orders={[order]} choice={choice} />;
    footer = (
      <Button
        block
        iconStart="check"
        loading={collect.isPending}
        disabled={!choice.ready}
        onClick={() =>
          collect.mutate(
            { ...target, body: { method: choice.method } },
            {
              onSuccess: () => {
                showToast(t('adminOrder.collect.done', { order: order.id }), { tone: 'success' });
                onClose();
              },
              onError: failed,
            },
          )
        }
      >
        {t('adminOrder.collect.confirm', { amount: money.format(due) })}
      </Button>
    );
  } else if (view === 'cancel') {
    title = t('adminOrder.cancel.title', { order: order.id });
    description = undefined;
    body = <CancelOrderView refund={paidAmount(order)} value={reason} onChange={setReason} />;
    footer = (
      <Button
        block
        className={styles.danger}
        loading={cancel.isPending}
        onClick={() =>
          cancel.mutate(
            { ...target, body: { reason } },
            {
              onSuccess: () => {
                showToast(t('adminOrder.cancel.done', { order: order.id }));
                onClose();
              },
              onError: failed,
            },
          )
        }
      >
        {t('adminOrder.cancel.confirm')}
      </Button>
    );
  } else {
    const ready = order.status === 'ready';
    const canAdd = onAddItems && order.mode === 'dineIn' && order.status !== 'cancelled';
    const canChange = onChangeItems && editableRound(order) !== null;
    footer = (
      <div className={styles.actions}>
        {ready && (
          <Button
            block
            iconStart="check"
            loading={serve.isPending}
            onClick={() => serve.mutate(target, { onSuccess: onClose, onError: failed })}
          >
            {order.mode === 'takeaway' ? t('adminOrder.handOver') : t('adminOrder.serve')}
          </Button>
        )}
        {due > 0 && (
          <Button
            block
            variant={ready ? 'secondary' : 'primary'}
            iconStart="cash"
            meta={money.format(due)}
            onClick={() => setView('collect')}
          >
            {t('adminOrder.collectPayment')}
          </Button>
        )}
        {(canAdd || canChange || !finished) && (
          <div className={styles.secondary}>
            {!finished && (
              <Button
                variant={order.rush ? 'primary' : 'secondary'}
                iconStart="flame"
                aria-pressed={order.rush === true}
                loading={rush.isPending}
                onClick={() =>
                  rush.mutate(
                    { ...target, rush: !order.rush },
                    {
                      onSuccess: () =>
                        showToast(
                          t(order.rush ? 'adminOrder.rushOff' : 'adminOrder.rushOn', {
                            order: order.id,
                          }),
                        ),
                      onError: failed,
                    },
                  )
                }
              >
                {order.rush ? t('adminOrder.removeRush') : t('adminOrder.markRush')}
              </Button>
            )}
            {canAdd && (
              <Button variant="secondary" iconStart="plus" onClick={() => onAddItems(order)}>
                {t('adminOrder.addItems')}
              </Button>
            )}
            {canChange && (
              <Button variant="secondary" iconStart="pencil" onClick={() => onChangeItems(order)}>
                {t('adminOrder.changeItems')}
              </Button>
            )}
            {!finished && (
              <Button
                variant="ghost"
                iconStart="xc"
                className={styles.cancelLink}
                onClick={() => setView('cancel')}
              >
                {t('adminOrder.cancelOrder')}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={title}
      description={description}
      footer={
        view === 'details' ? (
          footer
        ) : (
          <div className={styles.stepActions}>
            <Button variant="secondary" iconStart="back" onClick={() => setView('details')}>
              {t('adminOrder.back')}
            </Button>
            {footer}
          </div>
        )
      }
    >
      {body}
    </Dialog>
  );
}
