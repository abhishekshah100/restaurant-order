'use client';

import { useState } from 'react';
import { isBackendEnabled } from '@/api/backend';
import { useContent, useCurrentShift } from '@/api/hooks';
import { useShiftClock } from '@/api/mutations';
import { Button, Dialog } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './HomeHeader.module.css';

/**
 * Start shift / Clock out, in the home's header (optional: nothing needs a shift). On shift it
 * says since when; clocking out asks first, since it releases the person's tables for whoever
 * takes over. The shift's start also starts My shift's count.
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
    return (
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
