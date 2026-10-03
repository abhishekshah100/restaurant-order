import { StatusPill, VegMark } from '@/components/ui';
import { useContent, useMenu } from '@/api/hooks';
import { itemLabel, itemPillStatus, itemStatus } from '@/lib/orders';
import type { ItemStatus, Order } from '@/types/order';
import styles from './ItemStatusList.module.css';

/**
 * "1 × Paneer Tikka (Full) · Preparing" rows on the tracking screen. Per-item pills only
 * add information when items differ (e.g. drinks ready first); when every item shares one
 * status the order status above already says it, so they're left out.
 */
export function ItemStatusList({ order }: { order: Order }) {
  const menu = useMenu();
  const t = useContent('orders');
  const statuses = order.items.map((item) => itemStatus(item, order));
  const showStatus = new Set(statuses).size > 1;
  return (
    <ul className={styles.list}>
      {order.items.map((item, i) => (
        <li key={`${item.dishSlug}-${i}`} className={styles.row}>
          <VegMark veg={item.veg} />
          <span className={styles.name}>{itemLabel(item, menu)}</span>
          {showStatus && (
            <StatusPill status={itemPillStatus(statuses[i])} className={styles.pill}>
              {statuses[i] === 'queued'
                ? t('itemStatus.queued')
                : t(`steps.${statuses[i] as Exclude<ItemStatus, 'queued'>}`)}
            </StatusPill>
          )}
        </li>
      ))}
    </ul>
  );
}
