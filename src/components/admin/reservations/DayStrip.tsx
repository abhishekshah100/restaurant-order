import { useContent } from '@/api/hooks';
import { dayParts, type BookingDay } from '@/lib/reservations';
import styles from './DayStrip.module.css';

/**
 * The days to look at, today first, as tiles: Today / Tomorrow / the weekday, the date, and how
 * many bookings there are (none shows nothing). Scrolls sideways.
 */
export function DayStrip({
  days,
  value,
  counts,
  onChange,
}: {
  days: readonly BookingDay[];
  value: string;
  counts: Readonly<Record<string, number>>;
  onChange: (key: string) => void;
}) {
  const t = useContent('common');
  return (
    <div className={styles.strip} role="group" aria-label={t('adminReservations.days.label')}>
      {days.map((day) => {
        const parts = dayParts(day.key);
        const name =
          day.offset === 0
            ? t('adminReservations.days.today')
            : day.offset === 1
              ? t('adminReservations.days.tomorrow')
              : parts.weekday;
        const count = counts[day.key] ?? 0;
        return (
          <button
            key={day.key}
            type="button"
            className={styles.day}
            aria-pressed={value === day.key}
            aria-label={t('adminReservations.days.chip', {
              day: `${name} ${parts.day} ${parts.month}`,
              count: t.plural('adminReservations.count', count),
            })}
            onClick={() => onChange(day.key)}
          >
            <span className={styles.name} aria-hidden="true">
              {name}
            </span>
            <span className={styles.date} aria-hidden="true">
              {[parts.day, parts.month].join(' ')}
            </span>
            <span className={styles.count} aria-hidden="true" data-none={count === 0 || undefined}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
