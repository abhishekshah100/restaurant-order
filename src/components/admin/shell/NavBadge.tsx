import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import type { AdminNavId } from '@/lib/adminNav';
import styles from './NavBadge.module.css';

/** A live count beside a nav item ("3"), read out in words ("3 open"); nothing at zero. */
export function NavBadge({
  id,
  count,
  className,
}: {
  id: AdminNavId;
  count: number;
  className?: string;
}) {
  const t = useContent('common');
  if (count <= 0) return null;
  const label =
    id === 'orders'
      ? t('adminShell.badge.orders', { count })
      : t('adminShell.badge.requests', { count });
  return (
    <span className={cx(styles.badge, className)}>
      <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
