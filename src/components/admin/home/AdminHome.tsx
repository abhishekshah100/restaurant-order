'use client';

import { useBranchService, useContent } from '@/api/hooks';
import { Button, EmptyState } from '@/components/ui';
import { useAdminName } from '@/hooks/useAdminSession';
import { useNow } from '@/hooks/useNow';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { HomeGreeting } from './HomeGreeting';
import { ServiceCounters } from './ServiceCounters';
import { ServiceQueue } from './ServiceQueue';
import { TablesGlance } from './TablesGlance';
import { HomeSkeleton } from './HomeSkeleton';
import styles from './AdminHome.module.css';

/** Relative ages ("3 min ago") move on this often. */
const AGE_REFRESH_MS = 20_000;

/**
 * /admin/dashboard/: the waiter home. What needs a person now, in one place: the counts, one
 * queue (oldest first) with the action for each, and the tables with activity today. Read from
 * GET /admin/branches/:branchId/service, polled every 15 s.
 */
export function AdminHome() {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const adminName = useAdminName();
  const service = useBranchService(branch.id);
  const now = useNow(AGE_REFRESH_MS);

  let content;
  if (service.data) {
    content = (
      <>
        <ServiceCounters counts={service.data.counts} />
        <div className={styles.columns}>
          <ServiceQueue service={service.data} now={now} />
          <TablesGlance tables={service.data.tables} />
        </div>
      </>
    );
  } else if (service.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminHome.error.title')}
        titleClassName={styles.stateTitle}
        className={styles.state}
        actions={
          <Button
            iconStart="refresh"
            loading={service.isFetching}
            onClick={() => service.refetch()}
          >
            {t('adminHome.error.retry')}
          </Button>
        }
      >
        {t('adminHome.error.body')}
      </EmptyState>
    );
  } else {
    content = <HomeSkeleton />;
  }

  return (
    <div className={styles.home}>
      <HomeGreeting now={now} adminName={adminName} />
      {content}
    </div>
  );
}
