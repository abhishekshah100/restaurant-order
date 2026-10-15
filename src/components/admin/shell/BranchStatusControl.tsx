'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useSetBranchStatus } from '@/api/mutations';
import { Button, Chip, Dialog, Icon, OptionGroup } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/cx';
import type { BranchStatus as Status } from '@/types/branch';
import { BranchStatus } from './BranchStatus';
import { useAdminWorkspace } from './AdminWorkspace';
import styles from './BranchStatusControl.module.css';

const STATUSES: readonly Status[] = ['open', 'paused', 'closed'];
const PAUSE_MINUTES = [15, 30, 45, 60, 90] as const;
type PauseMinutes = (typeof PAUSE_MINUTES)[number];

/**
 * The branch's status as a button: it opens "Taking orders?" — open, pause new orders for a
 * while (back by itself), or close for the rest of today (open again tomorrow). Guests see it
 * within a minute; waiters can still take orders at the table.
 */
export function BranchStatusControl({
  onDark = false,
  className,
}: {
  onDark?: boolean;
  className?: string;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={cx(styles.button, onDark && styles.onDark, className)}
        onClick={() => setOpen(true)}
        aria-label={t('adminShell.statusControl.label', {
          status: t(`adminShell.status.${branch.status}`),
        })}
      >
        <BranchStatus status={branch.status} onDark={onDark} />
        <Icon name="chevd" size="xs" className={styles.chevron} />
      </button>
      {open && <StatusDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function StatusDialog({ onClose }: { onClose: () => void }) {
  const t = useContent('common');
  const { branch, region, clock } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useSetBranchStatus();
  const [status, setStatus] = useState<Status>(branch.status);
  const [minutes, setMinutes] = useState<PauseMinutes>(30);
  const until = branch.statusUntil ? clock.time(branch.statusUntil) : '';
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
            sub: t(`adminShell.statusControl.options.${s}Sub`, { time: region.opensAt }),
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
