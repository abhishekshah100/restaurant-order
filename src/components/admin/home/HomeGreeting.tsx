'use client';

import { useContent } from '@/api/hooks';
import { dayPeriod } from '@/lib/adminService';
import { firstName } from '@/lib/service';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { BranchStatus } from '../shell/BranchStatus';
import styles from './HomeGreeting.module.css';

/**
 * "Good evening, Abhishek", by the time of day at the branch, with today's date and where. The
 * status shows here only when the branch isn't open (the bars always show it).
 */
export function HomeGreeting({ now, adminName }: { now: Date | null; adminName?: string }) {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const greeting = now ? t(`adminHome.greeting.${dayPeriod(now, branch.timezone)}`) : null;
  const name = adminName ? firstName(adminName) : '';

  return (
    <header className={styles.greeting}>
      {now && <p className={styles.date}>{clock.date(now)}</p>}
      <h1 className={styles.title}>
        {greeting && (name ? t('adminHome.greeting.named', { greeting, name }) : greeting)}
      </h1>
    </header>
  );
}
