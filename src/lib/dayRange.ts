import type { AdminOrdersFilter } from '@/api/contracts';

/*
 * A range of the branch's calendar days ("2026-10-25"), as staff look back at orders and
 * payments: never past today, back up to HISTORY_DAYS and RANGE_DAYS long at most (the
 * server's limits on GET /admin/branches/:branchId/orders).
 */

export const HISTORY_DAYS = 365;
export const RANGE_DAYS = 31;

/** How far back a page can look, and how long one range can be. */
export interface DayLimits {
  historyDays: number;
  rangeDays: number;
}

const DEFAULT_LIMITS: DayLimits = { historyDays: HISTORY_DAYS, rangeDays: RANGE_DAYS };

/** Payments › History: a year at a time, back two years (the server sums it). */
export const PAYMENT_HISTORY_LIMITS: DayLimits = { historyDays: 730, rangeDays: 366 };

/** Orders › History: the same as Payments › History (the server sums it). */
export const ORDER_HISTORY_LIMITS: DayLimits = PAYMENT_HISTORY_LIMITS;

export interface DayRange {
  from: string;
  to: string;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** The calendar day `days` after (or before) a day: ("2026-11-01", -1) → "2026-10-31". */
export function shiftDay(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whether a text names a real calendar day ("2026-02-30" doesn't). */
/**
 * A run of the branch's days as staff read it: "12 Nov 2026", or "12 Nov 2026 – 14 Nov 2026".
 * `date` writes one day (the branch clock's `date`); days are read at noon, so no time zone
 * moves them.
 */
export const daysLabel = (date: (at: Date) => string, from: string, to: string): string => {
  const one = (key: string) => date(new Date(`${key}T12:00:00Z`));
  return from === to ? one(from) : `${one(from)} – ${one(to)}`;
};

export const isDayKey = (value: string): boolean =>
  DAY_KEY.test(value) && shiftDay(value, 0) === value;

/** The earliest day staff can look at. */
export const firstDay = (today: string, limits: DayLimits = DEFAULT_LIMITS): string =>
  shiftDay(today, -limits.historyDays);

const clampDay = (key: string, today: string, limits: DayLimits) =>
  key > today ? today : key < firstDay(today, limits) ? firstDay(today, limits) : key;

/**
 * The range from the address (?from=&to=), made valid: a missing or wrong day follows the other
 * (today with neither), days past today or too far back move in, the wrong way round swaps,
 * and one too long is cut to the last RANGE_DAYS.
 */
export function parseDayRange(
  from: string | null,
  to: string | null,
  today: string,
  limits: DayLimits = DEFAULT_LIMITS,
): DayRange {
  const day = (value: string | null) =>
    value && isDayKey(value) ? clampDay(value, today, limits) : undefined;
  let start = day(from);
  let end = day(to);
  end ??= start ?? today;
  start ??= end;
  if (start > end) [start, end] = [end, start];
  const earliest = shiftDay(end, -(limits.rangeDays - 1));
  return { from: start < earliest ? earliest : start, to: end };
}

/**
 * What's wrong with the days staff picked, if anything: a day after today or more than
 * HISTORY_DAYS back (`outside`), From after To (`order`), or more than RANGE_DAYS between them
 * (`tooLong`). The filter shows it and waits; it never moves the other day by itself.
 */
export function rangeProblem(
  range: DayRange,
  today: string,
  limits: DayLimits = DEFAULT_LIMITS,
): 'outside' | 'order' | 'tooLong' | null {
  if (range.to > today || range.from < firstDay(today, limits)) return 'outside';
  if (range.from > range.to) return 'order';
  if (range.to > shiftDay(range.from, limits.rangeDays - 1)) return 'tooLong';
  return null;
}

export const isTodayOnly = (range: DayRange, today: string): boolean =>
  range.from === today && range.to === today;

/** Whether a day key falls in the range. */
export const inDayRange = (key: string, range: DayRange): boolean =>
  key >= range.from && key <= range.to;

/** What the orders request asks for: nothing for today alone (the live list everyone shares). */
export const ordersFilter = (range: DayRange, today: string): AdminOrdersFilter =>
  isTodayOnly(range, today) ? {} : { from: range.from, to: range.to };

/**
 * Items already in time order, in runs by their day ("2026-11-10"): the history lists' "day,
 * then its rows". A day comes once per run, so newest-first input gives newest-first days.
 */
export function groupByDay<T>(
  items: readonly T[],
  dayOf: (item: T) => string,
): {
  day: string;
  items: T[];
}[] {
  const days: { day: string; items: T[] }[] = [];
  for (const item of items) {
    const day = dayOf(item);
    const last = days.at(-1);
    if (last?.day === day) last.items.push(item);
    else days.push({ day, items: [item] });
  }
  return days;
}
