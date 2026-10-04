import type { Branch } from '@/types/branch';

/** What time formatting needs from a branch. */
export type ClockRegion = Pick<Branch, 'locale' | 'timezone'>;

/** Times and days in one branch's time zone. Build one with createClock (or useRegion().clock). */
export interface Clock {
  /** "7:42 PM" in the branch's local time. */
  time(at: Date | string): string;
  /** "12 Sep 2026" in the branch's local time. */
  date(at: Date | string): string;
  /** The branch's calendar day: "2026-10-03". */
  dayKey(at: Date | string): string;
  /** Both on the same calendar day at the branch ("today" is the branch's today). */
  isSameDay(a: Date | string, b: Date | string): boolean;
  /** ISO timestamp of local "HH:MM" on the branch's day `daysAgo` before `now`: "2026-10-03T19:42:00+05:30". */
  localTimestamp(daysAgo: number, time: string, now: Date): string;
}

const DAY_MS = 86_400_000;

const toDate = (at: Date | string) => (typeof at === 'string' ? new Date(at) : at);

const partsOf = (format: Intl.DateTimeFormat, at: Date | string) =>
  Object.fromEntries(format.formatToParts(toDate(at)).map((p) => [p.type, p.value]));

const cache = new WeakMap<ClockRegion, Clock>();

/** The clock for a branch. Built once per branch object. */
export function createClock(region: ClockRegion): Clock {
  const cached = cache.get(region);
  if (cached) return cached;
  const timeZone = region.timezone;
  const timeParts = new Intl.DateTimeFormat(region.locale, {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
    timeZone,
  });
  // The short English month as drawn ("12 Sep 2026"); en-IN and en-GB would say "Sept".
  const dateParts = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  });
  const day = new Intl.DateTimeFormat('en-CA', { timeZone });
  const offset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' });

  const dayKey = (at: Date | string) => day.format(toDate(at));
  /** "+05:45" (Intl says "GMT+05:45", or just "GMT" for UTC). */
  const utcOffset = (at: Date) => partsOf(offset, at).timeZoneName.replace('GMT', '') || '+00:00';

  const clock: Clock = {
    time(at) {
      // One style everywhere, as drawn: "7:42 PM" (en-IN alone would write "7:42 pm").
      const p = partsOf(timeParts, at);
      return `${p.hour}:${p.minute} ${p.dayPeriod.toUpperCase()}`;
    },
    date(at) {
      const p = partsOf(dateParts, at);
      return `${p.day} ${p.month} ${p.year}`;
    },
    dayKey,
    isSameDay: (a, b) => dayKey(a) === dayKey(b),
    localTimestamp(daysAgo, time, now) {
      const day = dayKey(new Date(now.getTime() - daysAgo * DAY_MS));
      return `${day}T${time}:00${utcOffset(now)}`;
    },
  };
  cache.set(region, clock);
  return clock;
}
