'use client';

import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import { Icon } from '../Icon';
import styles from './TablePill.module.css';

export interface TablePillProps {
  table: number | null;
  /** Text before the table, e.g. "The Olive Table · ". */
  prefix?: string;
  className?: string;
}

export function TablePill({ table, prefix, className }: TablePillProps) {
  const t = useContent('common');
  return (
    <span className={cx(styles.pill, className)}>
      <Icon name="table" size="xs" />
      {prefix}
      {table === null ? t('table.unknown') : t('table.number', { table })}
    </span>
  );
}
