'use client';

import { useContent, useRegion } from '@/api/hooks';
import { StatusPill } from '@/components/ui';
import { cx } from '@/lib/cx';
import type { Order } from '@/types/order';
import { ItemStatusList } from './ItemStatusList';
import styles from './RoundList.module.css';

/**
 * A running order round by round (tracking): "Round 2 · 8:10 PM" with its own kitchen status,
 * then its items. A round the guest cancelled stays listed, marked cancelled.
 */
export function RoundList({ order }: { order: Order }) {
  const t = useContent('orders');
  const { clock } = useRegion();
  return (
    <ol className={styles.rounds} aria-label={t('rounds.label')}>
      {order.rounds?.map((round) => (
        <li
          key={round.number}
          className={cx(styles.round, round.status === 'cancelled' && styles.cancelled)}
        >
          <div className={styles.head}>
            <h3 className={styles.title}>
              {t('rounds.round', { number: round.number })}
              <span className={styles.time}>{clock.time(round.placedAt)}</span>
            </h3>
            <StatusPill status={round.status} className={styles.pill} />
          </div>
          <ItemStatusList order={{ ...order, items: round.items, status: round.status }} />
        </li>
      ))}
    </ol>
  );
}
