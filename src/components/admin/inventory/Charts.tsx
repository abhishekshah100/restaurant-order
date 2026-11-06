'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useContent } from '@/api/hooks';
import styles from './Charts.module.css';

/*
 * The inventory dashboard's charts: one series each, in the brand's action colour. Thin marks,
 * recessive gridlines, a tooltip on hover (and arrow keys), and each chart's figures as a table
 * for screen readers and anyone who wants the numbers.
 */

/** The element's width as it lays out (0 until measured). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Up to `count` clean ticks from 0 (or the lowest value) to past the highest. */
function ticksFor(low: number, high: number, count = 3): number[] {
  const min = Math.min(0, low);
  const span = high - min || 1;
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * power >= raw) ?? 10) * power;
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v < high + step; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

const HEIGHT = 180;
const PAD = { top: 12, right: 16, bottom: 24, left: 56 };

/**
 * A value over days (an area under a 2px line), with the last value at its end and a crosshair
 * tooltip. `format` writes values ("₹12,400"), `day` writes a day key ("3 Nov").
 */
export function TrendChart({
  label,
  points,
  format,
  compact,
  day,
}: {
  label: string;
  points: { day: string; value: number }[];
  format: (n: number) => string;
  /** Axis ticks, short ("₹12K"). */
  compact: (n: number) => string;
  day: (key: string) => string;
}) {
  const t = useContent('common');
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const ticks = ticksFor(Math.min(...values), Math.max(...values));
  const low = ticks[0] ?? 0;
  const high = ticks[ticks.length - 1] ?? 1;
  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? 0 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - ((v - low) / (high - low || 1)) * plotH;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${y(low)} L${x(0)},${y(low)} Z`;
  const last = points.length - 1;
  const shown = active ?? null;
  const point = shown !== null ? points[shown] : undefined;

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const at = ((event.clientX - box.left - PAD.left) / plotW) * (points.length - 1);
    setActive(Math.min(Math.max(Math.round(at), 0), last));
  };

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>{label}</figcaption>
      <div ref={ref} className={styles.plot}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={t('adminInventory.dashboard.chartLabel', {
              label,
              from: format(points[0]?.value ?? 0),
              to: format(points[last]?.value ?? 0),
            })}
            tabIndex={0}
            className={styles.svg}
            onPointerMove={pick}
            onPointerLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') setActive((a) => Math.max((a ?? last) - 1, 0));
              else if (event.key === 'ArrowRight') setActive((a) => Math.min((a ?? -1) + 1, last));
              else if (event.key === 'Escape') setActive(null);
            }}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={PAD.left + plotW}
                  y1={y(tick)}
                  y2={y(tick)}
                  className={styles.grid}
                />
                <text x={PAD.left - 8} y={y(tick)} className={styles.tick} textAnchor="end">
                  {compact(tick)}
                </text>
              </g>
            ))}
            <text x={x(0)} y={HEIGHT - 6} className={styles.tick}>
              {day(points[0]?.day ?? '')}
            </text>
            <text x={x(last)} y={HEIGHT - 6} className={styles.tick} textAnchor="end">
              {day(points[last]?.day ?? '')}
            </text>
            <path d={area} className={styles.area} />
            <path d={line} className={styles.line} />
            {point && shown !== null && (
              <line
                x1={x(shown)}
                x2={x(shown)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                className={styles.crosshair}
              />
            )}
            <circle
              cx={x(shown ?? last)}
              cy={y((point ?? points[last])?.value ?? 0)}
              r={4}
              className={styles.dot}
            />
          </svg>
        )}
        {point && shown !== null && (
          <div
            className={styles.tooltip}
            style={{
              left: Math.min(Math.max(x(shown), 70), width - 70),
              top: Math.max(y(point.value) - 48, 0),
            }}
            aria-hidden="true"
          >
            <span className={styles.tooltipLabel}>{day(point.day)}</span>
            <strong>{format(point.value)}</strong>
          </div>
        )}
      </div>
      <p className={styles.endValue}>
        {t('adminInventory.dashboard.now', { value: format(points[last]?.value ?? 0) })}
      </p>
      <FigureTable caption={label} rows={points.map((p) => [day(p.day), format(p.value)])} />
    </figure>
  );
}

/**
 * Horizontal bars from one baseline: each row its name, a bar as long as its share of the
 * largest, and its value at the bar's tip. Bars only compare like with like (values, or counts).
 */
export function BarList({
  label,
  rows,
}: {
  label: string;
  rows: { key: string; name: string; amount: number; text: string; detail?: string }[];
}) {
  const largest = Math.max(...rows.map((r) => Math.abs(r.amount)), 0) || 1;
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>{label}</figcaption>
      <ul className={styles.bars}>
        {rows.map((row) => (
          <li
            key={row.key}
            className={styles.barRow}
            title={[row.name, row.text, row.detail].filter(Boolean).join(' · ')}
          >
            <span className={styles.barName}>{row.name}</span>
            <span className={styles.barTrack}>
              <span
                className={styles.bar}
                style={{ width: `${Math.max((Math.abs(row.amount) / largest) * 100, 1)}%` }}
              />
              <span className={styles.barValue}>{row.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** A chart's figures as a table, for screen readers (and on request). */
function FigureTable({ caption, rows }: { caption: string; rows: string[][] }) {
  const t = useContent('common');
  return (
    <details className={styles.table}>
      <summary>{t('adminInventory.dashboard.asTable')}</summary>
      <table>
        <caption className={styles.hidden}>{caption}</caption>
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={a}>
              <th scope="row">{a}</th>
              <td>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
