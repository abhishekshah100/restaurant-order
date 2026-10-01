import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from '../Icon';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  icon: IconName;
  tone?: 'brand' | 'ok' | 'err' | 'neutral';
  title: ReactNode;
  /** Heading level for the title. */
  as?: 'h1' | 'h2';
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  tone = 'brand',
  title,
  as: Heading = 'h2',
  children,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, className)}>
      <div className={cx(styles.art, tone !== 'brand' && styles[tone])}>
        <Icon name={icon} size="xl" />
      </div>
      <Heading className="t-h1">{title}</Heading>
      {children && <div className={cx('t-body c2', styles.body)}>{children}</div>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
