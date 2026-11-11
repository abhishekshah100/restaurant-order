'use client';

import { useBranchService, useContent } from '@/api/hooks';
import { Button, EmptyState } from '@/components/ui';
import { useAdminName } from '@/hooks/useAdminSession';
import { useNow } from '@/hooks/useNow';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { counterExtras } from '@/lib/adminHome';
import { ArrivingSoon } from './ArrivingSoon';
import { FloorGlance } from './FloorGlance';
import { MyRota } from './MyRota';
import { MyShift } from './MyShift';
import { HomeHeader } from './HomeHeader';
import { ServiceCounters } from './ServiceCounters';
import { ServiceQueue } from './ServiceQueue';
import { SoldOutTonight } from './SoldOutTonight';
import { HomeSkeleton } from './HomeSkeleton';
import styles from './AdminHome.module.css';

/** Relative ages ("3 min ago") move on this often. */
const AGE_REFRESH_MS = 20_000;

/**
 * /admin/dashboard/: the waiter home. Everything a waiter checks during service, by urgency: the
 * header (until when orders are taken, and quick actions: new order, new booking, sold out);
 * the counts; one queue (oldest first) with the action for each and what was handled lately;
 * the floor at a glance (busy, free, tables that need a look); then the bookings arriving soon
 * and what can't be sold tonight; and my shift so far. Each part shows only to staff allowed to
 * use it. Read from
 * GET …/service, …/tables, …/reservations and the menu, all polled or refreshed on change.
 */
export function AdminHome() {
  const t = useContent('common');
  const { branch, can } = useAdminWorkspace();
  const adminName = useAdminName();
  const service = useBranchService(branch.id);
  const now = useNow(AGE_REFRESH_MS);

  let content;
  if (service.data) {
    content = (
      <>
        <ServiceCounters
          counts={service.data.counts}
          extras={now ? counterExtras(service.data, now) : null}
        />
        <div className={styles.columns}>
          <div className={styles.main}>
            <ServiceQueue service={service.data} now={now} />
            <FloorGlance now={now} />
          </div>
          <div className={styles.side}>
            {can('reservations.manage') && <ArrivingSoon now={now} />}
            <SoldOutTonight />
            <MyRota now={now} />
            {(can('orders.take') || can('payments.collect')) && <MyShift />}
          </div>
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
      <HomeHeader now={now} adminName={adminName} />
      {content}
    </div>
  );
}
