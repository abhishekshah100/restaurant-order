import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import { dayParts, type BookingDay } from '@/lib/reservations';
import { DayCalendar } from './DayCalendar';
import styles from './DayStrip.module.css';

/**
 * The days to pick from, today first, as tiles: Today / Tomorrow / the weekday and the date,
 * with how many bookings there are when `counts` is given (none shows nothing). After them a
 * calendar button opens a month to pick any day from `range` (a day picked there gets a tile of
 * its own; Esc or a press elsewhere closes it). `compact` is the booking form's smaller size.
 */
export function DayStrip({
  days,
  value,
  range,
  counts,
  label,
  compact,
  onChange,
}: {
  days: readonly BookingDay[];
  value: string;
  range: { min: string; max: string };
  counts?: Readonly<Record<string, number>>;
  label: string;
  compact?: boolean;
  onChange: (key: string) => void;
}) {
  const t = useContent('common');
  const calendarId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const picker = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    toggle.current?.focus();
  }, []);

  // A press anywhere else closes the calendar (focus stays where the press put it).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!picker.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={picker} className={cx(styles.picker, compact && styles.compact)}>
      <div className={styles.strip} role="group" aria-label={label}>
        {days.map((day) => {
          const parts = dayParts(day.key);
          const name =
            day.offset === 0
              ? t('adminReservations.days.today')
              : day.offset === 1
                ? t('adminReservations.days.tomorrow')
                : parts.weekday;
          const date = `${name} ${parts.day} ${parts.month}`;
          const count = counts?.[day.key] ?? 0;
          return (
            <button
              key={day.key}
              type="button"
              className={styles.day}
              aria-pressed={value === day.key}
              aria-label={
                counts
                  ? t('adminReservations.days.chip', {
                      day: date,
                      count: t.plural('adminReservations.count', count),
                    })
                  : date
              }
              onClick={() => onChange(day.key)}
            >
              <span className={styles.name} aria-hidden="true">
                {name}
              </span>
              <span className={styles.date} aria-hidden="true">
                {[parts.day, parts.month].join(' ')}
              </span>
              {counts && (
                <span
                  className={styles.count}
                  aria-hidden="true"
                  data-none={count === 0 || undefined}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
        <button
          ref={toggle}
          type="button"
          className={cx(styles.day, styles.pick)}
          aria-label={t('adminReservations.days.pickDate')}
          aria-expanded={open}
          aria-controls={open ? calendarId : undefined}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="calendar" size="sm" />
        </button>
      </div>
      {open && (
        <DayCalendar
          id={calendarId}
          className={styles.popover}
          value={value}
          min={range.min}
          max={range.max}
          counts={counts}
          onClose={close}
          onPick={(key) => {
            onChange(key);
            close();
          }}
        />
      )}
    </div>
  );
}
