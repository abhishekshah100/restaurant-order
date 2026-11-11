'use client';

import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import { addDays, overnight, spanLabel } from '@/lib/rota';
import type { RotaShift } from '@/types/admin';
import styles from './HomePanels.module.css';

const weekday = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/**
 * Someone's week from the published rota, today and the 6 days after: each day its hours (and
 * note) or Off. The home's My rota card and the kitchen's shift dialog show it.
 */
export function MyRotaList({
  today,
  shifts,
  className,
  onSwap,
  swapping,
}: {
  today: string;
  shifts: readonly RotaShift[];
  className?: string;
  /** Ask a colleague to take a shift (today's and later ones). */
  onSwap?: (shift: RotaShift) => void;
  /** Shifts with a swap already asked for (no second one). */
  swapping?: ReadonlySet<string>;
}) {
  const t = useContent('common');
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const dayName = (day: string, i: number) =>
    i === 0
      ? t('adminHome.rota.today')
      : i === 1
        ? t('adminHome.rota.tomorrow')
        : weekday.format(new Date(`${day}T12:00:00Z`));

  return (
    <ul className={cx(styles.list, className)}>
      {days.map((day, i) => {
        const shift = shifts.find((s) => s.day === day);
        return (
          <li key={day} className={cx(styles.rotaRow, !shift && styles.rotaOff)}>
            <span className={styles.rotaDay}>{dayName(day, i)}</span>
            <span className={styles.rotaTime}>
              {shift ? spanLabel(shift.startsAt, shift.endsAt) : t('adminHome.rota.off')}
              {shift && overnight(shift.startsAt, shift.endsAt) && (
                <span className={styles.rotaNote}> · {t('adminSettings.rota.overnight')}</span>
              )}
            </span>
            {shift?.note && <span className={styles.rotaNote}>{shift.note}</span>}
            {shift?.swappedFrom && (
              <span className={styles.rotaNote}>
                {t('adminSettings.rota.swappedFrom', { name: shift.swappedFrom })}
              </span>
            )}
            {shift && onSwap && !swapping?.has(shift.id) && (
              <button
                type="button"
                className={styles.rotaSwap}
                aria-label={t('adminHome.rota.swapLabel', { day: dayName(day, i) })}
                onClick={() => onSwap(shift)}
              >
                {t('adminHome.rota.swap')}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
