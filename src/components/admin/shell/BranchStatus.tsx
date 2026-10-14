import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import type { BranchStatus as Status } from '@/types/branch';
import styles from './BranchStatus.module.css';

/** The branch's status as a dot and a word (never colour alone), for light or dark surfaces. */
export function BranchStatus({
  status,
  onDark = false,
  className,
}: {
  status: Status;
  onDark?: boolean;
  className?: string;
}) {
  const t = useContent('common');
  return (
    <span className={cx(styles.status, styles[status], onDark && styles.onDark, className)}>
      {t(`adminShell.status.${status}`)}
    </span>
  );
}
