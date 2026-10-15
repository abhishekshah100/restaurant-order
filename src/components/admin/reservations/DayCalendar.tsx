import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useContent } from '@/api/hooks';
import { IconButton } from '@/components/ui';
import { cx } from '@/lib/cx';
import { addDays, addMonths, dayParts, monthName, monthWeeks } from '@/lib/reservations';
import styles from './DayCalendar.module.css';

/** Sunday to Saturday, as the calendar's column heads ("Su"…"Sa" read as "Sunday"…). */
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => {
  const at = new Date(Date.UTC(2023, 0, 1 + i, 12)); // 1 Jan 2023 was a Sunday
  const name = (weekday: 'short' | 'long') =>
    new Intl.DateTimeFormat('en-US', { weekday, timeZone: 'UTC' }).format(at);
  return { short: name('short').slice(0, 2), long: name('long') };
});

const KEY_STEPS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/**
 * A month of days to pick one from, between `min` and `max` (calendar days, "2026-10-17"). Opens
 * on the picked day's month with focus on it; the arrow keys move a day or a week, Page Up/Down
 * a month, Enter picks, Esc closes (without closing a dialog it's in). `counts` puts a dot on
 * days with bookings.
 */
export function DayCalendar({
  id,
  className,
  value,
  min,
  max,
  counts,
  onPick,
  onClose,
}: {
  id: string;
  className?: string;
  value: string;
  min: string;
  max: string;
  counts?: Readonly<Record<string, number>>;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const ref = useRef<HTMLDivElement>(null);
  const clamp = (key: string) => (key < min ? min : key > max ? max : key);
  const [focused, setFocused] = useState(() => clamp(value));
  const [month, setMonth] = useState(() => focused.slice(0, 7));
  // Focus follows the keyboard (and goes to the picked day on open), not a click on the arrows.
  const moveFocus = useRef(true);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    ref.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus();
  }, [focused]);

  // Esc closes the calendar only: stopped here, before a dialog's listener on the document.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    root.addEventListener('keydown', onKeyDown);
    return () => root.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const go = (key: string) => {
    const next = clamp(key);
    moveFocus.current = true;
    setFocused(next);
    setMonth(next.slice(0, 7));
  };

  const onGridKeyDown = (event: KeyboardEvent) => {
    const step = KEY_STEPS[event.key];
    if (step !== undefined) go(addDays(focused, step));
    else if (event.key === 'PageUp') go(`${addMonths(focused.slice(0, 7), -1)}${focused.slice(7)}`);
    else if (event.key === 'PageDown')
      go(`${addMonths(focused.slice(0, 7), 1)}${focused.slice(7)}`);
    else return;
    event.preventDefault();
  };

  const weeks = monthWeeks(month);
  const inRange = (key: string) => key >= min && key <= max;
  // One day in the grid takes Tab: the focused one, else the month's first that can be picked.
  const tabStop = focused.startsWith(month)
    ? focused
    : (weeks.flat().find((key): key is string => key !== null && inRange(key)) ?? '');
  const title = `${id}-title`;

  return (
    <div ref={ref} id={id} className={cx(styles.calendar, className)}>
      <div className={styles.head}>
        <IconButton
          icon="chev"
          className={styles.previous}
          size="sm"
          label={t('adminReservations.days.previousMonth')}
          disabled={month <= min.slice(0, 7)}
          onClick={() => setMonth(addMonths(month, -1))}
        />
        <h4 id={title} className={styles.month} aria-live="polite">
          {monthName(month)}
        </h4>
        <IconButton
          icon="chev"
          size="sm"
          label={t('adminReservations.days.nextMonth')}
          disabled={month >= max.slice(0, 7)}
          onClick={() => setMonth(addMonths(month, 1))}
        />
      </div>
      <table className={styles.grid} role="grid" aria-labelledby={title} onKeyDown={onGridKeyDown}>
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d.long} scope="col" abbr={d.long}>
                {d.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((key, i) => {
                if (!key) return <td key={i} />;
                const parts = dayParts(key);
                const count = counts?.[key] ?? 0;
                const label = `${parts.weekday} ${parts.day} ${parts.month}`;
                return (
                  <td key={key}>
                    <button
                      type="button"
                      data-day={key}
                      className={cx(styles.day, key === min && styles.today)}
                      tabIndex={key === tabStop ? 0 : -1}
                      disabled={!inRange(key)}
                      aria-pressed={key === value}
                      aria-current={key === min ? 'date' : undefined}
                      aria-label={
                        counts
                          ? t('adminReservations.days.chip', {
                              day: label,
                              count: t.plural('adminReservations.count', count),
                            })
                          : label
                      }
                      onFocus={() => setFocused(key)}
                      onClick={() => onPick(key)}
                    >
                      {parts.day}
                      {count > 0 && <span className={styles.dot} aria-hidden="true" />}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
