'use client';

import { type ReactNode, useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent, useMyRota, useRotaColleagues } from '@/api/hooks';
import { useShiftSwap, useTimeOff } from '@/api/mutations';
import { Button, Dialog, Input, Select, Tag } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminStaffId } from '@/hooks/useAdminSession';
import { daysLabel } from '@/lib/dayRange';
import { spanLabel } from '@/lib/rota';
import type { MyRotaResponse, RotaShift, SwapView, TimeOffView } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './HomePanels.module.css';

const atNoon = (day: string) => new Date(`${day}T12:00:00Z`);

const TAG = {
  pending: 'warn',
  awaitingColleague: 'plain',
  awaitingManager: 'warn',
  approved: 'ok',
  declined: 'err',
  cancelled: 'plain',
} as const;

/**
 * My requests on the rota: swaps asked of me (Take it / No, sorry), and my own leave (with my
 * reason and the manager's note) and swaps with where they stand (Cancel while open). Nothing
 * when there are none.
 */
export function MyRotaRequests({ rota, today }: { rota: MyRotaResponse; today: string }) {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const adminId = useAdminStaffId();
  const { showToast } = useToast();
  const timeOff = useTimeOff();
  const swap = useShiftSwap();
  const failed = () => showToast(t('adminHome.rota.toast.failed'), { tone: 'error' });
  const day = (key: string) => clock.date(atNoon(key));
  const days = (r: TimeOffView) => daysLabel(clock.date, r.from, r.to);
  const when = (s: SwapView) => ({
    day: day(s.shift.day),
    time: spanLabel(s.shift.startsAt, s.shift.endsAt),
  });

  const incoming = rota.swaps.filter(
    (s) => s.to.id === adminId && s.status === 'awaitingColleague',
  );
  const mine = rota.swaps.filter((s) => s.from.id === adminId);
  if (incoming.length + mine.length + rota.timeOff.length === 0) return null;

  const note = (text?: string) =>
    text ? (
      <span className={styles.rotaRequestNote}>
        {t('adminSettings.rota.requests.quoted', { text })}
      </span>
    ) : null;

  return (
    <section className={styles.rotaRequests} aria-labelledby="my-requests-title">
      <h3 id="my-requests-title" className={styles.rotaRequestsTitle}>
        {t('adminHome.rota.requests')}
      </h3>
      {incoming.map((s) => (
        <div key={s.id} className={styles.rotaRequest}>
          <span className={styles.rotaRequestText}>
            <span>{t('adminHome.rota.swapIn', { name: s.from.name, ...when(s) })}</span>
            {note(s.note)}
          </span>
          <span className={styles.rotaRequestActions}>
            <Button
              size="sm"
              variant="secondary"
              loading={swap.isPending}
              onClick={() =>
                swap.mutate(
                  { branchId: branch.id, id: s.id, respond: false },
                  {
                    onSuccess: () =>
                      showToast(t('adminHome.rota.toast.declined'), { tone: 'success' }),
                    onError: failed,
                  },
                )
              }
            >
              {t('adminHome.rota.decline')}
            </Button>
            <Button
              size="sm"
              loading={swap.isPending}
              onClick={() =>
                swap.mutate(
                  { branchId: branch.id, id: s.id, respond: true },
                  {
                    onSuccess: () =>
                      showToast(t('adminHome.rota.toast.accepted'), { tone: 'success' }),
                    onError: (error) =>
                      isApiError(error, 'colleague_busy')
                        ? showToast(t('adminHome.rota.toast.colleagueBusy'), { tone: 'error' })
                        : failed(),
                  },
                )
              }
            >
              {t('adminHome.rota.accept')}
            </Button>
          </span>
        </div>
      ))}
      {rota.timeOff.map((r) => {
        const open = r.status === 'pending' || (r.status === 'approved' && r.from > today);
        return (
          <div key={r.id} className={styles.rotaRequest}>
            <span className={styles.rotaRequestText}>
              <span>{t('adminHome.rota.timeOffLine', { days: days(r) })}</span>
              <span className={styles.rotaRequestNote}>
                {t('adminHome.rota.reasonLine', { text: r.reason })}
              </span>
              {r.decisionNote && (
                <span className={styles.rotaRequestNote}>
                  {r.decidedBy
                    ? t('adminHome.rota.managerNote', { name: r.decidedBy, text: r.decisionNote })
                    : t('adminHome.rota.managerNoteNoName', { text: r.decisionNote })}
                </span>
              )}
            </span>
            <span className={styles.rotaRequestActions}>
              <Tag variant={TAG[r.status]} icon={null}>
                {t(`adminHome.rota.status.${r.status}`, { name: '' })}
              </Tag>
              {open && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={timeOff.isPending}
                  onClick={() =>
                    timeOff.mutate(
                      { branchId: branch.id, id: r.id, cancel: true },
                      {
                        onSuccess: () =>
                          showToast(t('adminHome.rota.toast.cancelled'), { tone: 'success' }),
                        onError: failed,
                      },
                    )
                  }
                >
                  {t('adminHome.rota.cancel')}
                </Button>
              )}
            </span>
          </div>
        );
      })}
      {mine.map((s) => {
        const open = s.status === 'awaitingColleague' || s.status === 'awaitingManager';
        return (
          <div key={s.id} className={styles.rotaRequest}>
            <span className={styles.rotaRequestText}>
              <span>{t('adminHome.rota.swapOut', { name: s.to.name, ...when(s) })}</span>
              {note(s.decisionNote)}
            </span>
            <span className={styles.rotaRequestActions}>
              <Tag variant={TAG[s.status]} icon={null}>
                {t(`adminHome.rota.status.${s.status}`, { name: s.to.name })}
              </Tag>
              {open && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={swap.isPending}
                  onClick={() =>
                    swap.mutate(
                      { branchId: branch.id, id: s.id, cancel: true },
                      {
                        onSuccess: () =>
                          showToast(t('adminHome.rota.toast.cancelled'), { tone: 'success' }),
                        onError: failed,
                      },
                    )
                  }
                >
                  {t('adminHome.rota.cancel')}
                </Button>
              )}
            </span>
          </div>
        );
      })}
    </section>
  );
}

/** Shifts I've already asked someone to take (no second ask while one is open). */
export const swappingOf = (rota: MyRotaResponse, me: string | undefined) =>
  new Set(
    rota.swaps
      .filter(
        (s) =>
          s.from.id === me && (s.status === 'awaitingColleague' || s.status === 'awaitingManager'),
      )
      .map((s) => s.shift.id),
  );

type Asking = { kind: 'timeOff' } | { kind: 'swap'; shift: RotaShift } | null;

/**
 * Ask for time off and Swap: their dialogs, opened from My rota (the home card or the kitchen's
 * shift dialog, which closes first: dialogs don't stack).
 */
export function useRotaAsks(): {
  askTimeOff: () => void;
  askSwap: (shift: RotaShift) => void;
  dialogs: ReactNode;
} {
  const [asking, setAsking] = useState<Asking>(null);
  const close = () => setAsking(null);
  return {
    askTimeOff: () => setAsking({ kind: 'timeOff' }),
    askSwap: (shift) => setAsking({ kind: 'swap', shift }),
    dialogs:
      asking?.kind === 'timeOff' ? (
        <TimeOffDialog onClose={close} />
      ) : asking?.kind === 'swap' ? (
        <SwapDialog shift={asking.shift} onClose={close} />
      ) : null,
  };
}

function TimeOffDialog({ onClose }: { onClose: () => void }) {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const { showToast } = useToast();
  const ask = useTimeOff();
  const today = clock.dayKey(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  // My leave already asked for (waiting) or given over any of these days: no second request.
  const mine = useMyRota(branch.id).data?.timeOff ?? [];
  const taken = mine.find(
    (r) => (r.status === 'pending' || r.status === 'approved') && r.from <= to && r.to >= from,
  );
  const errors = {
    to:
      to < from
        ? t('adminHome.rota.timeOffDialog.toBeforeFrom')
        : taken
          ? t('adminHome.rota.timeOffDialog.already', {
              days: daysLabel(clock.date, taken.from, taken.to),
              status: t(
                `adminHome.rota.timeOffDialog.alreadyStatus.${taken.status === 'approved' ? 'approved' : 'pending'}`,
              ),
            })
          : undefined,
    reason: reason.trim().length < 3 ? t('adminHome.rota.timeOffDialog.reasonRequired') : undefined,
  };
  const submit = () => {
    setTried(true);
    if (errors.to || errors.reason) return;
    ask.mutate(
      { branchId: branch.id, ask: { from, to, reason: reason.trim() } },
      {
        onSuccess: () => {
          onClose();
          showToast(t('adminHome.rota.toast.timeOffSent'), { tone: 'success' });
        },
        onError: (error) =>
          showToast(
            isApiError(error, 'time_off_overlap')
              ? t('adminHome.rota.toast.timeOffOverlap')
              : t('adminHome.rota.toast.failed'),
            { tone: 'error' },
          ),
      },
    );
  };
  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminHome.rota.timeOffDialog.title')}
      description={t('adminHome.rota.timeOffDialog.body')}
      footer={
        <Button block iconStart="calendar" loading={ask.isPending} onClick={submit}>
          {t('adminHome.rota.timeOffDialog.send')}
        </Button>
      }
    >
      <div className={styles.askForm}>
        <div className={styles.askRow}>
          <Input
            id="time-off-from"
            type="date"
            min={today}
            label={t('adminHome.rota.timeOffDialog.from')}
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              if (to < event.target.value) setTo(event.target.value);
            }}
          />
          <Input
            id="time-off-to"
            type="date"
            min={from}
            label={t('adminHome.rota.timeOffDialog.to')}
            value={to}
            error={tried || taken ? errors.to : undefined}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        <Input
          id="time-off-reason"
          label={t('adminHome.rota.timeOffDialog.reason')}
          placeholder={t('adminHome.rota.timeOffDialog.reasonPlaceholder')}
          maxLength={200}
          value={reason}
          error={tried ? errors.reason : undefined}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </Dialog>
  );
}

function SwapDialog({ shift, onClose }: { shift: RotaShift; onClose: () => void }) {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const { showToast } = useToast();
  const colleagues = useRotaColleagues(branch.id);
  const ask = useShiftSwap();
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const who = colleagues.data?.find((c) => c.id === to);
  const submit = () => {
    setTried(true);
    if (!to) return;
    ask.mutate(
      {
        branchId: branch.id,
        ask: { shiftId: shift.id, toStaffId: to, note: note.trim() || undefined },
      },
      {
        onSuccess: () => {
          onClose();
          showToast(t('adminHome.rota.toast.swapSent', { name: who?.name ?? '' }), {
            tone: 'success',
          });
        },
        onError: (error) =>
          showToast(
            isApiError(error, 'colleague_busy')
              ? t('adminHome.rota.toast.colleagueBusy')
              : isApiError(error, 'swap_open')
                ? t('adminHome.rota.toast.swapOpen')
                : t('adminHome.rota.toast.failed'),
            { tone: 'error' },
          ),
      },
    );
  };
  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminHome.rota.swapDialog.title')}
      description={t('adminHome.rota.swapDialog.body', {
        day: clock.date(atNoon(shift.day)),
        time: spanLabel(shift.startsAt, shift.endsAt),
      })}
      footer={
        <Button block iconStart="swap" loading={ask.isPending} onClick={submit}>
          {t('adminHome.rota.swapDialog.send')}
        </Button>
      }
    >
      <div className={styles.askForm}>
        <Select
          id="swap-to"
          label={t('adminHome.rota.swapDialog.who')}
          value={to}
          error={tried && !to ? t('adminHome.rota.swapDialog.whoPlaceholder') : undefined}
          onChange={(event) => setTo(event.target.value)}
        >
          <option value="" disabled>
            {t('adminHome.rota.swapDialog.whoPlaceholder')}
          </option>
          {(colleagues.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {t('adminHome.rota.swapDialog.person', { name: c.name, role: c.role })}
            </option>
          ))}
        </Select>
        <Input
          id="swap-note"
          label={t('adminHome.rota.swapDialog.note')}
          optional
          placeholder={t('adminHome.rota.swapDialog.notePlaceholder')}
          maxLength={200}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </Dialog>
  );
}
