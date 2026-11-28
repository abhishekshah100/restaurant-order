'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import type { ClientDetail, SuspendNotice } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { useSuspendPlatformClient } from '@/api/mutations';
import { Button, Chip, Dialog, Input, OptionGroup, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { FINISH_HOURS, SUSPEND_NOTICES, localInputOf } from '@/lib/platform';
import styles from './Platform.module.css';

type When = 'now' | 'closing' | 'date';

/**
 * Suspending a client (restaurant-backend › ADR-055): now, at closing time tonight or on a date
 * (their staff warned before), the finish-up hours for open bills, what their staff are told and
 * the owner's private note. Planned again, the date moves.
 */
export function SuspendDialog({
  platformKey,
  by,
  client,
  onClose,
}: {
  platformKey: string;
  by: string;
  client: ClientDetail;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const suspend = useSuspendPlatformClient(platformKey);
  const planned = client.suspension?.planned ? client.suspension : null;
  const [when, setWhen] = useState<When>(planned ? 'date' : 'now');
  const [startsAt, setStartsAt] = useState(planned ? localInputOf(planned.startsAt) : '');
  const [finishHours, setFinishHours] = useState(planned?.finishHours ?? 3);
  const [notice, setNotice] = useState<SuspendNotice>(planned?.notice ?? 'paymentOverdue');
  const [message, setMessage] = useState(planned?.message ?? '');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const ready =
    reason.trim().length > 0 &&
    (when !== 'date' || startsAt !== '') &&
    (notice !== 'other' || message.trim().length > 0);

  const confirm = async () => {
    setProblem(null);
    try {
      const saved = await suspend.mutateAsync({
        id: client.id,
        body: {
          by,
          reason: reason.trim(),
          at: when === 'date' ? new Date(startsAt).toISOString() : when,
          finishHours,
          notice,
          ...(notice === 'other' ? { message: message.trim() } : {}),
        },
      });
      const later = saved.suspension?.planned ? saved.suspension.startsAt : null;
      showToast(
        later
          ? t('platform.suspend.planned', {
              name: client.name,
              date: new Date(later).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })
          : t('platform.suspend.done', { name: client.name }),
      );
      onClose();
    } catch (error) {
      // 400 { field: 'at', reason: 'past' | 'tooFar' }.
      const reasonOf = isApiError(error, 'invalid_request') ? error.body?.reason : undefined;
      setProblem(
        reasonOf === 'past'
          ? t('platform.suspend.past')
          : reasonOf === 'tooFar'
            ? t('platform.suspend.tooFar')
            : t('platform.suspend.failed'),
      );
    }
  };

  return (
    <Dialog
      open
      onClose={() => !suspend.isPending && onClose()}
      presentation="modal"
      title={t('platform.suspend.title', { name: client.name })}
      footer={
        <div className={styles.dialogActions}>
          <Button variant="secondary" disabled={suspend.isPending} onClick={onClose}>
            {t('platform.suspend.cancel')}
          </Button>
          <Button
            variant="dark"
            loading={suspend.isPending}
            disabled={!ready}
            onClick={() => void confirm()}
          >
            {t(when === 'now' ? 'platform.suspend.confirmNow' : 'platform.suspend.confirmPlan')}
          </Button>
        </div>
      }
    >
      <div className={styles.dialogBody}>
        <p>{t('platform.suspend.body')}</p>

        <OptionGroup
          id="suspend-when"
          type="radio"
          title={t('platform.suspend.when')}
          headingAs="h3"
          titleClassName={styles.groupTitle}
          value={when}
          onChange={(id) => setWhen(id as When)}
          choices={[
            {
              id: 'now',
              label: t('platform.suspend.whenNow'),
              sub: t('platform.suspend.whenNowSub'),
            },
            {
              id: 'closing',
              label: t('platform.suspend.whenClosing'),
              sub: t('platform.suspend.whenClosingSub'),
            },
            {
              id: 'date',
              label: t('platform.suspend.whenDate'),
              sub: t('platform.suspend.whenDateSub'),
            },
          ]}
        />
        {when === 'date' && (
          <Input
            id="suspend-starts-at"
            type="datetime-local"
            label={t('platform.suspend.startsAt')}
            min={localInputOf(new Date().toISOString())}
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        )}

        <div className={styles.stack}>
          <h3 className={styles.groupTitle}>{t('platform.suspend.finish')}</h3>
          <p className={styles.muted}>{t('platform.suspend.finishHint')}</p>
          <div className={styles.presets} role="group" aria-label={t('platform.suspend.finish')}>
            {FINISH_HOURS.map((hours) => (
              <Chip
                key={hours}
                pressed={finishHours === hours}
                onClick={() => setFinishHours(hours)}
              >
                {hours === 0
                  ? t('platform.suspend.finishNone')
                  : t.plural('platform.suspend.finishHours', hours)}
              </Chip>
            ))}
          </div>
        </div>

        <OptionGroup
          id="suspend-notice"
          type="radio"
          title={t('platform.suspend.notice')}
          headingAs="h3"
          titleClassName={styles.groupTitle}
          value={notice}
          onChange={(id) => setNotice(id as SuspendNotice)}
          choices={SUSPEND_NOTICES.map((id) => ({
            id,
            label: t(`platform.suspend.notices.${id}`),
          }))}
        />
        {notice === 'other' && (
          <Input
            id="suspend-message"
            label={t('platform.suspend.message')}
            maxLength={200}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        )}

        <Textarea
          id="suspend-reason"
          label={t('platform.suspend.reason')}
          maxLength={200}
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {problem && (
          <p className={styles.over} role="alert">
            {problem}
          </p>
        )}
      </div>
    </Dialog>
  );
}
