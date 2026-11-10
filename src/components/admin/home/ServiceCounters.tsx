import Link from 'next/link';
import { useContent } from '@/api/hooks';
import type { CounterExtras } from '@/lib/adminHome';
import { Icon, type IconName } from '@/components/ui';
import { ADMIN_LINKS } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import type { AdminServiceCounts } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './ServiceCounters.module.css';

/** The four the home counts (the kitchen's messages are in the queue and on Requests). */
type CounterId = Exclude<keyof AdminServiceCounts, 'kitchenMessages'>;

const COUNTERS: { id: CounterId; icon: IconName; href: string }[] = [
  { id: 'waiterCalls', icon: 'bell', href: ADMIN_LINKS.requests },
  { id: 'billRequests', icon: 'receipt', href: ADMIN_LINKS.requests },
  { id: 'readyToServe', icon: 'cloche', href: ADMIN_LINKS.readyOrders },
  { id: 'unpaid', icon: 'cash', href: ADMIN_LINKS.unpaidOrders },
];

/**
 * The four numbers a waiter checks first, each opening its page. Calm at zero; with something
 * waiting, a second line says how long the oldest has waited (or, for Unpaid, how much).
 */
export function ServiceCounters({
  counts,
  extras,
}: {
  counts: AdminServiceCounts;
  extras: CounterExtras | null;
}) {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  const oldest = (minutes: number | null) =>
    minutes === null
      ? null
      : minutes < 1
        ? t('adminHome.counters.extra.oldestNow')
        : t('adminHome.counters.extra.oldest', { count: minutes });
  const extraOf = (id: CounterId): string | null => {
    if (!extras || counts[id] === 0) return null;
    if (id === 'waiterCalls') return oldest(extras.oldestCall);
    if (id === 'billRequests') return oldest(extras.oldestBill);
    if (id === 'readyToServe') return oldest(extras.oldestReady);
    return extras.unpaidAmount > 0
      ? t('adminHome.counters.extra.unpaid', { amount: money.format(extras.unpaidAmount) })
      : null;
  };
  return (
    <section aria-label={t('adminHome.counters.label')}>
      <ul className={styles.counters}>
        {COUNTERS.map(({ id, icon, href }) => {
          const count = counts[id];
          const extra = extraOf(id);
          return (
            <li key={id}>
              <Link
                href={href}
                className={cx(styles.counter, styles[id], count > 0 && styles.live)}
              >
                <span className={styles.icon} aria-hidden="true">
                  <Icon name={icon} size="sm" />
                </span>
                <span className={styles.value}>{count}</span>
                <span className={styles.label}>{t(`adminHome.counters.${id}.label`)}</span>
                <span className={cx(styles.hint, extra && styles.extra)}>
                  {extra ?? t(`adminHome.counters.${id}.hint`)}
                </span>
                <Icon name="chev" size="xs" className={styles.chev} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
