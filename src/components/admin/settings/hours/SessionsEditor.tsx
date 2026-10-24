'use client';

import { useContent } from '@/api/hooks';
import { Button, IconButton, Input, Tag } from '@/components/ui';
import { isCloseTime, isTime, sessionMinutes } from '@/lib/branchHours';
import { LIMITS } from '@/lib/branchSettings';
import { cx } from '@/lib/cx';
import { WEEKDAYS, type Session, type Weekday, type WeekSessions } from '@/types/branch';
import styles from './OpeningHoursEditor.module.css';

/** A session added to a day starts like this (staff set its times). */
const NEW_SESSION: Session = { opens: '19:00', closes: '23:00' };

/** A time input can't show "24:00" (the end of the day): it's midnight, "00:00", there. */
const asInput = (time: string) => (time === '24:00' ? '00:00' : time);

/** "next day" for a session past midnight, "all day" for one round the clock; else nothing. */
function spanOf(s: Session): 'nextDay' | 'allDay' | null {
  if (!isTime(s.opens) || !isCloseTime(s.closes)) return null;
  const { opens, closes } = sessionMinutes(s);
  if (closes - opens === 1440) return 'allDay';
  return closes > 1440 ? 'nextDay' : null;
}

/**
 * One day's sessions (or a special date's): each with an optional name, opening and closing
 * times ("next day" past midnight, "all day" round the clock) and a remove button, then Add
 * session (up to 4).
 */
export function SessionsEditor({
  sessions,
  onChange,
  idPrefix,
  dayName,
}: {
  sessions: Session[];
  onChange: (next: Session[]) => void;
  /** Unique per list on the page: input ids are built on it. */
  idPrefix: string;
  /** "Monday", for the remove buttons' names. */
  dayName: string;
}) {
  const t = useContent('common');
  const setSession = (index: number, next: Partial<Session>) =>
    onChange(sessions.map((s, i) => (i === index ? { ...s, ...next } : s)));
  return (
    <div className={styles.sessions}>
      <ul className={styles.sessionList}>
        {sessions.map((s, i) => {
          const n = i + 1;
          const span = spanOf(s);
          return (
            // Sessions have no id; their place in the day is theirs while editing.
            <li key={i} className={styles.session}>
              <Input
                id={`${idPrefix}-${i}-label`}
                label={t('adminSettings.hours.sessionLabel')}
                placeholder={t('adminSettings.hours.sessionPlaceholder')}
                value={s.label ?? ''}
                maxLength={LIMITS.sessionLabel}
                onChange={(event) => setSession(i, { label: event.target.value })}
              />
              <Input
                id={`${idPrefix}-${i}-opens`}
                type="time"
                step={300}
                label={t('adminSettings.hours.opens')}
                value={asInput(s.opens)}
                onChange={(event) => setSession(i, { opens: event.target.value })}
              />
              <Input
                id={`${idPrefix}-${i}-closes`}
                type="time"
                step={300}
                label={t('adminSettings.hours.closes')}
                hint={span ? t(`adminSettings.hours.${span}`) : undefined}
                value={asInput(s.closes)}
                onChange={(event) => setSession(i, { closes: event.target.value })}
              />
              <IconButton
                icon="trash"
                variant="soft"
                size="sm"
                className={styles.remove}
                label={t('adminSettings.hours.removeSession', { day: dayName, n })}
                onClick={() => onChange(sessions.filter((_, j) => j !== i))}
              />
            </li>
          );
        })}
      </ul>
      <Button
        variant="ghost"
        size="sm"
        iconStart="plus"
        className={styles.add}
        disabled={sessions.length >= LIMITS.sessionsPerDay}
        onClick={() => onChange([...sessions, { ...NEW_SESSION }])}
      >
        {t('adminSettings.hours.addSession')}
      </Button>
    </div>
  );
}

/**
 * A week of sessions: a row per day with an open/closed switch and its sessions. A day switched
 * open again starts with `opening()` (the first open day's sessions, say).
 */
export function WeekEditor({
  value,
  onChange,
  idPrefix,
  today,
  opening,
}: {
  value: WeekSessions;
  onChange: (next: WeekSessions) => void;
  idPrefix: string;
  /** The branch's day of the week now, tagged Today; null until known. */
  today: Weekday | null;
  opening: () => Session[];
}) {
  const t = useContent('common');
  const setDay = (day: Weekday, sessions: Session[]) => onChange({ ...value, [day]: sessions });
  return (
    <ul className={styles.days}>
      {WEEKDAYS.map((day) => {
        const sessions = value[day];
        const open = sessions.length > 0;
        const name = t(`adminSettings.hours.days.${day}`);
        return (
          <li key={day} className={cx(styles.day, !open && styles.closed)}>
            <div className={styles.dayName}>
              <span>{name}</span>
              {day === today && (
                <Tag variant="plain" icon={null}>
                  {t('adminSettings.hours.today')}
                </Tag>
              )}
            </div>
            <label className={styles.dayOpen}>
              <input
                type="checkbox"
                role="switch"
                className={styles.switch}
                checked={open}
                aria-label={t('adminSettings.hours.openOn', { day: name })}
                onChange={(event) => setDay(day, event.target.checked ? opening() : [])}
              />
              <span>{open ? t('adminSettings.hours.open') : t('adminSettings.hours.closed')}</span>
            </label>
            {open && (
              <SessionsEditor
                sessions={sessions}
                onChange={(next) => setDay(day, next)}
                idPrefix={`${idPrefix}-${day}`}
                dayName={name}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
