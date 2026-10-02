import { cx } from '@/lib/cx';
import { Icon } from '../Icon';
import styles from './TablePill.module.css';

export interface TablePillProps {
  table: number | null;
  size?: 'md' | 'lg';
  /** Text before the table, e.g. "The Olive Table · ". */
  prefix?: string;
  className?: string;
}

export function TablePill({ table, size = 'md', prefix, className }: TablePillProps) {
  return (
    <span className={cx(styles.pill, size === 'lg' && styles.lg, className)}>
      <Icon name="table" size="xs" />
      {prefix}
      {table === null ? 'Table —' : `Table ${table}`}
    </span>
  );
}
