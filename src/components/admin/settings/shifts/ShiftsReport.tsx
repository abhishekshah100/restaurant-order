'use client';

import { useRouter } from 'next/navigation';
import { useContent, useShifts } from '@/api/hooks';
import { Button, Icon, Tag } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { useQueryParam } from '@/hooks/useQueryParam';
import { settingsPath } from '@/lib/adminNav';
import { groupByDay, parseDayRange, shiftDay, type DayLimits, type DayRange } from '@/lib/dayRange';
import { downloadXlsx, toXlsx } from '@/lib/xlsx';
import type { ShiftRow } from '@/types/admin';
import { DateRangeFilter } from '../../DateRangeFilter';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { SettingsNote, SettingsSkeleton } from '../shared/SettingsEditor';
import editor from '../shared/SettingsEditor.module.css';
import styles from './ShiftsReport.module.css';

/** The server's limits: up to 93 days at a time, back a year. */
const SHIFT_LIMITS: DayLimits = { historyDays: 366, rangeDays: 93 };
const DEFAULT_DAYS = 7;
const PRESETS = [
  { days: 7, key: 'week' },
  { days: 30, key: 'month' },
  { days: 91, key: 'quarter' },
] as const;

interface PersonTotals {
  id: string;
  name: string;
  shifts: number;
  minutes: number;
  ordersTaken: number;
  collected: number;
  tips: number;
}

/** Each person's shifts on these days, added up, by most hours. */
export function totalsByPerson(shifts: readonly ShiftRow[]): PersonTotals[] {
  const people = new Map<string, PersonTotals>();
  for (const s of shifts) {
    const p = people.get(s.staff.id) ?? {
      id: s.staff.id,
      name: s.staff.name,
      shifts: 0,
      minutes: 0,
      ordersTaken: 0,
      collected: 0,
      tips: 0,
    };
    p.shifts += 1;
    p.minutes += s.minutes;
    p.ordersTaken += s.ordersTaken;
    p.collected += s.collected;
    p.tips += s.tips;
    people.set(p.id, p);
  }
  return [...people.values()].sort((a, b) => b.minutes - a.minutes);
}

/**
 * Settings › Team › Shifts (`reports.view`): who worked when on the days picked (the last week
 * without any, up to three months at a time), added up per person (shifts, hours, orders taken,
 * money collected, tips), then each shift by day, newest first, marked when it was closed for
 * the person (they forgot to clock out). Excel export of the shifts.
 */
export function ShiftsReport() {
  const t = useContent('common');
  const router = useRouter();
  const { branch, clock, money } = useAdminWorkspace();
  const now = useNow(60_000);
  const today = clock.dayKey(now ?? new Date());
  const fromParam = useQueryParam('from');
  const toParam = useQueryParam('to');
  const days: DayRange =
    fromParam || toParam
      ? parseDayRange(fromParam, toParam, today, SHIFT_LIMITS)
      : { from: shiftDay(today, -(DEFAULT_DAYS - 1)), to: today };
  const shifts = useShifts(branch.id, days);

  const hours = (minutes: number) =>
    minutes < 60
      ? t('adminSettings.shifts.minutes', { minutes })
      : t('adminSettings.shifts.hours', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
  const span = (s: ShiftRow) =>
    s.endedAt
      ? t('adminSettings.shifts.span', { from: clock.time(s.startedAt), to: clock.time(s.endedAt) })
      : t('adminSettings.shifts.onNow', { from: clock.time(s.startedAt) });

  const goTo = (range: DayRange) =>
    router.replace(`${settingsPath('shifts')}?from=${range.from}&to=${range.to}`, {
      scroll: false,
    });

  const exportAll = (rows: readonly ShiftRow[]) => {
    const c = (key: Parameters<typeof t>[0]) => t(key);
    const workbook = toXlsx(
      t('adminSettings.sections.shifts.title'),
      [...rows].reverse(),
      [
        c('adminSettings.shifts.columns.name'),
        c('adminSettings.shifts.columns.start'),
        c('adminSettings.shifts.columns.end'),
        c('adminSettings.shifts.columns.hours'),
        c('adminSettings.shifts.columns.orders'),
        c('adminSettings.shifts.columns.collected'),
        c('adminSettings.shifts.columns.tips'),
        c('adminSettings.shifts.columns.note'),
      ],
      (s: ShiftRow) => [
        s.staff.name,
        clock.dateTime(s.startedAt),
        s.endedAt ? clock.dateTime(s.endedAt) : '',
        Math.round((s.minutes / 60) * 100) / 100,
        s.ordersTaken,
        s.collected,
        s.tips,
        s.autoClosed ? t('adminSettings.shifts.autoClosed') : '',
      ],
    );
    downloadXlsx(
      workbook,
      t('adminSettings.shifts.exportFile', {
        branch: branch.id,
        date: days.from === days.to ? days.from : `${days.from}_${days.to}`,
      }),
    );
  };

  let content;
  if (shifts.data) {
    const rows = shifts.data.shifts;
    const people = totalsByPerson(rows);
    const byDay = groupByDay(rows, (s) => clock.dayKey(s.startedAt));
    content =
      rows.length === 0 ? (
        <SettingsNote tone="info">{t('adminSettings.shifts.empty')}</SettingsNote>
      ) : (
        <>
          <section className={editor.card} aria-labelledby="shift-people">
            <div className={styles.cardHead}>
              <h2 id="shift-people" className={styles.cardTitle}>
                {t('adminSettings.shifts.people')}
              </h2>
              <Button
                size="sm"
                variant="secondary"
                iconStart="list"
                onClick={() => exportAll(rows)}
              >
                {t('adminSettings.shifts.export')}
              </Button>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t('adminSettings.shifts.columns.name')}</th>
                    <th scope="col">{t('adminSettings.shifts.columns.shifts')}</th>
                    <th scope="col">{t('adminSettings.shifts.columns.hours')}</th>
                    <th scope="col">{t('adminSettings.shifts.columns.orders')}</th>
                    <th scope="col">{t('adminSettings.shifts.columns.collected')}</th>
                    <th scope="col">{t('adminSettings.shifts.columns.tips')}</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.id}>
                      <th scope="row">{p.name}</th>
                      <td>{p.shifts}</td>
                      <td>{hours(p.minutes)}</td>
                      <td>{p.ordersTaken}</td>
                      <td>{money.format(p.collected)}</td>
                      <td>{money.format(p.tips)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={editor.card} aria-labelledby="shift-days">
            <h2 id="shift-days" className={styles.cardTitle}>
              {t('adminSettings.shifts.byDay')}
            </h2>
            {byDay.map(({ day, items: ofDay }) => (
              <div key={day} className={styles.day}>
                <h3 className={styles.dayTitle}>{clock.date(`${day}T12:00:00Z`)}</h3>
                <ul className={styles.list}>
                  {ofDay.map((s) => (
                    <li key={s.id} className={styles.row}>
                      <span className={styles.who}>
                        <span className={styles.name}>{s.staff.name}</span>
                        <span className={styles.when}>
                          <Icon name="clock" size="xs" />
                          {span(s)} · {hours(s.minutes)}
                        </span>
                        {s.autoClosed && (
                          <Tag variant="warn" icon={null}>
                            {t('adminSettings.shifts.autoClosed')}
                          </Tag>
                        )}
                      </span>
                      <span className={styles.did}>
                        {t.plural('adminSettings.shifts.orders', s.ordersTaken)}
                        {' · '}
                        {money.format(s.collected)}
                        {s.tips > 0 &&
                          ` · ${t('adminSettings.shifts.tips', { amount: money.format(s.tips) })}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      );
  } else if (shifts.isError) {
    content = <SettingsNote tone="warn">{t('adminSettings.shifts.failed')}</SettingsNote>;
  } else {
    content = <SettingsSkeleton label={t('adminSettings.shifts.loading')} />;
  }

  return (
    <div className={editor.page}>
      <header className={editor.head}>
        <h1 className={editor.title}>{t('adminSettings.sections.shifts.title')}</h1>
        <p className={editor.subtitle}>{t('adminSettings.shifts.subtitle')}</p>
      </header>
      <DateRangeFilter
        id="shift-days"
        range={days}
        today={today}
        limits={SHIFT_LIMITS}
        presets={PRESETS.map((p) => ({
          days: p.days,
          label: t(`adminSettings.shifts.presets.${p.key}`),
        }))}
        onChange={goTo}
      />
      {content}
    </div>
  );
}
