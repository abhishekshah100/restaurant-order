'use client';

import { isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import { useAssignTables } from '@/api/mutations';
import { Icon } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminName, useAdminStaffId } from '@/hooks/useAdminSession';
import { initialsOf, isMe } from '@/lib/adminTables';
import type { AdminTableDetail } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './TableDetail.module.css';

/**
 * Who covers the table (table sections): their name, and for staff who take orders, Take this
 * table (when nobody covers it) or Release (when it's theirs). Managers reassign from Tables ›
 * Assign waiters.
 */
export function TableWaiterLine({ detail }: { detail: AdminTableDetail }) {
  const t = useContent('common');
  const { branch, can } = useAdminWorkspace();
  const { showToast } = useToast();
  const me = { id: useAdminStaffId(), name: useAdminName() };
  const assign = useAssignTables();
  const { waiter } = detail;
  const mine = isMe(waiter, me);
  const canTake = can('orders.take') || can('tables.assign');

  const change = (take: boolean) =>
    assign.mutate(
      { branchId: branch.id, tables: [detail.table], waiterId: take ? 'me' : null },
      {
        onSuccess: () =>
          showToast(
            t(take ? 'adminTables.sections.takenToast' : 'adminTables.sections.releasedToast', {
              table: detail.table,
            }),
            { tone: 'success' },
          ),
        onError: (error) =>
          showToast(
            isApiError(error, 'table_taken')
              ? t('adminTables.sections.alreadyTaken', { table: detail.table })
              : t('adminTables.sections.failed'),
            { tone: 'error' },
          ),
      },
    );

  return (
    <span className={styles.waiterLine}>
      <span className={styles.waiterBadge} aria-hidden="true">
        {waiter ? initialsOf(waiter.name) : <Icon name="user" size="xs" />}
      </span>
      <span>
        {waiter
          ? mine
            ? t('adminTables.sections.yours')
            : t('adminTables.sections.coveredBy', { name: waiter.name })
          : t('adminTables.sections.noWaiter')}
      </span>
      {canTake && !detail.disabled && (!waiter || mine) && (
        <button
          type="button"
          className={styles.free}
          disabled={assign.isPending}
          onClick={() => change(!mine)}
        >
          <Icon name={mine ? 'x' : 'plus'} size="xs" />
          {mine ? t('adminTables.sections.release') : t('adminTables.sections.take')}
        </button>
      )}
    </span>
  );
}
