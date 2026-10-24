'use client';

import dynamic from 'next/dynamic';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { useState } from 'react';
import { useContent } from '@/api/hooks';
import type { Reservation } from '@/types/admin';
import type { EditorTarget } from '../reservations/ReservationEditor';
import { ReservationRow } from '../reservations/ReservationRow';
import { useReservationStatus } from '../reservations/useReservationStatus';
import styles from './TableBookings.module.css';

// Popups: each downloaded the first time it opens.
const ReservationDialog = dynamic(
  () => import('../reservations/ReservationDialog').then((m) => m.ReservationDialog),
  {
    ssr: false,
    loading: () => <LoadingSignal />,
  },
);

/**
 * A table's bookings today still to come or seated, by time, with Seat when the guests can sit;
 * a row opens the booking (Change goes to the form on the table's page).
 */
export function TableBookings({
  reservations,
  now,
  onEdit,
}: {
  reservations: readonly Reservation[];
  now: number;
  onEdit: (target: EditorTarget) => void;
}) {
  const t = useContent('common');
  const status = useReservationStatus();
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = reservations.find((r) => r.id === openId);

  return (
    <section className={styles.panel} aria-labelledby="bookings-title">
      <header>
        <h2 id="bookings-title" className={styles.title}>
          {t('adminReservations.tableBookings.title')}
        </h2>
        <p className={styles.subtitle}>{t('adminReservations.tableBookings.subtitle')}</p>
      </header>
      <ul className={styles.list}>
        {reservations.map((r) => (
          <ReservationRow
            key={r.id}
            reservation={r}
            now={now}
            showTable={false}
            seating={status.busy(r, 'seated')}
            onOpen={() => setOpenId(r.id)}
            onSeat={() => status.set(r, 'seated')}
          />
        ))}
      </ul>
      {opened && (
        <ReservationDialog
          reservation={opened}
          now={now}
          onClose={() => setOpenId(null)}
          onEdit={(r) => {
            setOpenId(null);
            onEdit({ kind: 'edit', reservation: r });
          }}
        />
      )}
    </section>
  );
}
