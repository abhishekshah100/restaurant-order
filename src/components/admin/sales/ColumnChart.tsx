'use client';

import { useState } from 'react';
import { cx } from '@/lib/cx';
import { niceTicks } from '@/lib/salesReport';
import styles from './Sales.module.css';

/** One column: its value, what the axis says under it, and what its tooltip says. */
export interface Column {
  key: string;
  value: number;
  /** Under the column (empty to leave it out where the axis is crowded). */
  axis: string;
  /** The tooltip's first line ("Sat 15 Nov · 3 Mangsir"). */
  title: string;
  /** The value as read ("रू 48,200"). */
  valueText: string;
  /** A quieter line under it ("32 orders"). */
  detail?: string;
  /** Drawn in the accent; the rest recede. */
  highlight?: boolean;
}

/**
 * A column chart in the report's style: thin columns rounded at the top, square on the baseline,
 * a recessive grid with clean ticks, and an optional average line. Each column is a button (a
 * tooltip on hover and focus; tapping it opens it when `onPick` is given), and a table carries
 * every value for screen readers.
 */
export function ColumnChart({
  columns,
  caption,
  tableHeads,
  formatTick,
  average,
  onPick,
  pickLabel,
  height = 200,
  emphasis = false,
}: {
  columns: readonly Column[];
  /** What the chart shows (the table's caption). */
  caption: string;
  /** The table's column heads: [when, value, detail]. */
  tableHeads: readonly [string, string, string?];
  formatTick: (value: number) => string;
  /** A line across at this value (its key is the page's: see AverageKey). */
  average?: { value: number };
  onPick?: (key: string) => void;
  /** "Show Sat 15 Nov on its own": the button's action, for screen readers. */
  pickLabel?: (column: Column) => string;
  height?: number;
  /** Only highlighted columns in the accent (the rest a quiet tint); else all are. */
  emphasis?: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(0, ...columns.map((c) => c.value), average?.value ?? 0);
  const ticks = niceTicks(max);
  const top = ticks.at(-1) ?? 1;
  const at = (value: number) => `${(value / top) * 100}%`;
  const shown = columns.find((c) => c.key === active);
  const index = shown ? columns.indexOf(shown) : -1;

  return (
    <div className={styles.chart}>
      <div className={styles.plot} style={{ height }} onPointerLeave={() => setActive(null)}>
        <div className={styles.ticks} aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} className={styles.tick} style={{ bottom: at(tick) }}>
              <span className={styles.tickLabel}>{formatTick(tick)}</span>
            </span>
          ))}
        </div>
        {average && average.value > 0 && (
          <div
            className={styles.average}
            style={{ bottom: at(average.value) }}
            aria-hidden="true"
          />
        )}
        <div className={styles.columns}>
          {columns.map((c) => (
            <button
              key={c.key}
              type="button"
              className={cx(
                styles.slot,
                onPick ? styles.pickable : undefined,
                active === c.key && styles.on,
              )}
              aria-label={
                onPick && pickLabel
                  ? `${c.title}: ${c.valueText}${c.detail ? `, ${c.detail}` : ''}. ${pickLabel(c)}`
                  : `${c.title}: ${c.valueText}${c.detail ? `, ${c.detail}` : ''}`
              }
              tabIndex={onPick ? 0 : -1}
              onPointerEnter={() => setActive(c.key)}
              onFocus={() => setActive(c.key)}
              onBlur={() => setActive(null)}
              onClick={onPick ? () => onPick(c.key) : () => setActive(c.key)}
            >
              <span
                className={cx(
                  styles.bar,
                  emphasis && !c.highlight && styles.barQuiet,
                  c.value === 0 && styles.barZero,
                )}
                style={{ height: c.value > 0 ? at(c.value) : undefined }}
              />
            </button>
          ))}
        </div>
        {shown && (
          <div
            className={styles.tooltip}
            style={{
              left: `${((index + 0.5) / columns.length) * 100}%`,
              bottom: `calc(${at(shown.value)} + 10px)`,
              // Near an edge it leans inward, so it never leaves the card.
              transform: `translateX(${edgeShift((index + 0.5) / columns.length)})`,
            }}
            role="status"
          >
            <span className={styles.tipValue}>{shown.valueText}</span>
            <span className={styles.tipTitle}>{shown.title}</span>
            {shown.detail && <span className={styles.tipDetail}>{shown.detail}</span>}
          </div>
        )}
      </div>
      <div className={styles.axis} aria-hidden="true">
        {columns.map((c) => (
          <span key={c.key} className={styles.axisLabel}>
            {c.axis}
          </span>
        ))}
      </div>
      <table className="visually-hidden">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{tableHeads[0]}</th>
            <th scope="col">{tableHeads[1]}</th>
            {tableHeads[2] && <th scope="col">{tableHeads[2]}</th>}
          </tr>
        </thead>
        <tbody>
          {columns.map((c) => (
            <tr key={c.key}>
              <th scope="row">{c.title}</th>
              <td>{c.valueText}</td>
              {tableHeads[2] && <td>{c.detail}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** How far left of its column the tooltip sits: centred, leaning in near either edge. */
const edgeShift = (position: number) =>
  position < 0.15 ? '-15%' : position > 0.85 ? '-85%' : '-50%';

/** The average line's key, for under a chart's title: "— Average रू 21.4K a day". */
export function AverageKey({ label }: { label: string }) {
  return (
    <p className={styles.key}>
      <span className={styles.keyLine} aria-hidden="true" />
      {label}
    </p>
  );
}
