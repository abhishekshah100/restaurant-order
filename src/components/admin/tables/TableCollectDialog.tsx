'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useCollectTablePayment } from '@/api/mutations';
import { Button, Dialog, OptionGroup } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { dueOn } from '@/lib/adminOrders';
import type { AdminTableDetail } from '@/types/admin';
import type { AtTableMethodKey } from '@/types/branch';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './TableCollectDialog.module.css';

/**
 * The whole table's payment taken in person, at any point of the meal: each order with
 * something to pay and its amount, the total, and how they paid (the branch's ways to pay
 * staff). Every one of those orders is then paid in full.
 */
export function TableCollectDialog({
  detail,
  onClose,
}: {
  detail: AdminTableDetail;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, region, money } = useAdminWorkspace();
  const { showToast } = useToast();
  const collect = useCollectTablePayment();
  const methods = region.payments.atTable;
  const [method, setMethod] = useState<AtTableMethodKey>(methods[0]);
  const owing = detail.orders.filter((o) => dueOn(o) > 0);
  const total = owing.reduce((sum, o) => sum + dueOn(o), 0);

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminTableCollect.title', { table: detail.table })}
      description={t.plural('adminTableCollect.orders', owing.length)}
      footer={
        <Button
          block
          iconStart="check"
          loading={collect.isPending}
          disabled={total === 0}
          onClick={() =>
            collect.mutate(
              { branchId: branch.id, table: detail.table, body: { method } },
              {
                onSuccess: () => {
                  showToast(t('adminTableCollect.done', { table: detail.table }), {
                    tone: 'success',
                  });
                  onClose();
                },
                onError: () => showToast(t('adminTableCollect.failed'), { tone: 'error' }),
              },
            )
          }
        >
          {t('adminTableCollect.confirm', { amount: money.format(total) })}
        </Button>
      }
    >
      <div className={styles.body}>
        <ul className={styles.orders}>
          {owing.map((order) => (
            <li key={order.id} className={styles.order}>
              <span>
                {t('adminTableCollect.order', { order: order.id, name: order.customerName })}
              </span>
              <strong>{money.format(dueOn(order))}</strong>
            </li>
          ))}
        </ul>
        <p className={styles.total}>
          <span>{t('adminTableCollect.total')}</span>
          <strong>{money.format(total)}</strong>
        </p>
        <OptionGroup
          type="radio"
          id={`collect-table-${detail.table}`}
          title={t('adminOrder.collect.method')}
          layout="grid"
          value={method}
          onChange={(id) => setMethod(methods.find((m) => m === id) ?? method)}
          choices={methods.map((m) => ({ id: m, label: t(`paymentMethods.${m}`) }))}
        />
      </div>
    </Dialog>
  );
}
