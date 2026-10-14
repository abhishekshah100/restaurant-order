import Link from 'next/link';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { tablePath } from '@/lib/adminNav';
import { legendOf } from '@/lib/adminTables';
import { cx } from '@/lib/cx';
import type { AdminFloorTable } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useSeatedLabel } from './useSeatedLabel';
import styles from './TableCard.module.css';

/**
 * One table on the floor plan: its number large, its seats, and its state in words with a dot
 * in the state's tone; a taken table adds its orders, what's due and how long it's been seated.
 * Opens the table's page.
 */
export function TableCard({ table, now }: { table: AdminFloorTable; now: Date | null }) {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  const seatedLabel = useSeatedLabel();
  const status = t(`adminTables.status.${table.status}`);
  const seats = t.plural('adminTables.seats', table.seats);
  const seated = seatedLabel(table.seatedAt, now);

  return (
    <Link
      href={tablePath(table.table)}
      className={cx(styles.card, styles[legendOf(table.status)])}
      aria-label={t('adminTables.tile', { table: table.table, seats, status })}
    >
      <span className={styles.top} aria-hidden="true">
        <span className={styles.number}>{table.table}</span>
        <span className={styles.seats}>
          <Icon name="user" size="xs" />
          {table.seats}
        </span>
      </span>
      <span className={styles.status} aria-hidden="true">
        <span className={styles.dot} />
        {status}
      </span>
      <span className={styles.info} aria-hidden="true">
        {table.status === 'available' ? (
          <span>{t('adminTables.ready')}</span>
        ) : (
          <>
            <span className={styles.line}>
              {[
                t.plural('adminTables.orders', table.orderCount),
                table.due > 0
                  ? t('adminTables.due', { amount: money.format(table.due) })
                  : t('adminTables.paidUp'),
              ].join(' · ')}
            </span>
            {seated && (
              <span className={styles.line}>
                <Icon name="clock" size="xs" />
                {seated}
              </span>
            )}
          </>
        )}
      </span>
    </Link>
  );
}
