import type { ReactNode } from 'react';
import { Icon } from '@/components/ui';
import styles from './AdminDashboardHeader.module.css';

export interface AdminDashboardHeaderProps {
  branchName: string;
  sectionLabel: string;
  branchStatus: ReactNode;
  notificationsLabel: string;
}

export function AdminDashboardHeader({
  branchName,
  sectionLabel,
  branchStatus,
  notificationsLabel,
}: AdminDashboardHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.mobileBranch}>
        <Icon name="olive" size="sm" />
        <span>{branchName}</span>
      </div>
      <div className={styles.breadcrumb}>
        <span>{branchName}</span>
        <Icon name="chev" size="xs" />
        <strong>{sectionLabel}</strong>
      </div>
      <div className={styles.actions}>
        {branchStatus}
        <button
          type="button"
          className={styles.notification}
          aria-label={notificationsLabel}
          title={notificationsLabel}
          disabled
        >
          <Icon name="bell" size="sm" />
        </button>
        <div className={styles.profileMark}>
          <Icon name="user" size="sm" />
        </div>
      </div>
    </header>
  );
}
