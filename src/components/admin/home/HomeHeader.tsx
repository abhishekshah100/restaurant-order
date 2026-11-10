'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { Button } from '@/components/ui';
import { useBranchTimes } from '@/hooks/useBranchTimes';
import { dayPeriod } from '@/lib/adminService';
import { ADMIN_LINKS } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import { firstName } from '@/lib/service';
import type { PadTarget } from '../orderPad/OrderPad';
import type { EditorTarget } from '../reservations/ReservationEditor';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { ShiftControl } from './ShiftControl';
import styles from './HomeHeader.module.css';

// Popups: each downloaded the first time it opens.
const TablePickDialog = dynamic(() => import('./TablePickDialog').then((m) => m.TablePickDialog), {
  ssr: false,
  loading: () => <LoadingSignal />,
});
const OrderPad = dynamic(() => import('../orderPad/OrderPad').then((m) => m.OrderPad), {
  ssr: false,
  loading: () => <LoadingSignal />,
});
const ReservationEditor = dynamic(
  () => import('../reservations/ReservationEditor').then((m) => m.ReservationEditor),
  { ssr: false, loading: () => <LoadingSignal /> },
);

/** From this many minutes before last orders, the time says how many are left (amber from 30). */
const COUNTDOWN_MINUTES = 90;
const SOON_MINUTES = 30;

/**
 * The top of the waiter home: today's date, "Good evening, Abhishek", until when the kitchen
 * takes orders, and the quick actions this person may use: New order (pick a table, then the
 * order pad), New booking, and Mark sold out (the menu's switches).
 */
export function HomeHeader({ now, adminName }: { now: Date | null; adminName?: string }) {
  const t = useContent('common');
  const { branch, region, clock, can } = useAdminWorkspace();
  const times = useBranchTimes(region);
  const [picking, setPicking] = useState(false);
  const [pad, setPad] = useState<PadTarget | null>(null);
  const [booking, setBooking] = useState<EditorTarget | null>(null);
  const greeting = now ? t(`adminHome.greeting.${dayPeriod(now, branch.timezone)}`) : null;
  const name = adminName ? firstName(adminName) : '';

  let service: string | null = null;
  const left = times?.minutesLeft ?? null;
  if (times?.ordersUntil) {
    service =
      left !== null && left <= COUNTDOWN_MINUTES
        ? t('adminHome.header.lastOrders', { time: times.ordersUntil, minutes: left })
        : t('adminHome.header.lastOrdersAt', { time: times.ordersUntil });
  } else if (times?.opensAt) {
    service = t('adminHome.header.closed', { when: times.opensIn || times.opensAt });
  }
  const closed = !times?.ordersUntil;
  const soon = left !== null && left <= SOON_MINUTES;

  const canOrder = can('orders.take');
  const canBook = can('reservations.manage');
  const canSoldOut = can('menu.availability.update');

  return (
    <header className={styles.header}>
      <div className={styles.greeting}>
        {now && <p className={styles.date}>{clock.date(now)}</p>}
        <h1 className={styles.title}>
          {greeting && (name ? t('adminHome.greeting.named', { greeting, name }) : greeting)}
        </h1>
        <div className={styles.status}>
          {service && (
            <p className={cx(styles.service, soon && styles.soon, closed && styles.closed)}>
              <span className={styles.dot} aria-hidden="true" />
              {service}
            </p>
          )}
          <ShiftControl />
        </div>
      </div>
      {(canOrder || canBook || canSoldOut) && (
        <div className={styles.actions} role="group" aria-label={t('adminHome.header.actions')}>
          {canOrder && (
            <Button size="sm" iconStart="plus" onClick={() => setPicking(true)}>
              {t('adminHome.header.newOrder')}
            </Button>
          )}
          {canBook && (
            <Button
              size="sm"
              variant="secondary"
              iconStart="calendar"
              onClick={() => setBooking({ kind: 'new' })}
            >
              {t('adminHome.header.newBooking')}
            </Button>
          )}
          {canSoldOut && (
            <Button size="sm" variant="secondary" iconStart="xc" href={ADMIN_LINKS.menu}>
              {t('adminHome.header.soldOut')}
            </Button>
          )}
        </div>
      )}
      {picking && (
        <TablePickDialog
          onClose={() => setPicking(false)}
          onPick={(table) => {
            setPicking(false);
            setPad({ kind: 'new', table });
          }}
        />
      )}
      {pad && <OrderPad target={pad} onClose={() => setPad(null)} />}
      {booking && <ReservationEditor target={booking} onClose={() => setBooking(null)} />}
    </header>
  );
}
