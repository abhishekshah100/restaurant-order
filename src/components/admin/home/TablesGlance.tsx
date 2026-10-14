import Link from 'next/link';
import { useContent } from '@/api/hooks';
import { Icon, type IconName } from '@/components/ui';
import { ADMIN_LINKS, tablePath } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import type { AdminTableState, AdminTableStatus } from '@/types/admin';
import styles from './TablesGlance.module.css';

const STATUS_ICONS: Record<AdminTableStatus, IconName> = {
  needsWaiter: 'bell',
  wantsBill: 'receipt',
  ordering: 'clock',
  eating: 'cutlery',
  closing: 'check',
};

/** The tables with activity today, each with where it is in its visit (icon, word and tone). */
export function TablesGlance({ tables }: { tables: AdminTableState[] }) {
  const t = useContent('common');
  return (
    <section className={styles.panel} aria-labelledby="tables-title">
      <header className={styles.head}>
        <div>
          <h2 id="tables-title" className={styles.title}>
            {t('adminHome.tables.title')}
          </h2>
          <p className={styles.subtitle}>{t('adminHome.tables.subtitle')}</p>
        </div>
        <Link href={ADMIN_LINKS.tables} className={styles.all}>
          {t('adminHome.tables.all')}
          <Icon name="chev" size="xs" />
        </Link>
      </header>

      {tables.length > 0 ? (
        <ul className={styles.grid}>
          {tables.map(({ table, status }) => {
            const label = t(`adminHome.tables.status.${status}`);
            return (
              <li key={table}>
                <Link
                  href={tablePath(table)}
                  className={cx(styles.tile, styles[status])}
                  aria-label={t('adminHome.tables.tile', { table, status: label })}
                >
                  <span className={styles.top}>
                    <span className={styles.number}>{table}</span>
                    <Icon name={STATUS_ICONS[status]} size="xs" className={styles.icon} />
                  </span>
                  <span className={styles.status}>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.empty}>{t('adminHome.tables.empty')}</p>
      )}
    </section>
  );
}
