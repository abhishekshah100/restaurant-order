'use client';

import { useContent } from '@/api/hooks';
import { useCollectTablePayment } from '@/api/mutations';
import { Button, Dialog } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { dueOn } from '@/lib/adminOrders';
import type { AdminTableDetail } from '@/types/admin';
import { CollectFields, useCollectChoice } from '../payments/CollectFields';
import { useAdminWorkspace } from '../shell/AdminWorkspace';

/**
 * The whole table's payment taken in person, at any point of the meal, on the collect form staff
 * see everywhere (CollectFields): each order with something to pay and every charge on it, what's
 * due, how they paid and, for cash, the change. Every one of those orders is then paid in full.
 */
export function TableCollectDialog({
  detail,
  onClose,
}: {
  detail: AdminTableDetail;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, money } = useAdminWorkspace();
  const { showToast } = useToast();
  const collect = useCollectTablePayment();
  const owing = detail.orders.filter((o) => dueOn(o) > 0);
  const choice = useCollectChoice(owing);
  const total = choice.due;

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
          disabled={!choice.ready}
          onClick={() =>
            collect.mutate(
              { branchId: branch.id, table: detail.table, body: { method: choice.method } },
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
      <CollectFields orders={owing} choice={choice} />
    </Dialog>
  );
}
