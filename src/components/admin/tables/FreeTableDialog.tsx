'use client';

import { useContent } from '@/api/hooks';
import { useFreeTable } from '@/api/mutations';
import { Button, Dialog } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import type { AdminTableDetail } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './FreeTableDialog.module.css';

/**
 * "Free Table 5?": the guests have left. Says what's still unpaid (it stays on the Orders page),
 * then sets the table's freed flag (POST …/tables/:table/free).
 */
export function FreeTableDialog({
  detail,
  onClose,
}: {
  detail: AdminTableDetail;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, money } = useAdminWorkspace();
  const { showToast } = useToast();
  const free = useFreeTable();

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminTables.detail.free.title', { table: detail.table })}
      footer={
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            {t('adminTables.detail.free.keep')}
          </Button>
          <Button
            iconStart="check"
            loading={free.isPending}
            onClick={() =>
              free.mutate(
                { branchId: branch.id, table: detail.table },
                {
                  onSuccess: () => {
                    showToast(t('adminTables.detail.free.done', { table: detail.table }), {
                      tone: 'success',
                    });
                    onClose();
                  },
                  onError: () => showToast(t('adminTables.detail.free.failed'), { tone: 'error' }),
                },
              )
            }
          >
            {t('adminTables.detail.free.confirm')}
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        <p>{t('adminTables.detail.free.body')}</p>
        {detail.due > 0 && (
          <p className={styles.unpaid}>
            {t('adminTables.detail.free.unpaid', { amount: money.format(detail.due) })}
          </p>
        )}
      </div>
    </Dialog>
  );
}
