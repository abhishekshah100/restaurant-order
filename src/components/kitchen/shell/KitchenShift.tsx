'use client';

import { useState } from 'react';
import { isBackendEnabled } from '@/api/backend';
import { useContent, useCurrentShift, useMyRota } from '@/api/hooks';
import { useShiftClock } from '@/api/mutations';
import { MyRotaList } from '@/components/admin/home/MyRotaList';
import { MyRotaRequests, swappingOf, useRotaAsks } from '@/components/admin/home/MyRotaRequests';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { Button, Dialog, Icon } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminStaffId } from '@/hooks/useAdminSession';
import { useNow } from '@/hooks/useNow';
import { cx } from '@/lib/cx';
import { spanLabel } from '@/lib/rota';
import barStyles from './KitchenBar.module.css';
import styles from './KitchenShift.module.css';

/**
 * The kitchen bar's shift button: "On shift" (green) once shifted in, else today's planned shift
 * ("10 AM – 4 PM"), else just Shift. It opens My shift: today's plan, Shift in / Shift out
 * (out asks first) and the week from the published rota.
 */
export function KitchenShift() {
  const t = useContent('kitchen');
  const { branch, clock, can } = useAdminWorkspace();
  const { showToast } = useToast();
  const works = isBackendEnabled() && can('kitchen.update');
  const shift = useCurrentShift(branch.id, works);
  const rota = useMyRota(branch.id, works);
  const change = useShiftClock();
  const now = useNow(60_000);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const me = useAdminStaffId();
  const asks = useRotaAsks();
  if (!works || shift.data === undefined || !now) return null;

  const today = clock.dayKey(now);
  const planned = rota.data?.shifts.find((s) => s.day === today);
  const on = Boolean(shift.data);
  const label = on
    ? t('shift.onShift')
    : planned
      ? spanLabel(planned.startsAt, planned.endsAt)
      : t('shift.button');

  const failed = () => showToast(t('shift.failed'), { tone: 'error' });
  const clockIn = () =>
    change.mutate(
      { branchId: branch.id, action: 'start' },
      {
        onSuccess: (s) =>
          showToast(t('shift.started', { time: clock.time(s.startedAt) }), { tone: 'success' }),
        onError: failed,
      },
    );
  const clockOut = () =>
    change.mutate(
      { branchId: branch.id, action: 'end' },
      {
        onSuccess: () => {
          setConfirming(false);
          showToast(t('shift.ended'), { tone: 'success' });
        },
        onError: failed,
      },
    );

  return (
    <>
      <button
        type="button"
        className={cx(barStyles.iconButton, styles.button, on && styles.on)}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('shift.open', { status: label })}
        title={t('shift.title')}
      >
        {on ? <span className={styles.dot} aria-hidden="true" /> : <Icon name="clock" size="sm" />}
        <span className={styles.label}>{label}</span>
      </button>
      {open && (
        <Dialog
          open
          onClose={() => {
            setOpen(false);
            setConfirming(false);
          }}
          presentation="adaptive"
          title={t('shift.title')}
          footer={
            on ? (
              confirming ? (
                <div className={styles.actions}>
                  <Button variant="secondary" onClick={() => setConfirming(false)}>
                    {t('shift.cancel')}
                  </Button>
                  <Button loading={change.isPending} onClick={clockOut}>
                    {t('shift.confirmOut')}
                  </Button>
                </div>
              ) : (
                <Button block variant="secondary" onClick={() => setConfirming(true)}>
                  {t('shift.shiftOut')}
                </Button>
              )
            ) : (
              <Button block iconStart="clock" loading={change.isPending} onClick={clockIn}>
                {t('shift.shiftIn')}
              </Button>
            )
          }
        >
          <div className={styles.body}>
            <p className={cx(styles.status, on && styles.statusOn)}>
              {shift.data
                ? t('shift.since', { time: clock.time(shift.data.startedAt) })
                : planned
                  ? t('shift.today', { time: spanLabel(planned.startsAt, planned.endsAt) })
                  : t('shift.noneToday')}
            </p>
            {confirming && <p className="t-small c2">{t('shift.confirmBody')}</p>}
            {rota.data && rota.data.shifts.length > 0 && (
              <section aria-label={t('shift.week')}>
                <h3 className={styles.weekTitle}>{t('shift.week')}</h3>
                <MyRotaList
                  today={today}
                  shifts={rota.data.shifts}
                  className={styles.week}
                  swapping={swappingOf(rota.data, me)}
                  onSwap={(s) => {
                    // Dialogs don't stack: this one closes, the swap opens.
                    setOpen(false);
                    asks.askSwap(s);
                  }}
                />
              </section>
            )}
            {rota.data && (
              <div className={styles.requests}>
                <MyRotaRequests rota={rota.data} today={today} />
              </div>
            )}
            <Button
              size="sm"
              variant="secondary"
              iconStart="calendar"
              onClick={() => {
                setOpen(false);
                asks.askTimeOff();
              }}
            >
              {t('shift.askTimeOff')}
            </Button>
          </div>
        </Dialog>
      )}
      {asks.dialogs}
    </>
  );
}
