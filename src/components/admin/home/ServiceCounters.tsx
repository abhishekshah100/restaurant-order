import Link from 'next/link';
import { useContent } from '@/api/hooks';
import { Icon, type IconName } from '@/components/ui';
import { ADMIN_LINKS } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import type { AdminServiceCounts } from '@/types/admin';
import styles from './ServiceCounters.module.css';

type CounterId = keyof AdminServiceCounts;

const COUNTERS: { id: CounterId; icon: IconName; href: string }[] = [
  { id: 'waiterCalls', icon: 'bell', href: ADMIN_LINKS.requests },
  { id: 'billRequests', icon: 'receipt', href: ADMIN_LINKS.requests },
  { id: 'readyToServe', icon: 'cloche', href: ADMIN_LINKS.readyOrders },
  { id: 'unpaid', icon: 'cash', href: ADMIN_LINKS.unpaidOrders },
];

/** The four numbers a waiter checks first, each opening its page. Calm at zero. */
export function ServiceCounters({ counts }: { counts: AdminServiceCounts }) {
  const t = useContent('common');
  return (
    <section aria-label={t('adminHome.counters.label')}>
      <ul className={styles.counters}>
        {COUNTERS.map(({ id, icon, href }) => {
          const count = counts[id];
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
                <span className={styles.hint}>{t(`adminHome.counters.${id}.hint`)}</span>
                <Icon name="chev" size="xs" className={styles.chev} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
