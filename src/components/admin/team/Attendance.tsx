'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useContent, useShifts } from '@/api/hooks';
import { Button, Chip, EmptyState, Icon } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { useQueryParam } from '@/hooks/useQueryParam';
import { ADMIN_LINKS } from '@/lib/adminNav';
import {
  attendanceLines,
  needsAttention,
  outMissing,
  rotaInUse,
  statusesOf,
  totalsByPerson,
  type AttendanceLine,
  type AttendanceStatus,
} from '@/lib/attendance';
import { cx } from '@/lib/cx';
import { groupByDay, parseDayRange, shiftDay, type DayLimits, type DayRange } from '@/lib/dayRange';
import { mondayOf } from '@/lib/rota';
import { downloadXlsx, toXlsx } from '@/lib/xlsx';
import type { ShiftListResponse } from '@/types/admin';
import { DateRangeFilter } from '../DateRangeFilter';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { SettingsSkeleton } from '../settings/shared/SettingsEditor';
import { FixShiftDialog, type FixTarget } from './FixShiftDialog';
import { useDuration } from './useDuration';
import styles from './Attendance.module.css';

/** The server's limits: up to 93 days at a time, back a year. */
const LIMITS: DayLimits = { historyDays: 366, rangeDays: 93 };
const RANGES = ['today', 'week', 'lastWeek', 'month', 'custom'] as const;
type RangeId = (typeof RANGES)[number];

/** A status's colour. */
const TONE: Record<AttendanceStatus, 'ok' | 'warn' | 'err' | 'info' | 'plain'> = {
  working: 'info',
  outMissing: 'err',
  absent: 'err',
  expected: 'plain',
  late: 'warn',
  leftEarly: 'warn',
  extra: 'plain',
  unplanned: 'plain',
  onTime: 'ok',
};

/** The days a quick range covers, from today (the branch's). */
function daysOf(range: Exclude<RangeId, 'custom'>, today: string): DayRange {
  const monday = mondayOf(today);
  if (range === 'today') return { from: today, to: today };
  if (range === 'week') return { from: monday, to: today };
  if (range === 'lastWeek') return { from: shiftDay(monday, -7), to: shiftDay(monday, -1) };
  return { from: `${today.slice(0, 8)}01`, to: today };
}

/**
 * Team › Attendance (`reports.view`, `staff.manage` or `attendance.fix`): who came and when,
 * against the published rota. Today (working now, finished, late, absent, still to come) or a
 * week, last week, this month or days picked (planned against worked hours, by person). What
 * needs a look first (a shift out missing, someone absent); then every shift, one line each:
 * planned, in – out, hours, and one status word. With `attendance.fix`: Fix times on any shift
 * and Add a shift (someone forgot to shift in), each change kept and shown as Edited. Excel.
 */
export function Attendance() {
  const t = useContent('common');
  const router = useRouter();
  const { branch, clock, can } = useAdminWorkspace();
  const canFix = can('attendance.fix');
  const now = useNow(60_000);
  const today = clock.dayKey(now ?? new Date());
  const fromParam = useQueryParam('from');
  const toParam = useQueryParam('to');
  const rangeParam = useQueryParam('range');
  const custom = Boolean(fromParam || toParam);
  const range: RangeId = custom
    ? 'custom'
    : (RANGES.find((r) => r === rangeParam && r !== 'custom') ?? 'today');
  const days: DayRange =
    range === 'custom' ? parseDayRange(fromParam, toParam, today, LIMITS) : daysOf(range, today);
  const query = useShifts(branch.id, days);
  const [person, setPerson] = useState<string | null>(null);
  const [fixing, setFixing] = useState<FixTarget | null>(null);
  const [picking, setPicking] = useState(false);

  const go = (next: RangeId) => {
    setPerson(null);
    if (next === 'custom') {
      setPicking(true);
      return;
    }
    setPicking(false);
    router.replace(
      next === 'today' ? ADMIN_LINKS.attendance : `${ADMIN_LINKS.attendance}?range=${next}`,
      { scroll: false },
    );
  };
  const goDays = (next: DayRange) =>
    router.replace(`${ADMIN_LINKS.attendance}?from=${next.from}&to=${next.to}`, {
      scroll: false,
    });

  const span = useDuration();
  const plannedSpan = (p: { startsAt: string; endsAt: string }) =>
    t('adminTeam.attendance.span', { from: clock.time(p.startsAt), to: clock.time(p.endsAt) });

  const statusText = (status: AttendanceStatus, line: AttendanceLine) => {
    if (line.kind === 'expected') {
      return t('adminTeam.attendance.status.expected', {
        time: clock.time(line.planned.planned.startsAt),
      });
    }
    if (line.kind === 'worked') {
      const s = line.shift;
      if (status === 'late')
        return t('adminTeam.attendance.status.late', { time: span(s.lateMinutes ?? 0) });
      if (status === 'leftEarly') {
        return t('adminTeam.attendance.status.leftEarly', { time: span(s.leftEarlyMinutes ?? 0) });
      }
      if (status === 'extra')
        return t('adminTeam.attendance.status.extra', { time: span(s.extraMinutes ?? 0) });
    }
    return t(`adminTeam.attendance.status.${status}`);
  };

  const exportAll = (data: ShiftListResponse) => {
    const c = (key: Parameters<typeof t>[0]) => t(key);
    const lines = [...attendanceLines(data)].reverse().filter((l) => l.kind !== 'expected');
    const inUse = rotaInUse(data);
    const at = new Date();
    const workbook = toXlsx(
      t('adminTeam.tabs.attendance'),
      lines,
      [
        c('adminSettings.shifts.columns.name'),
        c('adminSettings.shifts.columns.plannedStart'),
        c('adminSettings.shifts.columns.plannedEnd'),
        c('adminSettings.shifts.columns.start'),
        c('adminSettings.shifts.columns.end'),
        c('adminSettings.shifts.columns.hours'),
        c('adminTeam.attendance.columns.status'),
        c('adminSettings.shifts.columns.lateMinutes'),
        c('adminSettings.shifts.columns.earlyMinutes'),
        c('adminSettings.shifts.columns.extraMinutes'),
        c('adminSettings.shifts.columns.orders'),
        c('adminSettings.shifts.columns.collected'),
        c('adminSettings.shifts.columns.tips'),
        c('adminTeam.attendance.columns.fixed'),
      ],
      (l: AttendanceLine) => {
        const status = statusesOf(l, at, inUse)
          .map((st) => statusText(st, l))
          .join(', ');
        if (l.kind !== 'worked') {
          const p = l.kind === 'absent' ? l.missed.planned : l.planned.planned;
          return [
            l.name,
            clock.dateTime(p.startsAt),
            clock.dateTime(p.endsAt),
            '',
            '',
            0,
            status,
            '',
            '',
            '',
            0,
            0,
            0,
            '',
          ];
        }
        const s = l.shift;
        const last = s.fixes?.at(-1);
        return [
          s.staff.name,
          s.planned ? clock.dateTime(s.planned.startsAt) : '',
          s.planned ? clock.dateTime(s.planned.endsAt) : '',
          clock.dateTime(s.startedAt),
          s.endedAt ? clock.dateTime(s.endedAt) : '',
          Math.round((s.minutes / 60) * 100) / 100,
          status,
          s.lateMinutes ?? '',
          s.leftEarlyMinutes ?? '',
          s.extraMinutes ?? '',
          s.ordersTaken,
          s.collected,
          s.tips,
          last
            ? `${t(`adminTeam.attendance.fix.reasons.${last.reason}`)} · ${last.by ?? ''} · ${clock.dateTime(last.at)}`
            : '',
        ];
      },
    );
    downloadXlsx(
      workbook,
      t('adminTeam.attendance.exportFile', {
        branch: branch.id,
        date: days.from === days.to ? days.from : `${days.from}_${days.to}`,
      }),
    );
  };

  /** One line: who, planned, in – out, hours, status, and Fix times / Add shift. */
  const row = (line: AttendanceLine, data: ShiftListResponse, inUse: boolean) => {
    const at = now ?? new Date();
    const statuses = statusesOf(line, at, inUse);
    const role = data.people?.find((p) => p.id === line.staffId)?.role;
    let planned: string | null = null;
    let times: string | null = null;
    let hours: string | null = null;
    let action: FixTarget | null = null;
    let edited: string | null = null;
    if (line.kind === 'worked') {
      const s = line.shift;
      planned = s.planned ? plannedSpan(s.planned) : null;
      const missing = outMissing(s, at);
      times = s.endedAt
        ? t('adminTeam.attendance.span', {
            from: clock.time(s.startedAt),
            to: missing ? '?' : clock.time(s.endedAt),
          })
        : t('adminTeam.attendance.inOnly', { from: clock.time(s.startedAt) });
      if (s.endedAt && !missing && clock.dayKey(s.endedAt) !== clock.dayKey(s.startedAt)) {
        times = `${times} (${t('adminTeam.attendance.nextDay')})`;
      }
      hours = missing ? '–' : span(s.minutes);
      action = { kind: 'fix', shift: s };
      const last = s.fixes?.at(-1);
      if (last) {
        edited = last.by
          ? t('adminTeam.attendance.editedBy', { name: last.by })
          : t('adminTeam.attendance.edited');
      }
    } else if (line.kind === 'absent') {
      planned = plannedSpan(line.missed.planned);
      action = { kind: 'add', staffId: line.staffId, planned: line.missed.planned };
    } else {
      planned = plannedSpan(line.planned.planned);
    }
    const main = statuses[0];
    return (
      <li key={line.key} className={cx(styles.row, main && styles[`row_${TONE[main]}`])}>
        <span className={styles.who}>
          <span className={styles.name}>{line.name}</span>
          {role && <span className={styles.role}>{role}</span>}
        </span>
        <span className={styles.cellPlanned}>
          <span className={styles.cellLabel}>{t('adminTeam.attendance.list.columns.planned')}</span>
          {planned ?? <span className={styles.muted}>{t('adminTeam.attendance.notPlanned')}</span>}
        </span>
        <span className={styles.cellTimes}>
          <span className={styles.cellLabel}>{t('adminTeam.attendance.list.columns.times')}</span>
          {times ?? '–'}
        </span>
        <span className={styles.cellHours}>
          <span className={styles.cellLabel}>{t('adminTeam.attendance.list.columns.hours')}</span>
          {hours ?? '–'}
        </span>
        <span className={styles.statuses}>
          {statuses.map((st) => (
            <span key={st} className={styles.status} data-tone={TONE[st]}>
              {statusText(st, line)}
            </span>
          ))}
          {edited && (
            <span className={styles.edited} title={edited}>
              <Icon name="pencil" size="xs" />
              {t('adminTeam.attendance.edited')}
            </span>
          )}
        </span>
        <span className={styles.action}>
          {canFix && action && (
            <Button
              size="sm"
              variant={main === 'outMissing' || main === 'absent' ? 'primary' : 'secondary'}
              iconStart={action.kind === 'fix' ? 'pencil' : 'plus'}
              onClick={() => setFixing(action)}
            >
              {action.kind === 'fix'
                ? t('adminTeam.attendance.fixTimes')
                : t('adminTeam.attendance.addShift')}
            </Button>
          )}
        </span>
      </li>
    );
  };

  let content;
  if (query.data) {
    const data = query.data;
    const at = now ?? new Date();
    const inUse = rotaInUse(data);
    const all = attendanceLines(data);
    const lines = person ? all.filter((l) => l.staffId === person) : all;
    const attention = needsAttention(all, at);
    const worked = data.shifts;
    const totals = totalsByPerson(worked, data.missed ?? []);
    const personName = person ? all.find((l) => l.staffId === person)?.name : null;

    const kpis =
      range === 'today'
        ? [
            {
              key: 'working',
              value: worked.filter((s) => !s.endedAt && !outMissing(s, at)).length,
              tone: 'info',
            },
            { key: 'done', value: worked.filter((s) => s.endedAt).length },
            { key: 'late', value: worked.filter((s) => s.lateMinutes).length, tone: 'warn' },
            { key: 'absent', value: data.missed?.length ?? 0, tone: 'err' },
            ...(inUse ? [{ key: 'expected', value: data.expected?.length ?? 0 }] : []),
          ]
        : [
            ...(inUse
              ? [{ key: 'planned', value: span(totals.reduce((m, p) => m + p.plannedMinutes, 0)) }]
              : []),
            { key: 'worked', value: span(totals.reduce((m, p) => m + p.minutes, 0)) },
            { key: 'late', value: worked.filter((s) => s.lateMinutes).length, tone: 'warn' },
            { key: 'absent', value: data.missed?.length ?? 0, tone: 'err' },
          ];

    const byDay = groupByDay(lines, (l) => clock.dayKey(l.at));
    content =
      all.length === 0 ? (
        <EmptyState icon="clock" tone="neutral" title={t('adminTeam.attendance.empty.title')}>
          {t('adminTeam.attendance.empty.body')}
        </EmptyState>
      ) : (
        <>
          <dl className={styles.kpis} aria-label={t('adminTeam.attendance.kpi.label')}>
            {kpis.map((k) => (
              <div
                key={k.key}
                className={styles.kpi}
                data-tone={typeof k.value === 'number' && k.value > 0 ? k.tone : undefined}
              >
                <dt>{t(`adminTeam.attendance.kpi.${k.key as 'working'}`)}</dt>
                <dd>{k.value}</dd>
              </div>
            ))}
          </dl>

          {attention.length > 0 && (
            <section className={styles.attention} aria-labelledby="attendance-attention">
              <h2 id="attendance-attention" className={styles.attentionTitle}>
                <Icon name="alert" size="sm" />
                {t('adminTeam.attendance.attention.title')}
                <span className={styles.count}>{attention.length}</span>
              </h2>
              <ul className={styles.attentionList}>
                {attention.map((l) => (
                  <li key={l.key} className={styles.attentionRow}>
                    <span className={styles.attentionText}>
                      <strong>{l.name}</strong>
                      <span>
                        {l.kind === 'worked'
                          ? l.shift.autoClosed && l.shift.endedAt
                            ? t('adminTeam.attendance.attention.auto', {
                                time: clock.dateTime(l.shift.endedAt),
                              })
                            : t('adminTeam.attendance.attention.long', {
                                time: clock.dateTime(l.shift.startedAt),
                              })
                          : l.kind === 'absent'
                            ? `${clock.date(l.missed.planned.startsAt)} · ${t(
                                'adminTeam.attendance.attention.absent',
                                {
                                  from: clock.time(l.missed.planned.startsAt),
                                  to: clock.time(l.missed.planned.endsAt),
                                },
                              )}`
                            : ''}
                      </span>
                    </span>
                    {canFix && (
                      <Button
                        size="sm"
                        iconStart={l.kind === 'worked' ? 'pencil' : 'plus'}
                        onClick={() =>
                          setFixing(
                            l.kind === 'worked'
                              ? { kind: 'fix', shift: l.shift }
                              : l.kind === 'absent'
                                ? { kind: 'add', staffId: l.staffId, planned: l.missed.planned }
                                : { kind: 'add' },
                          )
                        }
                      >
                        {l.kind === 'worked'
                          ? t('adminTeam.attendance.fixTimes')
                          : t('adminTeam.attendance.addShift')}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {range !== 'today' && totals.length > 0 && (
            <section className={styles.card} aria-labelledby="attendance-people">
              <div className={styles.cardHead}>
                <h2 id="attendance-people" className={styles.cardTitle}>
                  {t('adminTeam.attendance.people.title')}
                </h2>
                <p className={styles.cardHint}>{t('adminTeam.attendance.people.hint')}</p>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{t('adminTeam.attendance.people.name')}</th>
                      <th scope="col">{t('adminTeam.attendance.people.shifts')}</th>
                      {inUse && <th scope="col">{t('adminTeam.attendance.people.planned')}</th>}
                      <th scope="col">{t('adminTeam.attendance.people.worked')}</th>
                      <th scope="col">{t('adminTeam.attendance.people.late')}</th>
                      <th scope="col">{t('adminTeam.attendance.people.absent')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.map((p) => (
                      <tr key={p.id} data-picked={person === p.id || undefined}>
                        <th scope="row">
                          <button
                            type="button"
                            className={styles.personLink}
                            aria-pressed={person === p.id}
                            onClick={() => setPerson(person === p.id ? null : p.id)}
                          >
                            {p.name}
                          </button>
                        </th>
                        <td>{p.shifts}</td>
                        {inUse && <td>{p.plannedMinutes > 0 ? span(p.plannedMinutes) : '–'}</td>}
                        <td>{span(p.minutes)}</td>
                        <td className={p.late > 0 ? styles.warn : undefined}>{p.late}</td>
                        <td className={p.missed > 0 ? styles.err : undefined}>{p.missed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className={styles.card} aria-labelledby="attendance-list">
            <div className={styles.cardHead}>
              <h2 id="attendance-list" className={styles.cardTitle}>
                {t('adminTeam.attendance.list.title')}
              </h2>
              {personName && (
                <Chip pressed onClick={() => setPerson(null)}>
                  {t('adminTeam.attendance.people.showing', { name: personName })}
                  {' ×'}
                </Chip>
              )}
            </div>
            <div className={styles.listHead} aria-hidden="true">
              <span>{t('adminTeam.attendance.list.columns.person')}</span>
              <span>{t('adminTeam.attendance.list.columns.planned')}</span>
              <span>{t('adminTeam.attendance.list.columns.times')}</span>
              <span>{t('adminTeam.attendance.list.columns.hours')}</span>
              <span>{t('adminTeam.attendance.list.columns.status')}</span>
              <span />
            </div>
            {byDay.map(({ day, items }) => (
              <div key={day} className={styles.day}>
                {range !== 'today' && (
                  <h3 className={styles.dayTitle}>{clock.date(`${day}T12:00:00Z`)}</h3>
                )}
                <ul className={styles.list}>{items.map((l) => row(l, data, inUse))}</ul>
              </div>
            ))}
          </section>
        </>
      );
  } else if (query.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminTeam.attendance.failed')}
        actions={
          <Button iconStart="refresh" onClick={() => void query.refetch()}>
            {t('adminTeam.attendance.retry')}
          </Button>
        }
      />
    );
  } else {
    content = <SettingsSkeleton label={t('adminTeam.attendance.loading')} />;
  }

  return (
    <div className={styles.page}>
      <p className={styles.lead}>
        {canFix ? t('adminTeam.attendance.leadFix') : t('adminTeam.attendance.lead')}
      </p>
      <div className={styles.toolbar}>
        <div
          className={styles.ranges}
          role="group"
          aria-label={t('adminTeam.attendance.ranges.label')}
        >
          {RANGES.map((r) => (
            <Chip
              key={r}
              pressed={range === r || (r === 'custom' && picking && range !== 'custom')}
              onClick={() => go(r)}
            >
              {t(`adminTeam.attendance.ranges.${r}`)}
            </Chip>
          ))}
        </div>
        <div className={styles.tools}>
          {query.data && (
            <Button
              size="sm"
              variant="secondary"
              iconStart="list"
              onClick={() => query.data && exportAll(query.data)}
            >
              {t('adminTeam.attendance.export')}
            </Button>
          )}
          {canFix && (
            <Button size="sm" iconStart="plus" onClick={() => setFixing({ kind: 'add' })}>
              {t('adminTeam.attendance.add')}
            </Button>
          )}
        </div>
      </div>
      {(range === 'custom' || picking) && (
        <DateRangeFilter
          id="attendance-days"
          range={days}
          today={today}
          limits={LIMITS}
          onChange={goDays}
        />
      )}
      {content}
      {fixing && (
        <FixShiftDialog
          target={fixing}
          people={query.data?.people ?? []}
          onClose={() => setFixing(null)}
        />
      )}
    </div>
  );
}
