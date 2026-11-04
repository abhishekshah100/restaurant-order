'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { isBackendEnabled } from '@/api/backend';
import { useContent, useReservations } from '@/api/hooks';
import { Button, Dialog, Icon } from '@/components/ui';
import { tablePath } from '@/lib/adminNav';
import {
  bookingTables,
  cancelOutcome,
  canMarkNoShow,
  canSeat,
  reservationState,
} from '@/lib/reservations';
import { cx } from '@/lib/cx';
import type { Reservation, ReservationRules } from '@/types/admin';
import { usePaymentText } from '../payments/usePaymentText';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { RemindActions } from './RemindActions';
import { useReservationStatus } from './useReservationStatus';
import { useReservationText } from './useReservationText';
import styles from './ReservationDialog.module.css';
import extras from './ReservationExtras.module.css';

const DepositDialog = dynamic(() => import('./DepositDialog').then((m) => m.DepositDialog), {
  ssr: false,
});

/**
 * One booking with what can be done to it: Seat guests (from an hour before), Change, Didn't
 * come (once its time has passed) and Cancel booking (with a step to confirm) while it's
 * booked; Restore when it was cancelled or a no-show; the table's page once seated.
 */
export function ReservationDialog({
  reservation,
  now,
  onClose,
  onEdit,
}: {
  /** Looked up on every poll, so it shows the booking as it is now. */
  reservation: Reservation | undefined;
  now: number;
  onClose: () => void;
  onEdit: (r: Reservation) => void;
}) {
  const t = useContent('common');
  const [confirming, setConfirming] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const status = useReservationStatus();
  const { branch, can } = useAdminWorkspace();
  const manage = can('reservations.manage');
  // Deposits and reminders are the server's (the mock books without them).
  const backend = isBackendEnabled();
  const rules = useReservations(branch.id).data?.rules;
  if (!reservation) return null;
  const r = reservation;
  const close = () => {
    setConfirming(false);
    onClose();
  };

  if (depositing) {
    return <DepositDialog reservation={r} rules={rules} onClose={() => setDepositing(false)} />;
  }

  if (confirming) {
    return (
      <CancelStep
        rules={rules}
        now={now}
        reservation={r}
        busy={status.busy(r, 'cancelled')}
        onKeep={() => setConfirming(false)}
        onCancel={() => status.set(r, 'cancelled', close)}
      />
    );
  }

  let footer;
  // Only the table's page for those who can't change bookings.
  if (r.status !== 'seated' && !manage) {
    footer = undefined;
  } else if (r.status === 'booked') {
    const seatable = canSeat(r, now);
    footer = (
      <div className={styles.actions}>
        <Button
          block
          iconStart="check"
          disabled={!seatable}
          loading={status.busy(r, 'seated')}
          onClick={() => status.set(r, 'seated', close)}
        >
          {t('adminReservations.detail.seat')}
        </Button>
        <div className={styles.secondary}>
          <Button variant="secondary" iconStart="pencil" onClick={() => onEdit(r)}>
            {t('adminReservations.detail.edit')}
          </Button>
          {backend && !r.deposit && (
            <Button variant="secondary" iconStart="cash" onClick={() => setDepositing(true)}>
              {t('adminReservations.deposit.record')}
            </Button>
          )}
          {canMarkNoShow(r, now) && (
            <Button
              variant="secondary"
              iconStart="flag"
              loading={status.busy(r, 'noShow')}
              onClick={() => status.set(r, 'noShow', close)}
            >
              {t('adminReservations.detail.noShow')}
            </Button>
          )}
          <Button variant="ghost" className={styles.danger} onClick={() => setConfirming(true)}>
            {t('adminReservations.detail.cancel')}
          </Button>
        </div>
      </div>
    );
  } else if (r.status === 'seated') {
    footer = (
      <Button block variant="secondary" iconStart="table" href={tablePath(r.table)}>
        {t('adminReservations.detail.openTable', { table: r.table })}
      </Button>
    );
  } else {
    footer = (
      <Button
        block
        variant="secondary"
        iconStart="refresh"
        loading={status.busy(r, 'booked')}
        onClick={() => status.set(r, 'booked')}
      >
        {t('adminReservations.detail.restore')}
      </Button>
    );
  }

  return (
    <Dialog
      open
      onClose={close}
      presentation="adaptive"
      title={t('adminReservations.detail.title', { id: r.id })}
      footer={footer}
    >
      <ReservationFacts reservation={r} now={now} rules={rules} />
      {backend && manage && r.status === 'booked' && r.phone && (
        <div className={styles.remindRow}>
          <RemindActions reservation={r} />
        </div>
      )}
    </Dialog>
  );
}

function ReservationFacts({
  reservation: r,
  now,
  rules,
}: {
  reservation: Reservation;
  now: number;
  rules?: ReservationRules;
}) {
  const t = useContent('common');
  const { clock, money } = useAdminWorkspace();
  const { methodName } = usePaymentText();
  const deposit = r.deposit;
  const text = useReservationText();
  const state = reservationState(r, now);
  const end = new Date(Date.parse(r.at) + r.minutes * 60_000);

  return (
    <div className={styles.body}>
      <div className={styles.head} data-state={state}>
        <span className={styles.badge} aria-hidden="true">
          <Icon name="calendar" size="md" />
        </span>
        <div className={styles.headText}>
          <p className={styles.guest}>{r.guestName}</p>
          <p className={styles.state}>
            <span className={styles.dot} aria-hidden="true" />
            {text.state(r, now)}
          </p>
        </div>
      </div>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>{t('adminReservations.detail.when')}</dt>
          <dd>
            {t('adminReservations.detail.whenValue', {
              date: clock.date(r.at),
              time: clock.time(r.at),
              end: clock.time(end),
            })}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('adminReservations.detail.table')}</dt>
          <dd>
            {/* Each table opens its page: "Table 4 + 5". */}
            {bookingTables(r).map((n, i) => (
              <span key={n}>
                {i > 0 && ' + '}
                <Link href={tablePath(n)} className={styles.link}>
                  {i === 0 ? t('adminReservations.table', { table: n }) : n}
                </Link>
              </span>
            ))}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('adminReservations.detail.party')}</dt>
          <dd>{text.guests(r.partySize)}</dd>
        </div>
        {r.phone && (
          <div className={styles.fact}>
            <dt>{t('adminReservations.detail.phone')}</dt>
            <dd>
              <a href={`tel:${r.phone}`} className={styles.link}>
                {text.phone(r.phone)}
              </a>
            </dd>
          </div>
        )}
        {r.note && (
          <div className={cx(styles.fact, styles.wide)}>
            <dt>{t('adminReservations.detail.note')}</dt>
            <dd className={styles.note}>{r.note}</dd>
          </div>
        )}
        <div className={cx(styles.fact, styles.wide)}>
          <dt>{t('adminReservations.detail.bookedBy')}</dt>
          <dd className={styles.history}>
            <span>
              {t('adminReservations.detail.bookedByValue', {
                name: r.createdBy,
                date: clock.date(r.createdAt),
              })}
            </span>
            {r.updatedAt && r.updatedBy && (
              <span>
                {t(`adminReservations.detail.updated.${r.status}`, {
                  name: r.updatedBy,
                  time: clock.dateTime(r.updatedAt),
                })}
              </span>
            )}
            {r.autoNoShow && r.updatedAt && (
              <span>
                {t('adminReservations.detail.updated.noShowAuto', {
                  time: clock.dateTime(r.updatedAt),
                  minutes: rules?.noShowAfterMinutes ?? 30,
                })}
              </span>
            )}
            {r.reminded && (
              <span>
                {r.reminded.by
                  ? t('adminReservations.remind.reminded', {
                      name: r.reminded.by,
                      time: clock.dateTime(r.reminded.at),
                    })
                  : t('adminReservations.remind.remindedNoName', {
                      time: clock.dateTime(r.reminded.at),
                    })}
              </span>
            )}
          </dd>
        </div>
        {deposit && (
          <div className={cx(styles.fact, styles.wide)}>
            <dt>{t('adminReservations.deposit.title')}</dt>
            <dd className={styles.history}>
              <span>
                {deposit.status === 'applied' && !deposit.order
                  ? t('adminReservations.deposit.status.appliedNoOrder', {
                      amount: money.format(deposit.amount),
                    })
                  : t(`adminReservations.deposit.status.${deposit.status}`, {
                      amount: money.format(deposit.amount),
                      method: methodName(deposit.method),
                      order: deposit.order ?? '',
                    })}
              </span>
              {deposit.by && (
                <span>
                  {t('adminReservations.deposit.by', {
                    name: deposit.by,
                    time: clock.dateTime(deposit.at),
                  })}
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>

      {r.status === 'booked' && !canSeat(r, now) && (
        <p className={styles.hint}>
          <Icon name="info" size="xs" />
          {t('adminReservations.detail.notYet')}
        </p>
      )}
    </div>
  );
}

function CancelStep({
  reservation: r,
  rules,
  now,
  busy,
  onKeep,
  onCancel,
}: {
  reservation: Reservation;
  rules?: ReservationRules;
  now: number;
  busy: boolean;
  onKeep: () => void;
  onCancel: () => void;
}) {
  const t = useContent('common');
  const { clock, money } = useAdminWorkspace();
  const held = r.deposit?.status === 'held' ? r.deposit : undefined;
  const hours = rules?.depositCancelHours ?? 24;
  const outcome = held ? cancelOutcome(r.at, now, hours) : undefined;
  const text = useReservationText();
  return (
    <Dialog
      open
      onClose={onKeep}
      presentation="adaptive"
      title={t('adminReservations.detail.confirmCancel.title', { id: r.id })}
      footer={
        <div className={styles.pair}>
          <Button variant="secondary" onClick={onKeep}>
            {t('adminReservations.detail.confirmCancel.keep')}
          </Button>
          <Button className={styles.destroy} loading={busy} onClick={onCancel}>
            {t('adminReservations.detail.confirmCancel.confirm')}
          </Button>
        </div>
      }
    >
      <p className={styles.confirm}>
        {t('adminReservations.detail.confirmCancel.body', {
          tables: text.tables(bookingTables(r)),
          time: clock.dateTime(r.at),
        })}
      </p>
      {held && outcome && (
        <p className={cx(extras.note, outcome === 'kept' && extras.warn)}>
          {outcome === 'refunded'
            ? t('adminReservations.deposit.cancelRefund', {
                amount: money.format(held.amount),
                cash: held.method === 'cash' ? t('adminReservations.deposit.cancelRefundCash') : '',
              })
            : t('adminReservations.deposit.cancelKeep', {
                amount: money.format(held.amount),
                hours,
              })}
        </p>
      )}
    </Dialog>
  );
}
