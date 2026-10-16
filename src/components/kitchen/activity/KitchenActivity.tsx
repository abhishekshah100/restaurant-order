'use client';

import { useMemo } from 'react';
import { useContent } from '@/api/hooks';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { Button, EmptyState } from '@/components/ui';
import {
  activitySummary,
  busiestHour,
  kitchenEvents,
  ticketsByHour,
  topDishes,
} from '@/lib/kitchenActivity';
import { StatTiles, type StatTile } from '../StatTiles';
import { useKitchenTickets } from '../useKitchenTickets';
import { ActivityFeed } from './ActivityFeed';
import { HourChart } from './HourChart';
import { TopDishes } from './TopDishes';
import styles from './KitchenActivity.module.css';

/**
 * /admin/kitchen-dashboard/activity/: the kitchen's day. Today's numbers (tickets, finished, items
 * cooked, the average and longest ticket, how many were ready on time, cancelled), tickets by
 * hour, the dishes ordered most, and a feed of everything that happened to each ticket. From
 * the same orders as the board (GET /admin/branches/:branchId/orders, polled every 15 s).
 */
export function KitchenActivity() {
  const t = useContent('kitchen');
  const { region } = useAdminWorkspace();
  const kitchen = useKitchenTickets();
  const { tickets } = kitchen;

  const day = useMemo(() => {
    if (!tickets) return null;
    const hours = ticketsByHour(tickets, region);
    return {
      summary: activitySummary(tickets),
      hours,
      busiest: busiestHour(hours),
      dishes: topDishes(tickets),
      events: kitchenEvents(tickets),
    };
  }, [region, tickets]);

  let content;
  if (day) {
    const { summary } = day;
    const none = t('activity.summary.none');
    const minutes = (count: number | null) =>
      count === null ? none : t('activity.summary.minutes', { count });
    const tiles: StatTile[] = [
      {
        id: 'tickets',
        label: t('activity.summary.tickets'),
        value: String(summary.tickets),
        icon: 'receipt',
      },
      {
        id: 'finished',
        label: t('activity.summary.finished'),
        value: String(summary.finished),
        icon: 'checkc',
      },
      {
        id: 'items',
        label: t('activity.summary.itemsCooked'),
        value: String(summary.itemsCooked),
        icon: 'cutlery',
      },
      {
        id: 'average',
        label: t('activity.summary.average'),
        value: minutes(summary.averageMinutes),
        icon: 'clock',
      },
      {
        id: 'onTime',
        label: t('activity.summary.onTime'),
        value:
          summary.onTimePercent === null
            ? none
            : t('activity.summary.percent', { count: summary.onTimePercent }),
        icon: 'star',
      },
      {
        id: 'longest',
        label: t('activity.summary.longest'),
        value: minutes(summary.longestMinutes),
        icon: 'history',
      },
      {
        id: 'cancelled',
        label: t('activity.summary.cancelled'),
        value: String(summary.cancelled),
        icon: 'xc',
        tone: summary.cancelled > 0 ? 'alert' : undefined,
      },
    ];
    content = (
      <>
        <StatTiles tiles={tiles} label={t('activity.summary.label')} />
        <div className={styles.charts}>
          <HourChart hours={day.hours} busiest={day.busiest} />
          <TopDishes dishes={day.dishes} />
        </div>
        <ActivityFeed events={day.events} />
      </>
    );
  } else if (kitchen.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('error.title')}
        className={styles.state}
        actions={
          <Button
            iconStart="refresh"
            loading={kitchen.isFetching}
            onClick={() => kitchen.refetch()}
          >
            {t('error.retry')}
          </Button>
        }
      >
        {t('error.body')}
      </EmptyState>
    );
  } else {
    content = <div className={styles.skeleton} role="status" aria-label={t('loading')} />;
  }

  return (
    <div className={styles.page}>
      <h1 className="visually-hidden">{t('activity.title')}</h1>
      {content}
    </div>
  );
}
