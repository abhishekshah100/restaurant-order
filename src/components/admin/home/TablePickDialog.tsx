'use client';

import { useRouter } from 'next/navigation';
import { useContent, useFloorPlan } from '@/api/hooks';
import { Dialog, Skeleton } from '@/components/ui';
import { tablePath } from '@/lib/adminNav';
import { legendOf } from '@/lib/adminTables';
import { cx } from '@/lib/cx';
import type { AdminFloorTable } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './TablePickDialog.module.css';
import tones from '../tables/tableTones.module.css';

/**
 * New order from the home: which table? Every table in service, by area. A table with nobody's
 * order on it opens the order pad (`onPick`); one with open orders opens its page instead, where
 * staff add a round to the bill or start a new one.
 */
export function TablePickDialog({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (table: number) => void;
}) {
  const t = useContent('common');
  const router = useRouter();
  const { branch } = useAdminWorkspace();
  const plan = useFloorPlan(branch.id);
  const floors = (plan.data?.floors ?? [])
    .map((floor) => ({ ...floor, tables: floor.tables.filter((tb) => !tb.disabled) }))
    .filter((floor) => floor.tables.length > 0);

  const pick = (table: AdminFloorTable) => {
    if (table.orderCount > 0) {
      onClose();
      router.push(tablePath(table.table));
    } else onPick(table.table);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminHome.pickTable.title')}
      description={t('adminHome.pickTable.body')}
    >
      {!plan.data ? (
        <div role="status" aria-label={t('adminHome.pickTable.loading')}>
          <Skeleton shape="block" width="100%" height={180} />
        </div>
      ) : floors.length === 0 ? (
        <p className="t-small c2">{t('adminHome.pickTable.none')}</p>
      ) : (
        floors.map((floor) => (
          <section key={floor.id} className={styles.floor} aria-label={floor.name}>
            {floors.length > 1 && <h3 className={styles.floorName}>{floor.name}</h3>}
            <ul className={styles.grid}>
              {floor.tables.map((table) => (
                <li key={table.table}>
                  <button
                    type="button"
                    className={cx(styles.table, tones[legendOf(table.status)])}
                    data-state={legendOf(table.status)}
                    onClick={() => pick(table)}
                  >
                    <span className={styles.number}>{table.table}</span>
                    <span className={styles.state}>
                      {table.orderCount > 0
                        ? t.plural('adminHome.pickTable.busy', table.orderCount)
                        : table.status === 'available'
                          ? t('adminHome.pickTable.free')
                          : t(`adminTables.status.${table.status}`)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </Dialog>
  );
}
