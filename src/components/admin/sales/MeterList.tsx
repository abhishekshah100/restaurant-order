import { cx } from '@/lib/cx';
import styles from './Sales.module.css';

export interface MeterRow {
  key: string;
  name: string;
  /** The figure the bar measures ("रू 3,10,000"). */
  valueText: string;
  /** Its share of the whole, 0–100. */
  share: number;
  /** A quieter line ("212 orders · 68%"). */
  detail: string;
  /** A note that needs attention ("रू 450 refunded"). */
  note?: string;
  /** Nothing in it (a part of the day without orders): drawn quieter. */
  quiet?: boolean;
}

/**
 * Parts of a whole, one row each, largest first: a name, its share as a bar on a track of the
 * same hue, the figure at the end. Rows read on their own, so nothing depends on colour.
 */
export function MeterList({
  rows,
  label,
  compact = false,
}: {
  rows: readonly MeterRow[];
  label: string;
  /** Tighter rows, for a list under a chart. */
  compact?: boolean;
}) {
  return (
    <ul className={cx(styles.meters, compact && styles.metersCompact)} aria-label={label}>
      {rows.map((row) => (
        <li key={row.key} className={cx(styles.meter, row.quiet && styles.meterQuiet)}>
          <div className={styles.meterTop}>
            <span className={styles.meterName}>{row.name}</span>
            <span className={styles.meterValue}>{row.valueText}</span>
          </div>
          <span className={styles.track} aria-hidden="true">
            <span
              className={cx(styles.fill, row.share === 0 && styles.fillZero)}
              style={{ width: `${Math.max(row.share, 0)}%` }}
            />
          </span>
          <div className={styles.meterBottom}>
            <span>{row.detail}</span>
            {row.note && <span className={styles.meterNote}>{row.note}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
