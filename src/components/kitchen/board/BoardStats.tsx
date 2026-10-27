import type { ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import type { BoardStats as Stats } from '@/lib/kitchenBoard';
import styles from './KitchenBoard.module.css';

/**
 * The kitchen now, in one line beside the filters: late tickets (red while there are any), the
 * dishes still to cook and the average ticket; then whatever the board adds (how current it
 * is). The lanes count their own tickets.
 */
export function BoardStats({ stats, children }: { stats: Stats; children?: ReactNode }) {
  const t = useContent('kitchen');
  return (
    <dl className={styles.stats} aria-label={t('board.stats.label')}>
      <div className={cx(styles.stat, stats.late > 0 && styles.statAlert)}>
        <dt>
          <Icon name="alert" size="xs" />
          {t('board.stats.late')}
        </dt>
        <dd>{stats.late}</dd>
      </div>
      <div className={styles.stat}>
        <dt>
          <Icon name="list" size="xs" />
          {t('board.stats.itemsToCook')}
        </dt>
        <dd>{stats.itemsToCook}</dd>
      </div>
      <div className={styles.stat}>
        <dt>
          <Icon name="clock" size="xs" />
          {t('board.stats.average')}
        </dt>
        <dd>
          {stats.averageMinutes === null
            ? t('board.stats.none')
            : t('board.stats.minutes', { count: stats.averageMinutes })}
        </dd>
      </div>
      {children}
    </dl>
  );
}
