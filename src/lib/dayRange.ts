import type { AdminOrdersFilter } from '@/api/contracts';

/*
 * A range of the branch's calendar days ("2026-10-25"), as staff look back at orders and
 * payments: never past today, back up to HISTORY_DAYS and RANGE_DAYS long at most (the
 * server's limits on GET /admin/branches/:branchId/orders).
 */

export const HISTORY_DAYS = 365;
export const RANGE_DAYS = 31;

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
export const isDayKey = (value: string): boolean =>
  DAY_KEY.test(value) && shiftDay(value, 0) === value;

/** The earliest day staff can look at. */
export const firstDay = (today: string): string => shiftDay(today, -HISTORY_DAYS);

const clampDay = (key: string, today: string) =>
  key > today ? today : key < firstDay(today) ? firstDay(today) : key;

/**
 * The range from the address (?from=&to=), made valid: a missing or wrong day follows the other
 * (today with neither), days past today or too far back move in, the wrong way round swaps,
 * and one too long is cut to the last RANGE_DAYS.
 */
export function parseDayRange(from: string | null, to: string | null, today: string): DayRange {
  const day = (value: string | null) =>
    value && isDayKey(value) ? clampDay(value, today) : undefined;
  let start = day(from);
  let end = day(to);
  end ??= start ?? today;
  start ??= end;
  if (start > end) [start, end] = [end, start];
  const earliest = shiftDay(end, -(RANGE_DAYS - 1));
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
): 'outside' | 'order' | 'tooLong' | null {
  if (range.to > today || range.from < firstDay(today)) return 'outside';
  if (range.from > range.to) return 'order';
  if (range.to > shiftDay(range.from, RANGE_DAYS - 1)) return 'tooLong';
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
