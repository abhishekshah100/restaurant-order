'use client';

import Link from 'next/link';
import { useContent, useRestaurant } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { ADMIN_PATHS } from '@/lib/adminBranches';
import { useAdminWorkspace } from './AdminWorkspace';
import { BranchStatus } from './BranchStatus';
import styles from './ShellHeader.module.css';

export interface ShellHeaderProps {
  /** The current page's name. */
  title: string;
  /** The branch's local time; null until known. */
  time: string | null;
  adminName: string | undefined;
  /** Opens the More sheet (mobile: the avatar). */
  onOpenMore: () => void;
}

/**
 * The bar over every admin page. Below 1024px: the brand mark, the branch and its status, and
 * the admin's avatar (which opens More). From 1024px, beside the sidebar: the page title, the
 * branch status and its local time.
 */
export function ShellHeader({ title, time, adminName, onOpenMore }: ShellHeaderProps) {
  const t = useContent('common');
  const restaurant = useRestaurant();
  const { branch } = useAdminWorkspace();

  return (
    <>
      <header className={styles.mobile}>
        <Link
          href={ADMIN_PATHS.dashboard}
          className={styles.mark}
          aria-label={t('adminShell.homeLink', { name: restaurant.name })}
        >
          <Icon name="olive" size="md" />
        </Link>
        <div className={styles.branch}>
          <p className={styles.branchName}>{branch.shortName}</p>
          <BranchStatus status={branch.status} onDark />
        </div>
        <button
          type="button"
          className={styles.avatar}
          onClick={onOpenMore}
          aria-label={t('adminShell.account.menu')}
        >
          <span aria-hidden="true">{adminName?.charAt(0).toUpperCase() ?? ''}</span>
        </button>
      </header>

      <header className={styles.desktop}>
        <p className={styles.title}>{title}</p>
        <div className={styles.meta}>
          <BranchStatus status={branch.status} />
          {time && (
            <span className={styles.time}>
              <Icon name="clock" size="xs" />
              <span aria-hidden="true">{time}</span>
              <span className="visually-hidden">{t('adminShell.branch.timeLabel', { time })}</span>
            </span>
          )}
        </div>
      </header>
    </>
  );
}
