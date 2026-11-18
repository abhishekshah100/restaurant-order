'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent, usePurchaseOrder } from '@/api/hooks';
import { usePurchaseOrderStep } from '@/api/mutations';
import { Button, Dialog, Icon } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/cx';
import { nextAction } from '@/lib/purchasingFlow';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useOrderPrint } from './OrderPrint';
import { OrderProgress } from './OrderProgress';
import { StatusChip } from './StatusChip';
import { useSendOrder, whatsAppNumber } from './useSendOrder';
import { docNumber, usePurchasingText } from './usePurchasingText';
import styles from './Purchasing.module.css';
import { OrderEditor } from './OrderEditor';

/**
 * One purchase order: who it's from and where it is (placed, sent, arrived), its items with
 * what's come, the totals, and the one next step for whoever may take it: Approve; Send (on
 * WhatsApp or by email, which also marks it sent, or "I sent it another way"); Receive. Less
 * usual things under More: change it (until sent), cancel it, stop waiting for the rest. A new
 * one opens as the editor.
 */
export function OrderDialog({
  id,
  supplierId,
  onReceive,
  onClose,
}: {
  /** None: a new order. */
  id?: string;
  /** A new order for this supplier. */
  supplierId?: string;
  onReceive: (orderId: string) => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const text = usePurchasingText();
  const { showToast } = useToast();
  const step = usePurchaseOrderStep();
  const { send, markSent } = useSendOrder();
  const printer = useOrderPrint();
  const query = usePurchaseOrder(branch.id, id ?? '');
  const order = id ? query.data : undefined;
  const [editing, setEditing] = useState(!id);
  const [confirm, setConfirm] = useState<'cancel' | 'close' | null>(null);

  const run = (s: 'approve' | 'cancel' | 'close') =>
    order &&
    step.mutate(
      { branchId: branch.id, id: order.id, step: s },
      {
        onSuccess: () => {
          setConfirm(null);
          showToast(t(`adminPurchasing.orders.done.${s}`), { tone: 'success' });
        },
        onError: (error) =>
          showToast(
            isApiError(error, 'po_not_approved')
              ? t('adminPurchasing.errors.notApproved')
              : isApiError(error, 'po_not_editable')
                ? t('adminPurchasing.errors.notEditable')
                : t('adminInventory.errors.failed'),
            { tone: 'error' },
          ),
      },
    );

  const title = order
    ? t('adminPurchasing.orders.title', { number: docNumber('PO', order.number) })
    : t('adminPurchasing.orders.newTitle');
  let body;
  let footer;
  if (id && !order) {
    body = (
      <p className={styles.muted} aria-busy={!query.isError}>
        {query.isError ? t('adminInventory.failed') : t('adminInventory.loading')}
      </p>
    );
  } else if (editing) {
    return (
      <OrderEditor
        order={order}
        {...(supplierId ? { supplierId } : {})}
        onDone={() => (id ? setEditing(false) : onClose())}
        frame={(form, foot) => (
          <Dialog
            open
            onClose={onClose}
            presentation="adaptive"
            title={title}
            {...(foot ? { footer: foot } : {})}
            className={styles.orderDialog}
          >
            {form}
          </Dialog>
        )}
      />
    );
  } else if (order) {
    const editable = ['draft', 'approved'].includes(order.status) && can('purchase.manage');
    const next = nextAction(order, {
      approve: can('purchase.approve'),
      manage: can('purchase.manage'),
      receive: can('purchase.receive', 'purchase.manage'),
    });
    const phone = whatsAppNumber(order);
    const anyReceived = order.lines.some((l) => l.received > 0);
    body = (
      <div className={styles.orderView}>
        <div className={styles.orderHead}>
          <div className={styles.orderHeadText}>
            <span className={styles.orderSupplierBig}>{order.supplier.name}</span>
            <span className={styles.muted}>
              {[
                t('adminPurchasing.orders.createdBy', {
                  time: clock.dateTime(order.createdAt),
                  name: order.createdBy ?? '—',
                }),
                order.approvedBy &&
                  t('adminPurchasing.orders.approvedBy', { name: order.approvedBy }),
                order.expectedOn &&
                  t('adminPurchasing.orders.expected', {
                    date: clock.day(order.expectedOn),
                  }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
          <StatusChip status={order.status} />
        </div>
        <OrderProgress status={order.status} />
        {order.status === 'draft' && (
          <p className={styles.banner}>
            <Icon name="shield" size="xs" />
            {t('adminPurchasing.orders.needsApproval')}
          </p>
        )}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('adminPurchasing.orders.cols.item')}</th>
              <th className={styles.num}>{t('adminPurchasing.orders.cols.qty')}</th>
              {anyReceived && (
                <th className={styles.num}>{t('adminPurchasing.orders.cols.came')}</th>
              )}
              {order.total !== undefined && (
                <th className={styles.num}>{t('adminPurchasing.orders.cols.total')}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  <span className={styles.rowTitle}>{l.name}</span>
                  {l.price !== undefined && (
                    <span className={styles.rowMeta}>{text.perPack(l.price, l.pack)}</span>
                  )}
                </td>
                <td className={styles.num}>{text.packs(l.quantity, l.pack)}</td>
                {anyReceived && (
                  <td className={cx(styles.num, l.received >= l.quantity && styles.ok)}>
                    {text.packs(l.received, l.pack)}
                  </td>
                )}
                {order.total !== undefined && (
                  <td className={styles.num}>
                    {l.total !== undefined ? text.money(l.total) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {order.total !== undefined && (
          <dl className={styles.sums}>
            {(order.tax ?? 0) > 0 && (
              <>
                <div>
                  <dt>{t('adminPurchasing.orders.subtotal')}</dt>
                  <dd>{text.money(order.total)}</dd>
                </div>
                <div>
                  <dt>{t('adminPurchasing.orders.taxTotal')}</dt>
                  <dd>{text.money(order.tax ?? 0)}</dd>
                </div>
              </>
            )}
            <div className={styles.grand}>
              <dt>{t('adminPurchasing.orders.grand')}</dt>
              <dd>{text.money(order.total + (order.tax ?? 0))}</dd>
            </div>
          </dl>
        )}
        {order.note && (
          <p className={styles.note}>
            <Icon name="msg" size="xs" />
            {order.note}
          </p>
        )}

        {/* Less usual: change, cancel, stop waiting for the rest. */}
        {(editable ||
          (['draft', 'approved', 'sent'].includes(order.status) && can('purchase.manage')) ||
          (order.status === 'partly_received' && can('purchase.manage'))) && (
          <details className={styles.more}>
            <summary>{t('adminPurchasing.orders.more')}</summary>
            <div className={styles.moreActions}>
              {editable && (
                <Button
                  size="sm"
                  variant="secondary"
                  iconStart="pencil"
                  onClick={() => setEditing(true)}
                >
                  {t('adminPurchasing.orders.edit')}
                </Button>
              )}
              {['sent', 'partly_received', 'approved'].includes(order.status) && (
                <Button
                  size="sm"
                  variant="secondary"
                  iconStart="printer"
                  onClick={() => printer.print(order)}
                >
                  {t('adminPurchasing.orders.print')}
                </Button>
              )}
              {['draft', 'approved', 'sent'].includes(order.status) && can('purchase.manage') && (
                <Button
                  size="sm"
                  variant={confirm === 'cancel' ? 'primary' : 'ghost'}
                  loading={step.isPending && confirm === 'cancel'}
                  onClick={() => (confirm === 'cancel' ? run('cancel') : setConfirm('cancel'))}
                >
                  {confirm === 'cancel'
                    ? t('adminPurchasing.orders.confirmCancel')
                    : t('adminPurchasing.orders.cancel')}
                </Button>
              )}
              {order.status === 'partly_received' && can('purchase.manage') && (
                <Button
                  size="sm"
                  variant={confirm === 'close' ? 'primary' : 'ghost'}
                  loading={step.isPending && confirm === 'close'}
                  onClick={() => (confirm === 'close' ? run('close') : setConfirm('close'))}
                >
                  {confirm === 'close'
                    ? t('adminPurchasing.orders.confirmClose')
                    : t('adminPurchasing.orders.close')}
                </Button>
              )}
            </div>
          </details>
        )}
      </div>
    );
    if (next === 'approve') {
      footer = (
        <Button block iconStart="check" loading={step.isPending} onClick={() => run('approve')}>
          {t('adminPurchasing.orders.approve')}
        </Button>
      );
    } else if (next === 'send') {
      footer = (
        <div className={styles.sendBar}>
          {phone && (
            <Button iconStart="whatsapp" onClick={() => send(order, 'whatsApp')}>
              {t('adminPurchasing.orders.whatsApp')}
            </Button>
          )}
          {order.supplier.email && (
            <Button
              variant={phone ? 'secondary' : 'primary'}
              iconStart="msg"
              onClick={() => send(order, 'email')}
            >
              {t('adminPurchasing.orders.email')}
            </Button>
          )}
          <Button variant="ghost" onClick={() => markSent(order)}>
            {t('adminPurchasing.orders.sentOtherWay')}
          </Button>
        </div>
      );
    } else if (next === 'receive') {
      footer = (
        <Button block iconStart="bag" onClick={() => onReceive(order.id)}>
          {t('adminPurchasing.orders.receive')}
        </Button>
      );
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={title}
      {...(footer ? { footer } : {})}
      className={styles.orderDialog}
    >
      {body}
      {printer.sheet}
    </Dialog>
  );
}
