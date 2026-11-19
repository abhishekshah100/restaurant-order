import type { SalesDay, SalesHour } from '@/api/contracts';
import { shiftDay, type DayRange } from './dayRange';

/*
 * Sales (the manager's report): the ranges it offers, how a figure changed against the span
 * before, and the days and hours shaped for its charts. Pure, so the page stays simple.
 */

/** How far back the report reaches and how long a span can be (the server's limits). */
export const SALES_LIMITS = { historyDays: 730, rangeDays: 366 };

export type SalesPresetKey =
  'today' | 'yesterday' | 'week' | 'month' | 'thisMonth' | 'lastMonth' | 'thisFy' | 'lastFy';

export interface SalesPreset {
  key: SalesPresetKey;
  range: DayRange;
  /** The fiscal year's own name ("2083-84"), for This FY and Last FY. */
  label?: string;
}

/** "2026-11" → "2026-11-01". */
const monthStart = (day: string) => `${day.slice(0, 7)}-01`;

/**
 * The spans managers reach for, today's first; a fiscal year only when the branch has them and
 * it fits the report's limits (Last FY can be longer ago than two years in a while).
 */
export function salesPresets(
  today: string,
  fiscalYears?: {
    current: DayRange & { label: string };
    previous: DayRange & { label: string };
  },
): SalesPreset[] {
  const firstOfMonth = monthStart(today);
  const lastMonthEnd = shiftDay(firstOfMonth, -1);
  const presets: SalesPreset[] = [
    { key: 'today', range: { from: today, to: today } },
    { key: 'yesterday', range: { from: shiftDay(today, -1), to: shiftDay(today, -1) } },
    { key: 'week', range: { from: shiftDay(today, -6), to: today } },
    { key: 'month', range: { from: shiftDay(today, -29), to: today } },
    { key: 'thisMonth', range: { from: firstOfMonth, to: today } },
    { key: 'lastMonth', range: { from: monthStart(lastMonthEnd), to: lastMonthEnd } },
  ];
  if (fiscalYears) {
    const earliest = shiftDay(today, -SALES_LIMITS.historyDays);
    const current = fiscalYears.current;
    presets.push({
      key: 'thisFy',
      label: current.label,
      range: { from: current.from, to: current.to < today ? current.to : today },
    });
    const previous = fiscalYears.previous;
    if (previous.from >= earliest) {
      presets.push({ key: 'lastFy', label: previous.label, range: previous });
    }
  }
  return presets;
}

/** The preset a range is, if any. */
export const presetOf = (presets: readonly SalesPreset[], range: DayRange) =>
  presets.find((p) => p.range.from === range.from && p.range.to === range.to);

/** How a figure moved against the span before. */
export interface Change {
  /** Rounded percent (+12, −3); null when there was nothing before to compare with. */
  percent: number | null;
  direction: 'up' | 'down' | 'flat';
  /** Whether that's good news (more sales: yes; more refunds: no). Flat is neutral. */
  tone: 'good' | 'bad' | 'neutral';
}

export function changeOf(now: number, before: number, upIsGood = true): Change {
  const direction = now > before ? 'up' : now < before ? 'down' : 'flat';
  const percent = before > 0 ? Math.round(((now - before) / before) * 100) : null;
  const tone =
    direction === 'flat' || (percent === 0 && before > 0)
      ? 'neutral'
      : (direction === 'up') === upIsGood
        ? 'good'
        : 'bad';
  return { percent: percent === 0 && direction !== 'flat' ? 0 : percent, direction, tone };
}

/** One column of the trend chart: a day, a week or a month. */
export interface TrendBucket {
  /** Its first day. */
  from: string;
  /** Its last day (in the span). */
  to: string;
  netSales: number;
  orders: number;
  /** Nepal: its first day in the Nepali calendar. */
  bs?: string;
}

export type TrendGrain = 'day' | 'week' | 'month';

/** Days while they fit as columns; weeks for a few months; months beyond. */
export const grainOf = (days: number): TrendGrain =>
  days <= 45 ? 'day' : days <= 190 ? 'week' : 'month';

/**
 * The span's days as the chart's columns: each day, or seven days at a time from the first,
 * or each calendar month (the first and last may be part months).
 */
export function trendBuckets(days: readonly SalesDay[], grain: TrendGrain): TrendBucket[] {
  const keyOf = (day: SalesDay, i: number) =>
    grain === 'day'
      ? String(i)
      : grain === 'week'
        ? String(Math.floor(i / 7))
        : day.day.slice(0, 7);
  const groups: { key: string; bucket: TrendBucket }[] = [];
  days.forEach((d, i) => {
    const key = keyOf(d, i);
    const last = groups.at(-1);
    if (last?.key === key) {
      last.bucket.to = d.day;
      last.bucket.netSales += d.netSales;
      last.bucket.orders += d.orders;
    } else {
      groups.push({
        key,
        bucket: {
          from: d.day,
          to: d.day,
          netSales: d.netSales,
          orders: d.orders,
          ...(d.bs ? { bs: d.bs } : {}),
        },
      });
    }
  });
  // Sums of money drift in floating point: back to the paisa.
  return groups.map(({ bucket }) => ({
    ...bucket,
    netSales: Math.round(bucket.netSales * 100) / 100,
  }));
}

/** The day with the most sales, and the quietest one that had any. */
export function bestAndQuietest(days: readonly SalesDay[]) {
  const open = days.filter((d) => d.orders > 0);
  if (open.length < 2) return null;
  const best = open.reduce((a, b) => (b.netSales > a.netSales ? b : a));
  const quiet = open.reduce((a, b) => (b.netSales < a.netSales ? b : a));
  return best.day === quiet.day ? null : { best, quiet };
}

/** The hours worth drawing: from the first with orders to the last (the whole day with none). */
export function openHours(hours: readonly SalesHour[]): SalesHour[] {
  const busy = hours.filter((h) => h.orders > 0);
  const first = busy[0];
  const last = busy.at(-1);
  if (!first || !last) return [];
  return hours.filter((h) => h.hour >= first.hour && h.hour <= last.hour);
}

/** The busiest hours by sales, most first (at most `count`, only those that had orders). */
export const peakHours = (hours: readonly SalesHour[], count = 2): SalesHour[] =>
  [...hours]
    .filter((h) => h.orders > 0)
    .sort((a, b) => b.netSales - a.netSales || a.hour - b.hour)
    .slice(0, count);

/** The parts of a restaurant's day, by the hour each starts (late night runs past midnight). */
export const DAY_PARTS = [
  { key: 'morning', from: 6, to: 11 },
  { key: 'lunch', from: 11, to: 15 },
  { key: 'afternoon', from: 15, to: 18 },
  { key: 'dinner', from: 18, to: 22 },
  { key: 'late', from: 22, to: 6 },
] as const;

export type DayPartKey = (typeof DAY_PARTS)[number]['key'];

export interface DayPart {
  key: DayPartKey;
  /** Its first hour and the hour it ends at (0–23). */
  from: number;
  to: number;
  orders: number;
  netSales: number;
}

const inPart = (hour: number, part: { from: number; to: number }) =>
  part.from < part.to ? hour >= part.from && hour < part.to : hour >= part.from || hour < part.to;

/** The day's sales by part of the day (morning … late night), every part even with none. */
export function dayParts(hours: readonly SalesHour[]): DayPart[] {
  return DAY_PARTS.map((part) => {
    const its = hours.filter((h) => inPart(h.hour, part));
    return {
      ...part,
      orders: its.reduce((sum, h) => sum + h.orders, 0),
      netSales: Math.round(its.reduce((sum, h) => sum + h.netSales, 0) * 100) / 100,
    };
  });
}

/**
 * Every how many hours the hours chart is labelled, so labels never crowd: each hour while
 * few, then every 2, 3 or 4 (8 AM–11 PM: 9 AM, 12 PM, 3 PM, 6 PM, 9 PM).
 */
export const hourStep = (columns: number) =>
  columns <= 8 ? 1 : columns <= 12 ? 2 : columns <= 18 ? 3 : 4;

/** "7 PM", "12 PM": the start of an hour, as staff say it. */
export function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** "7–8 PM", "11 AM–12 PM": an hour as a window. */
export function hourWindow(hour: number): string {
  const start = hourLabel(hour);
  const end = hourLabel((hour + 1) % 24);
  const [startNum, startHalf] = start.split(' ');
  const [endNum, endHalf] = end.split(' ');
  return startHalf === endHalf ? `${startNum}–${endNum} ${endHalf}` : `${start}–${end}`;
}

/**
 * Staff refunds that named no dish (goodwill, "₹50 off", or given before dishes were recorded):
 * all staff refunds on the days less those named dish by dish. Never below nothing.
 */
export function unlinkedRefunds(
  staffRefunds: number,
  byDish: readonly { amount: number }[],
): number {
  const linked = byDish.reduce((sum, r) => sum + r.amount, 0);
  return Math.max(0, Math.round((staffRefunds - linked) * 100) / 100);
}

/** A part's share of the whole, rounded (0 when there's no whole). */
export const shareOf = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

/**
 * An axis from 0 to a clean top above `max`, in 4 even steps of 1, 2, 2.5 or 5 × a power of ten
 * (0 / 5K / 10K / 15K / 20K).
 */
export function niceTicks(max: number, steps = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / steps;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? 10 * power;
  const ticks: number[] = [];
  for (let v = 0; v < max + step * 0.0001; v += step) ticks.push(Math.round(v * 100) / 100);
  if ((ticks.at(-1) ?? 0) < max) ticks.push(Math.round(((ticks.at(-1) ?? 0) + step) * 100) / 100);
  return ticks;
}

/** "रू 1.2L", "₹45K": an amount short enough for an axis. */
export function compactAmount(amount: number, locale: string, symbol: string): string {
  const text = new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: amount >= 1000 ? 1 : 0,
  }).format(amount);
  return `${symbol}${symbol.length > 1 ? ' ' : ''}${text}`;
}

/**
 * A span of days as people write it, the year once: "Thu 19 Nov 2026" (one day),
 * "1–19 Nov 2026", "21 Oct – 19 Nov 2026", "21 Dec 2025 – 19 Jan 2026".
 */
export function rangeText(from: string, to: string): string {
  const parts = (day: string) =>
    Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
        .formatToParts(new Date(`${day}T12:00:00Z`))
        .map((p) => [p.type, p.value]),
    );
  const a = parts(from);
  const b = parts(to);
  if (from === to) return `${a.weekday} ${a.day} ${a.month} ${a.year}`;
  if (a.year !== b.year) return `${a.day} ${a.month} ${a.year} – ${b.day} ${b.month} ${b.year}`;
  if (a.month !== b.month) return `${a.day} ${a.month} – ${b.day} ${b.month} ${b.year}`;
  return `${a.day}–${b.day} ${b.month} ${b.year}`;
}

/** A calendar day drawn on its own: "Sat 15 Nov". */
export function shortDay(day: string): string {
  const at = new Date(`${day}T12:00:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.weekday} ${parts.day} ${parts.month}`;
}

/** An axis label: "15" (days; "15 Nov" on the 1st and the first), "14 Aug" (weeks), "Nov" (months). */
export function axisDay(day: string, grain: TrendGrain, first: boolean): string {
  const at = new Date(`${day}T12:00:00Z`);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(at);
  const date = String(at.getUTCDate());
  if (grain === 'month') return month;
  // A week always says its month; a day only on the first shown and the 1st.
  return grain === 'week' || first || date === '1' ? `${date} ${month}` : date;
}

/** "2083-08-03" with the month names (Baisakh … Chaitra): "3 Mangsir". */
export function nepaliDay(bs: string, months: readonly string[]): string {
  const [, month, day] = bs.split('-').map(Number);
  const name = months[(month ?? 1) - 1] ?? '';
  return `${day ?? ''} ${name}`.trim();
}
