'use client';

import { useState } from 'react';
import { isBackendEnabled } from '@/api/backend';
import { useContent, useCurrentShift, useMyRota } from '@/api/hooks';
import { useShiftClock } from '@/api/mutations';
import { Button, Dialog } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { spanLabel } from '@/lib/rota';
import { useToast } from '@/context/ToastContext';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './HomeHeader.module.css';

/**
 * Shift in / Shift out, in the home's header (optional: nothing needs a shift). Before shifting
 * in it says the shift planned for today (the published rota); on shift, since when. Shifting
 * out asks first, since it releases the person's tables for whoever takes over. The shift's
 * start also starts My shift's count.
 */
export function ShiftControl() {
  const t = useContent('common');
  const { branch, clock, can } = useAdminWorkspace();
  const { showToast } = useToast();
  const works =
    isBackendEnabled() &&
    (can('orders.take') ||
      can('payments.collect') ||
      can('service.respond') ||
      can('kitchen.update'));
  const shift = useCurrentShift(branch.id, works);
  const rota = useMyRota(branch.id, works);
  const now = useNow(60_000);
  const today = now ? clock.dayKey(now) : null;
  const planned = rota.data?.shifts.find((s) => s.day === today);
  const change = useShiftClock();
  const [confirming, setConfirming] = useState(false);
  if (!works || shift.data === undefined) return null;

  const failed = () => showToast(t('adminHome.shift.clockFailed'), { tone: 'error' });
  const start = () =>
    change.mutate(
      { branchId: branch.id, action: 'start' },
      {
        onSuccess: (s) =>
          showToast(t('adminHome.shift.started', { time: clock.time(s.startedAt) }), {
            tone: 'success',
          }),
        onError: failed,
      },
    );
  const end = () =>
    change.mutate(
      { branchId: branch.id, action: 'end' },
      {
        onSuccess: () => {
          setConfirming(false);
          showToast(t('adminHome.shift.ended'), { tone: 'success' });
        },
        onError: failed,
      },
    );

  if (!shift.data) {
    const button = (
      <Button
        size="sm"
        variant="secondary"
        iconStart="clock"
        loading={change.isPending}
        onClick={start}
      >
        {t('adminHome.shift.start')}
      </Button>
    );
    return planned ? (
      <span className={styles.planned}>
        <span className={styles.plannedText}>
          {t('adminHome.shift.planned', { time: spanLabel(planned.startsAt, planned.endsAt) })}
        </span>
        {button}
      </span>
    ) : (
      button
    );
  }
  return (
    <span className={styles.onShift}>
      <span className={styles.onShiftText}>
        {t('adminHome.shift.since', { time: clock.time(shift.data.startedAt) })}
      </span>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
        {t('adminHome.shift.clockOut')}
      </Button>
      {confirming && (
        <Dialog
          open
          onClose={() => setConfirming(false)}
          presentation="adaptive"
          title={t('adminHome.shift.confirmTitle')}
          description={t('adminHome.shift.confirmBody')}
          footer={
            <Button block loading={change.isPending} onClick={end}>
              {t('adminHome.shift.clockOut')}
            </Button>
          }
        >
          <p className="t-small c2">
            {t('adminHome.shift.since', { time: clock.time(shift.data.startedAt) })}
          </p>
        </Dialog>
      )}
    </span>
  );
}
