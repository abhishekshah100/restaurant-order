'use client';

import { useState } from 'react';
import { ApiError, isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import { useFixAttendance } from '@/api/mutations';
import { Button, Chip, Dialog, Icon, Input, Select, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { minutesBetween, typedTimes, wallTime } from '@/lib/attendance';
import {
  SHIFT_FIX_REASONS,
  type PlannedTimes,
  type ShiftFixReason,
  type ShiftRow,
} from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useDuration } from './useDuration';
import styles from './Attendance.module.css';

const NOTE_MAX = 200;

/** What the dialog is for: a shift's times, or a shift someone forgot (maybe whose and when). */
export type FixTarget =
  | { kind: 'fix'; shift: ShiftRow }
  | {
      kind: 'add';
      staffId?: string;
      /** The planned shift they didn't shift in for: its day and times to start from. */
      planned?: PlannedTimes;
    };

/**
 * Fix times (`attendance.fix`): the day, Shift in and Shift out on the branch's clock (an out at
 * or before the in: the next day; or still working), why it's changed (and a note), with the
 * total as typed and the shift's earlier changes. Adding: whose shift too. The server checks
 * what can't be right (in the future, over a day, overlapping another of theirs).
 */
export function FixShiftDialog({
  target,
  people,
  onClose,
}: {
  target: FixTarget;
  people: readonly { id: string; name: string; role: string }[];
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useFixAttendance();
  const zone = branch.timezone;
  const shift = target.kind === 'fix' ? target.shift : undefined;
  const planned = target.kind === 'fix' ? target.shift.planned : target.planned;
  const startFrom = shift?.startedAt ?? planned?.startsAt;
  const endFrom = shift ? shift.endedAt : planned?.endsAt;

  const [staffId, setStaffId] = useState(target.kind === 'add' ? (target.staffId ?? '') : '');
  const [day, setDay] = useState(clock.dayKey(startFrom ?? new Date()));
  const [inTime, setInTime] = useState(startFrom ? wallTime(startFrom, zone) : '');
  // A shift the system closed: its end isn't theirs, so it's to be typed.
  const [outTime, setOutTime] = useState(
    endFrom && !shift?.autoClosed ? wallTime(endFrom, zone) : '',
  );
  const [working, setWorking] = useState(Boolean(shift && !shift.endedAt));
  const [reason, setReason] = useState<ShiftFixReason>(
    target.kind === 'add'
      ? 'forgot_in'
      : shift?.autoClosed || !shift?.endedAt
        ? 'forgot_out'
        : 'wrong_time',
  );
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const name =
    shift?.staff.name ??
    people.find((p) => p.id === staffId)?.name ??
    t('adminTeam.attendance.fix.person');
  const typed = inTime ? typedTimes(day, inTime, working ? null : outTime || null, zone) : null;
  const minutes = typed ? minutesBetween(typed.startedAt, typed.endedAt) : null;
  const span = useDuration();

  const problems = {
    person: target.kind === 'add' && !staffId ? t('adminTeam.attendance.fix.pickPerson') : null,
    out: !working && !outTime ? t('adminTeam.attendance.fix.errors.required') : null,
    note: reason === 'other' && !note.trim() ? t('adminTeam.attendance.fix.noteRequired') : null,
  };
  const blocked = Boolean(problems.person || problems.out || problems.note || !typed);

  const errorText = (error: unknown) => {
    if (isApiError(error, 'shift_overlap')) {
      return t('adminTeam.attendance.fix.errors.overlap', { name });
    }
    // The server says what's wrong with the times (`reason` beside the error code).
    const why =
      error instanceof ApiError ? (error.body as { reason?: unknown } | undefined)?.reason : null;
    const known = ['future', 'beforeStart', 'tooLong', 'required', 'unchanged', 'tooOld'] as const;
    const hit = known.find((k) => k === why);
    return hit
      ? t(`adminTeam.attendance.fix.errors.${hit}`)
      : t('adminTeam.attendance.fix.errors.failed');
  };

  const submit = () => {
    setTried(true);
    setServerError(null);
    if (blocked || !typed) return;
    const body = {
      startedAt: typed.startedAt,
      ...(typed.endedAt ? { endedAt: typed.endedAt } : {}),
      reason,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    save.mutate(
      shift
        ? { branchId: branch.id, id: shift.id, body }
        : { branchId: branch.id, add: { ...body, staffId } },
      {
        onSuccess: () => {
          showToast(
            t(shift ? 'adminTeam.attendance.fix.saved' : 'adminTeam.attendance.fix.added'),
            { tone: 'success' },
          );
          onClose();
        },
        onError: (error) => setServerError(errorText(error)),
      },
    );
  };

  const times = (s: { startedAt: string; endedAt?: string }) =>
    s.endedAt
      ? t('adminTeam.attendance.span', {
          from: clock.dateTime(s.startedAt),
          to: clock.time(s.endedAt),
        })
      : t('adminTeam.attendance.inOnly', { from: clock.dateTime(s.startedAt) });

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t(shift ? 'adminTeam.attendance.fix.titleFix' : 'adminTeam.attendance.fix.titleAdd')}
      description={shift ? `${shift.staff.name} · ${clock.date(shift.startedAt)}` : undefined}
      className={styles.dialog}
      footer={
        <div className={styles.dialogActions}>
          <Button variant="secondary" onClick={onClose}>
            {t('adminTeam.attendance.fix.cancel')}
          </Button>
          <Button iconStart="check" loading={save.isPending} onClick={submit}>
            {t('adminTeam.attendance.fix.save')}
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        {shift?.autoClosed && shift.endedAt && (
          <p className={styles.notice}>
            <Icon name="alert" size="xs" />
            {t('adminTeam.attendance.fix.auto', { time: clock.time(shift.endedAt) })}
          </p>
        )}

        {target.kind === 'add' && (
          <Select
            id="fix-person"
            label={t('adminTeam.attendance.fix.person')}
            value={staffId}
            error={tried ? problems.person : undefined}
            onChange={(event) => setStaffId(event.target.value)}
          >
            <option value="">{t('adminTeam.attendance.fix.pickPerson')}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {t('adminTeam.attendance.fix.personOption', { name: p.name, role: p.role })}
              </option>
            ))}
          </Select>
        )}

        <Input
          id="fix-day"
          type="date"
          label={t('adminTeam.attendance.fix.date')}
          value={day}
          max={clock.dayKey(new Date())}
          onChange={(event) => setDay(event.target.value)}
        />
        <div className={styles.times}>
          <Input
            id="fix-in"
            type="time"
            label={t('adminTeam.attendance.fix.in')}
            value={inTime}
            onChange={(event) => setInTime(event.target.value)}
          />
          <Input
            id="fix-out"
            type="time"
            label={t('adminTeam.attendance.fix.out')}
            value={working ? '' : outTime}
            disabled={working}
            error={tried && !working ? problems.out : undefined}
            onChange={(event) => setOutTime(event.target.value)}
          />
        </div>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={working}
            onChange={(event) => setWorking(event.target.checked)}
          />
          {t('adminTeam.attendance.fix.stillWorking')}
        </label>

        <p className={styles.summaryLine}>
          {minutes !== null && minutes > 0 && (
            <strong>{t('adminTeam.attendance.fix.total', { time: span(minutes) })}</strong>
          )}
          {typed?.overnight && <span>{t('adminTeam.attendance.fix.overnight')}</span>}
          {planned && (
            <span>
              {t('adminTeam.attendance.fix.planned', {
                from: clock.time(planned.startsAt),
                to: clock.time(planned.endsAt),
              })}
            </span>
          )}
        </p>

        <fieldset className={styles.reasons}>
          <legend className={styles.legend}>{t('adminTeam.attendance.fix.reason')}</legend>
          <div className={styles.chips}>
            {SHIFT_FIX_REASONS.map((r) => (
              <Chip key={r} pressed={reason === r} onClick={() => setReason(r)}>
                {t(`adminTeam.attendance.fix.reasons.${r}`)}
              </Chip>
            ))}
          </div>
        </fieldset>
        <Textarea
          id="fix-note"
          label={t('adminTeam.attendance.fix.note')}
          optional={reason !== 'other'}
          placeholder={t('adminTeam.attendance.fix.notePlaceholder')}
          rows={2}
          maxLength={NOTE_MAX}
          value={note}
          error={tried ? problems.note : undefined}
          onChange={(event) => setNote(event.target.value)}
        />

        {serverError && (
          <p className={styles.formError} role="alert">
            <Icon name="alert" size="xs" />
            {serverError}
          </p>
        )}

        {shift?.fixes && shift.fixes.length > 0 && (
          <section className={styles.history} aria-labelledby="fix-history">
            <h3 id="fix-history" className={styles.legend}>
              {t('adminTeam.attendance.fix.history')}
            </h3>
            <ol className={styles.historyList}>
              {[...shift.fixes].reverse().map((f) => (
                <li key={f.at}>
                  <span className={styles.historyWho}>
                    {t('adminTeam.attendance.fix.historyBy', {
                      date: clock.dateTime(f.at),
                      name: f.by ?? '–',
                    })}
                    {' · '}
                    {t(`adminTeam.attendance.fix.reasons.${f.reason}`)}
                  </span>
                  <span>
                    {f.before
                      ? t('adminTeam.attendance.fix.historyChange', {
                          before: times(f.before),
                          after: times(f.after),
                        })
                      : `${t('adminTeam.attendance.fix.historyAdded')} · ${times(f.after)}`}
                  </span>
                  {f.note && <span className={styles.historyNote}>{f.note}</span>}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </Dialog>
  );
}
