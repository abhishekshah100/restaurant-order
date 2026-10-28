'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useSetBranchStatus } from '@/api/mutations';
import { Button, Chip, Dialog, Icon, OptionGroup } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import type { BranchStatus as Status } from '@/types/branch';
import { useAdminWorkspace } from './AdminWorkspace';
import styles from './BranchStatusControl.module.css';
import { useNow } from '@/hooks/useNow';
import { nextOpeningAfterToday } from '@/lib/branchHours';

const STATUSES: readonly Status[] = ['open', 'paused', 'closed'];
const PAUSE_MINUTES = [15, 30, 45, 60, 90] as const;
type PauseMinutes = (typeof PAUSE_MINUTES)[number];

/** "Taking orders?": open, pause new orders for a while, or close for the rest of today. */
export function BranchStatusDialog({ onClose }: { onClose: () => void }) {
  const t = useContent('common');
  const { branch, region, clock } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useSetBranchStatus();
  const [status, setStatus] = useState<Status>(branch.status);
  const [minutes, setMinutes] = useState<PauseMinutes>(30);
  // Closing for the rest of today waits for the next day the week opens.
  const today = useNow();
  const next = today ? nextOpeningAfterToday(region, today) : null;
  const reopensAt = next ? clock.dateTime(next.at) : '';
  const until = branch.statusUntil ? clock.dateTime(branch.statusUntil) : '';
  const now = t(`adminShell.statusControl.now.${branch.status}`, {
    branch: branch.shortName,
    time: until,
  });

  const submit = () =>
    save.mutate(
      {
        branchId: branch.id,
        body: status === 'paused' ? { status, minutes } : { status },
      },
      {
        onSuccess: () => {
          showToast(
            t(`adminShell.statusControl.saved.${status}`, { branch: branch.shortName, minutes }),
            { tone: 'success' },
          );
          onClose();
        },
        onError: () => showToast(t('adminShell.statusControl.failed'), { tone: 'error' }),
      },
    );

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminShell.statusControl.title')}
      description={now}
      footer={
        <Button block iconStart="check" loading={save.isPending} onClick={submit}>
          {t('adminShell.statusControl.save')}
        </Button>
      }
    >
      <div className={styles.body}>
        <OptionGroup
          type="radio"
          id="branch-status"
          title={t('adminShell.statusControl.title')}
          titleClassName="visually-hidden"
          value={status}
          onChange={(id) => setStatus(STATUSES.find((s) => s === id) ?? status)}
          choices={STATUSES.map((s) => ({
            id: s,
            label: t(`adminShell.statusControl.options.${s}`),
            sub: t(`adminShell.statusControl.options.${s}Sub`, { time: reopensAt }),
          }))}
        />
        {status === 'paused' && (
          <div className={styles.minutes}>
            <span className={styles.legend}>{t('adminShell.statusControl.for')}</span>
            <div
              className={styles.chips}
              role="group"
              aria-label={t('adminShell.statusControl.for')}
            >
              {PAUSE_MINUTES.map((m) => (
                <Chip key={m} pressed={minutes === m} onClick={() => setMinutes(m)}>
                  {t('adminShell.statusControl.minutes', { count: m })}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <p className={styles.note}>
          <Icon name="info" size="xs" />
          {t('adminShell.statusControl.note')}
        </p>
      </div>
    </Dialog>
  );
}
