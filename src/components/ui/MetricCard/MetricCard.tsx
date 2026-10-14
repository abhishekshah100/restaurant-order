import { cx } from '@/lib/cx';
import { Icon } from '../Icon/Icon';
import type { IconName } from '../Icon/iconNames';
import styles from './MetricCard.module.css';

export type MetricCardTone = 'brand' | 'success' | 'gold' | 'rose';

export interface MetricCardProps {
  icon: IconName;
  label: string;
  value: string;
  detail: string;
  tone?: MetricCardTone;
  className?: string;
}

/** Summary statistic card for dashboards and other overview pages. */
export function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = 'brand',
  className,
}: MetricCardProps) {
  return (
    <article className={cx(styles.card, className)}>
      <div className={styles.top}>
        <span className={cx(styles.icon, styles[tone])}>
          <Icon name={icon} size="sm" />
        </span>
        <span className={styles.label}>{label}</span>
      </div>
      <div className={styles.value}>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}
