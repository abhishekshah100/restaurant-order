'use client';

import { useState } from 'react';
import { useContent, useRotaRequests } from '@/api/hooks';
import { useShiftSwap, useTimeOff } from '@/api/mutations';
import { Button, Icon, Input, Tag } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { daysLabel } from '@/lib/dayRange';
import { spanLabel } from '@/lib/rota';
import type { SwapView, TimeOffView } from '@/types/admin';
import { SettingsNote, SettingsSkeleton } from '../settings/shared/SettingsEditor';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import editor from '../settings/shared/SettingsEditor.module.css';
import styles from './RotaRequests.module.css';

const atNoon = (day: string) => new Date(`${day}T12:00:00Z`);

const STATUS_TAG = {
  pending: 'warn',
  awaitingColleague: 'plain',
  awaitingManager: 'warn',
  approved: 'ok',
  declined: 'err',
  cancelled: 'plain',
} as const;

/** A request's yes or no, with an optional note for the person. */
function Decide({
  id,
  saving,
  onDecide,
}: {
  id: string;
  saving: boolean;
  onDecide: (approve: boolean, note?: string) => void;
}) {
  const t = useContent('common');
  const [note, setNote] = useState('');
  return (
    <div className={styles.decide}>
      <Input
        id={`note-${id}`}
        label={t('adminSettings.rota.requests.note')}
        optional
        maxLength={200}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className={styles.decideButtons}>
        <Button
          size="sm"
          variant="secondary"
          iconStart="x"
          loading={saving}
          onClick={() => onDecide(false, note.trim() || undefined)}
        >
          {t('adminSettings.rota.requests.decline')}
        </Button>
        <Button
          size="sm"
          iconStart="check"
          loading={saving}
          onClick={() => onDecide(true, note.trim() || undefined)}
        >
          {t('adminSettings.rota.requests.approve')}
        </Button>
      </div>
    </div>
  );
}

/**
 * Team › Requests (`rota.plan`): what staff asked for, in the order a manager deals with it —
 * waiting for your answer (time off; swaps a colleague already said yes to), then swaps still
 * with a colleague, then what was answered in the last 30 days. Staff see the answer (and any
 * note) in the app; an approved swap moves the shift on the rota.
 */
export function RotaRequests() {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const { showToast } = useToast();
  const query = useRotaRequests(branch.id);
  const timeOff = useTimeOff();
  const swap = useShiftSwap();
  const data = query.data;

  const days = (from: string, to: string) => daysLabel(clock.date, from, to);
  const failed = () => showToast(t('adminSettings.rota.toast.failed'), { tone: 'error' });
  const decided = (approve: boolean) =>
    showToast(
      approve
        ? t('adminSettings.rota.requests.approved')
        : t('adminSettings.rota.requests.declined'),
      { tone: 'success' },
    );
  const swapLine = (s: SwapView) =>
    t('adminSettings.rota.requests.swapLine', {
      from: s.from.name,
      to: s.to.name,
      day: clock.date(atNoon(s.shift.day)),
      time: spanLabel(s.shift.startsAt, s.shift.endsAt),
    });
  const decidedLine = (r: { decidedBy?: string; decidedAt?: string }) =>
    r.decidedBy && r.decidedAt
      ? t('adminSettings.rota.requests.decidedBy', {
          name: r.decidedBy,
          date: clock.dateTime(r.decidedAt),
        })
      : null;

  let content;
  if (data) {
    const pendingOff = data.timeOff.filter((r) => r.status === 'pending');
    const pendingSwaps = data.swaps.filter((s) => s.status === 'awaitingManager');
    const withColleague = data.swaps.filter((s) => s.status === 'awaitingColleague');
    const history: (TimeOffView | SwapView)[] = [
      ...data.timeOff.filter((r) => r.status !== 'pending'),
      ...data.swaps.filter(
        (s) => s.status !== 'awaitingManager' && s.status !== 'awaitingColleague',
      ),
    ].sort((a, b) => (b.decidedAt ?? b.createdAt).localeCompare(a.decidedAt ?? a.createdAt));
    const waiting = pendingOff.length + pendingSwaps.length;

    content = (
      <>
        <section className={editor.card} aria-labelledby="requests-waiting">
          <h2 id="requests-waiting" className={styles.title}>
            {t('adminTeam.requests.waiting')}
            <span className={styles.count}>{waiting}</span>
          </h2>
          {waiting === 0 ? (
            <p className={styles.allClear}>
              <Icon name="checkc" size="sm" />
              {t('adminSettings.rota.requests.nothing')}
            </p>
          ) : (
            <ul className={styles.list}>
              {pendingOff.map((r) => (
                <li key={r.id} className={styles.request}>
                  <span className={styles.kind} data-kind="off" aria-hidden="true">
                    <Icon name="calendar" size="sm" />
                  </span>
                  <div className={styles.body}>
                    <p className={styles.what}>
                      {t('adminSettings.rota.requests.timeOffLine', {
                        name: r.staff.name,
                        days: days(r.from, r.to),
                      })}
                    </p>
                    <p className={styles.reason}>
                      {t('adminSettings.rota.requests.quoted', { text: r.reason })}
                    </p>
                    <Decide
                      id={r.id}
                      saving={timeOff.isPending}
                      onDecide={(approve, note) =>
                        timeOff.mutate(
                          { branchId: branch.id, id: r.id, decide: { approve, note } },
                          { onSuccess: () => decided(approve), onError: failed },
                        )
                      }
                    />
                  </div>
                </li>
              ))}
              {pendingSwaps.map((s) => (
                <li key={s.id} className={styles.request}>
                  <span className={styles.kind} data-kind="swap" aria-hidden="true">
                    <Icon name="swap" size="sm" />
                  </span>
                  <div className={styles.body}>
                    <p className={styles.what}>{swapLine(s)}</p>
                    <p className={styles.meta}>
                      {t('adminSettings.rota.requests.colleagueSaidYes', { name: s.to.name })}
                    </p>
                    {s.note && (
                      <p className={styles.reason}>
                        {t('adminSettings.rota.requests.quoted', { text: s.note })}
                      </p>
                    )}
                    <Decide
                      id={s.id}
                      saving={swap.isPending}
                      onDecide={(approve, note) =>
                        swap.mutate(
                          { branchId: branch.id, id: s.id, decide: { approve, note } },
                          { onSuccess: () => decided(approve), onError: failed },
                        )
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {withColleague.length > 0 && (
          <section className={editor.card} aria-labelledby="requests-colleague">
            <h2 id="requests-colleague" className={styles.title}>
              {t('adminSettings.rota.requests.withColleague')}
            </h2>
            <ul className={styles.plain}>
              {withColleague.map((s) => (
                <li key={s.id} className={styles.plainRow}>
                  <span>{swapLine(s)}</span>
                  <Tag variant="plain" icon={null}>
                    {t('adminSettings.rota.requests.status.awaitingColleague')}
                  </Tag>
                </li>
              ))}
            </ul>
          </section>
        )}

        {history.length > 0 && (
          <section className={editor.card} aria-labelledby="requests-recent">
            <h2 id="requests-recent" className={styles.title}>
              {t('adminSettings.rota.requests.recent')}
            </h2>
            <ul className={styles.plain}>
              {history.map((r) => (
                <li key={r.id} className={styles.plainRow}>
                  <span>
                    {'reason' in r
                      ? t('adminSettings.rota.requests.timeOffLine', {
                          name: r.staff.name,
                          days: days(r.from, r.to),
                        })
                      : swapLine(r)}
                    {decidedLine(r) && (
                      <span className={styles.meta}>
                        {' · '}
                        {decidedLine(r)}
                      </span>
                    )}
                    {'reason' in r && (
                      <span className={styles.line}>
                        {t('adminSettings.rota.requests.reason', { text: r.reason })}
                      </span>
                    )}
                    {'reason' in r && r.decisionNote && (
                      <span className={styles.line}>
                        {t('adminSettings.rota.requests.answer', { text: r.decisionNote })}
                      </span>
                    )}
                  </span>
                  <Tag variant={STATUS_TAG[r.status]} icon={null}>
                    {t(`adminSettings.rota.requests.status.${r.status}`)}
                  </Tag>
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    );
  } else if (query.isError) {
    content = <SettingsNote tone="warn">{t('adminSettings.rota.failed')}</SettingsNote>;
  } else {
    content = <SettingsSkeleton label={t('adminSettings.rota.loading')} />;
  }

  return (
    <div className={editor.page}>
      <p className={styles.lead}>{t('adminTeam.requests.lead')}</p>
      {content}
    </div>
  );
}
