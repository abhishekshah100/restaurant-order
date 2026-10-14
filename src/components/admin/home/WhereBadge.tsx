import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import type { OrderMode } from '@/types/branch';
import styles from './WhereBadge.module.css';

/** Where to go: the table number, large; or Pickup / Delivery for orders without a table. */
export function WhereBadge({ table, mode }: { table: number | undefined; mode: OrderMode }) {
  const t = useContent('common');
  if (table !== undefined) {
    return (
      <span className={styles.badge}>
        <span className={styles.caption}>{t('adminHome.queue.table')}</span>
        <span className={styles.number}>{table}</span>
      </span>
    );
  }
  const delivery = mode === 'delivery';
  return (
    <span className={cx(styles.badge, styles.away)}>
      <Icon name={delivery ? 'scooter' : 'bag'} size="sm" />
      <span className={styles.caption}>
        {t(delivery ? 'adminHome.queue.delivery' : 'adminHome.queue.pickup')}
      </span>
    </span>
  );
}
