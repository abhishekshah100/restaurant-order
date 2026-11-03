'use client';

import { isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import { useFreeTable } from '@/api/mutations';
import { Button, Dialog } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import type { AdminTableDetail } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './FreeTableDialog.module.css';

/**
 * "Free Table 5?": the guests have left, so the table is available again and their visit ends
 * (POST …/tables/:table/free). Not while the table still owes money (the server answers 409
 * bill_open): then it says so and offers to collect the bill instead.
 */
export function FreeTableDialog({
  detail,
  onCollect,
  onClose,
}: {
  detail: AdminTableDetail;
  /** Opens the table's collect dialog (this one closes). */
  onCollect: () => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, money, can } = useAdminWorkspace();
  const { showToast } = useToast();
  const free = useFreeTable();
  const owing = detail.due > 0;
  const amount = money.format(detail.due);

  const freeTable = () =>
    free.mutate(
      { branchId: branch.id, table: detail.table },
      {
        onSuccess: () => {
          showToast(t('adminTables.detail.free.done', { table: detail.table }), {
            tone: 'success',
          });
          onClose();
        },
        onError: (error) =>
          showToast(
            isApiError(error, 'bill_open')
              ? t('adminTables.detail.free.billOpen', {
                  table: detail.table,
                  amount: money.format(error.body?.due ?? detail.due),
                })
              : t('adminTables.detail.free.failed'),
            { tone: 'error' },
          ),
      },
    );

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={
        owing
          ? t('adminTables.detail.free.blockedTitle', { table: detail.table })
          : t('adminTables.detail.free.title', { table: detail.table })
      }
      footer={
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            {owing ? t('adminTables.detail.free.close') : t('adminTables.detail.free.keep')}
          </Button>
          {owing ? (
            can('payments.collect') && (
              <Button iconStart="cash" onClick={onCollect}>
                {t('adminTables.detail.free.collect', { amount })}
              </Button>
            )
          ) : (
            <Button iconStart="check" loading={free.isPending} onClick={freeTable}>
              {t('adminTables.detail.free.confirm')}
            </Button>
          )}
        </div>
      }
    >
      <div className={styles.body}>
        {owing ? (
          <p className={styles.unpaid}>{t('adminTables.detail.free.blocked', { amount })}</p>
        ) : (
          <p>{t('adminTables.detail.free.body')}</p>
        )}
      </div>
    </Dialog>
  );
}
