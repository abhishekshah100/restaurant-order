'use client';

import { isBackendEnabled } from '@/api/backend';
import { useBranchOrders, useContent, useCurrentShift } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { useAdminName } from '@/hooks/useAdminSession';
import { myShift } from '@/lib/adminHome';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './HomePanels.module.css';

/**
 * My shift: the signed-in staff member's day so far, from today's orders: orders they took at
 * the table (and at how many tables), what they collected in person (from how many payments)
 * and their tips. Read once and refreshed whenever an order or payment changes (not polled).
 */
export function MyShift() {
  const t = useContent('common');
  const { branch, money, clock } = useAdminWorkspace();
  // On shift: counted from clock-in.
  const since = useCurrentShift(branch.id, isBackendEnabled()).data?.startedAt;
  const name = useAdminName() ?? '';
  const orders = useBranchOrders(branch.id, undefined, false);
  if (!orders.data || !name) return null;
  const shift = myShift(orders.data.orders, name, since);
  const empty = shift.ordersTaken === 0 && shift.payments === 0;

  return (
    <section className={styles.panel} aria-labelledby="shift-title">
      <header className={styles.head}>
        <div>
          <h2 id="shift-title" className={styles.title}>
            {t('adminHome.shift.title')}
          </h2>
          <p className={styles.subtitle}>
            {since
              ? t('adminHome.shift.subtitleSince', { time: clock.time(since) })
              : t('adminHome.shift.subtitle')}
          </p>
        </div>
        <Icon name="user" size="sm" className={styles.headIcon} />
      </header>
      {empty ? (
        <p className={styles.quiet}>{t('adminHome.shift.none')}</p>
      ) : (
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>{t('adminHome.shift.orders')}</dt>
            <dd>{shift.ordersTaken}</dd>
            {shift.tables > 0 && (
              <dd className={styles.statHint}>
                {t.plural('adminHome.shift.ordersHint', shift.tables)}
              </dd>
            )}
          </div>
          <div className={styles.stat}>
            <dt>{t('adminHome.shift.collected')}</dt>
            <dd>{money.format(shift.collected)}</dd>
            {shift.payments > 0 && (
              <dd className={styles.statHint}>
                {t.plural('adminHome.shift.payments', shift.payments)}
              </dd>
            )}
          </div>
          <div className={styles.stat}>
            <dt>{t('adminHome.shift.tips')}</dt>
            <dd>{money.format(shift.tips)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
