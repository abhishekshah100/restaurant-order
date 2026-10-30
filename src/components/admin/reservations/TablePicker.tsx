import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import type { TableChoice } from '@/lib/reservations';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './TablePicker.module.css';

/**
 * The tables by area, each with its seats, tapped on and off: a party can have several (eight
 * guests on two tables of four). One booked then can't be picked (it says until when), and the
 * tables suggested are marked Best fit. Disabled
 * until there's a time.
 */
export function TablePicker({
  areas,
  value,
  onToggle,
  disabled,
  error,
}: {
  areas: { id: string; name: string; tables: TableChoice[] }[];
  /** The tables picked. */
  value: readonly number[];
  /** A table tapped (on or off), in its area. */
  onToggle: (table: number, areaId: string) => void;
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
              // On the tile the time only (it's on the day picked above), kept on one line;
              // read out in full.
              const booked = choice.clash
                ? t('adminReservations.editor.booked', {
                    time: clock.time(choice.clash.at).replace(' ', '\u00a0'),
                  })
                : null;
              const bookedFull = choice.clash
                ? t('adminReservations.editor.booked', { time: clock.dateTime(choice.clash.at) })
                : null;
              const seats = t('adminReservations.editor.seats', { count: choice.seats });
              const inUse = !booked && choice.inUse ? t('adminReservations.editor.inUse') : null;
              const words = [
                t('adminReservations.table', { table: choice.table }),
                seats,
                ...(bookedFull ? [bookedFull] : []),
                ...(inUse ? [inUse] : []),
                ...(choice.bestFit ? [t('adminReservations.editor.bestFit')] : []),
              ];
              return (
                <li key={choice.table}>
                  <button
                    type="button"
                    className={cx(styles.table, choice.bestFit && styles.best)}
                    aria-pressed={value.includes(choice.table)}
                    aria-label={words.join(', ')}
                    disabled={disabled || Boolean(choice.clash)}
                    onClick={() => onToggle(choice.table, area.id)}
                  >
                    <span className={styles.number} aria-hidden="true">
                      {choice.table}
                    </span>
                    <span className={styles.seats} aria-hidden="true">
                      {seats}
                    </span>
                    {(booked || inUse || choice.bestFit) && (
                      <span className={styles.tag} aria-hidden="true">
                        {booked ?? inUse ?? t('adminReservations.editor.bestFit')}
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
