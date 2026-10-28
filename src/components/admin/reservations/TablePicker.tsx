import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import type { TableChoice } from '@/lib/reservations';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './TablePicker.module.css';

/**
 * The tables by area, each with its seats: one booked then can't be picked (it says until
 * when), one too small for the party is faded (still allowed: tables get pushed together), and
 * the smallest free table that fits is marked Best fit. Disabled until there's a time.
 */
export function TablePicker({
  areas,
  value,
  onChange,
  disabled,
  error,
}: {
  areas: { id: string; name: string; tables: TableChoice[] }[];
  value: number | null;
  onChange: (table: number) => void;
  disabled: boolean;
  error?: string;
}) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();

  return (
    <div className={styles.picker} role="group" aria-labelledby="table-picker-label">
      {areas.map((area) => (
        <div key={area.id} className={styles.area}>
          <p className={styles.areaName}>{area.name}</p>
          <ul className={styles.grid}>
            {area.tables.map((choice) => {
              const booked = choice.clash
                ? t('adminReservations.editor.booked', { time: clock.dateTime(choice.clash.at) })
                : null;
              const seats = t('adminReservations.editor.seats', { count: choice.seats });
              const words = [
                t('adminReservations.table', { table: choice.table }),
                seats,
                ...(booked ? [booked] : []),
                ...(choice.bestFit ? [t('adminReservations.editor.bestFit')] : []),
              ];
              return (
                <li key={choice.table}>
                  <button
                    type="button"
                    className={cx(
                      styles.table,
                      choice.tooSmall && styles.small,
                      choice.bestFit && styles.best,
                    )}
                    aria-pressed={value === choice.table}
                    aria-label={words.join(', ')}
                    disabled={disabled || Boolean(choice.clash)}
                    onClick={() => onChange(choice.table)}
                  >
                    <span className={styles.number} aria-hidden="true">
                      {choice.table}
                    </span>
                    <span className={styles.seats} aria-hidden="true">
                      {seats}
                    </span>
                    {(booked || choice.bestFit) && (
                      <span className={styles.tag} aria-hidden="true">
                        {booked ?? t('adminReservations.editor.bestFit')}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
