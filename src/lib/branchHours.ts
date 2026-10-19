import type { Branch, DayHours, OpeningSchedule, Weekday } from '@/types/branch';
import { WEEKDAYS } from '@/types/branch';
import { createClock } from './clock';

/*
 * Opening hours: a branch's week (Settings › Opening hours) and what it says about today — the
 * hours, last orders and service windows guests are shown, or a closed day and the day it
 * opens next. Pure: the branch, the time and the words come in as arguments.
 */

/** 24-hour "HH:MM", 00:00 to 23:59. */
export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isTime = (v: unknown): v is string => typeof v === 'string' && TIME.test(v);

/** "18:30" → 1110. */
export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

/** 1110 → "18:30" (within the day). */
export const fromMinutes = (minutes: number) => {
  const m = Math.max(0, Math.min(minutes, 23 * 60 + 59));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const weekdayFormats = new Map<string, Intl.DateTimeFormat>();

/** The day of the week at the branch (in its time zone). */
export function weekdayAt(now: Date, timezone: string): Weekday {
  let format = weekdayFormats.get(timezone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone });
    weekdayFormats.set(timezone, format);
  }
  const day = format.format(now).toLowerCase().slice(0, 3);
  return WEEKDAYS.find((d) => d === day) ?? 'mon';
}

/** The next day the branch opens after `day` (1 to 7 days on), or null when it never opens. */
export function nextOpenDay(
  schedule: OpeningSchedule,
  day: Weekday,
): { day: Weekday; hours: DayHours; daysAhead: number } | null {
  const start = WEEKDAYS.indexOf(day);
  for (let ahead = 1; ahead <= 7; ahead += 1) {
    const next = WEEKDAYS[(start + ahead) % 7];
    if (schedule.days[next].open)
      return { day: next, hours: schedule.days[next], daysAhead: ahead };
  }
  return null;
}

/** Minutes the branch is open on a day (0 when it's shut). */
export const openMinutes = (hours: DayHours) =>
  hours.open ? toMinutes(hours.closes) - toMinutes(hours.opens) : 0;

/** The words worked into a branch's hours. */
export interface ScheduleLabels {
  /** "30 min before close". */
  lastOrdersNote(minutes: number): string;
  /** The day's hours on a closed day: "Closed today". */
  closedToday: string;
}

/**
 * The branch as it is today by its weekly schedule: today's opening and closing times
 * (`hours`, `opensAt`, `closesAt`, `hoursToday`), last orders and the service windows. On a day
 * it's shut it's closed, with `opensAt` the next opening day's time and `reopensOn` that day
 * (`reopensTomorrow` too when it's tomorrow). What staff set from the admin bar (paused, closed
 * for the day, open) goes on top of this.
 */
export function withSchedule(branch: Branch, now: Date, labels: ScheduleLabels): Branch {
  const { schedule } = branch;
  const clock = createClock(branch);
  const at = (time: string) => clock.time(clock.localTimestamp(0, time, now));
  const range = (from: string, to: string) => `${at(from)} – ${at(to)}`;
  const today = weekdayAt(now, branch.timezone);
  const day = schedule.days[today];
  const windows = schedule.windows.map((w) => ({ label: w.label, hours: range(w.from, w.to) }));
  const lastOrdersNote = labels.lastOrdersNote(schedule.lastOrdersMinutes);
  const { reopensOn: _stale, ...rest } = branch;

  if (day.open) {
    return {
      ...rest,
      hours: { opens: day.opens, closes: day.closes },
      opensAt: at(day.opens),
      closesAt: at(day.closes),
      hoursToday: range(day.opens, day.closes),
      lastOrders: at(fromMinutes(toMinutes(day.closes) - schedule.lastOrdersMinutes)),
      lastOrdersNote,
      serviceWindows: windows,
    };
  }

  const next = nextOpenDay(schedule, today);
  if (!next) return branch;
  return {
    ...rest,
    status: 'closed',
    reopensOn: next.day,
    ...(next.daysAhead === 1 ? { reopensTomorrow: true } : {}),
    hours: { opens: next.hours.opens, closes: next.hours.closes },
    opensAt: at(next.hours.opens),
    closesAt: at(next.hours.closes),
    hoursToday: labels.closedToday,
    lastOrders: at(fromMinutes(toMinutes(next.hours.closes) - schedule.lastOrdersMinutes)),
    lastOrdersNote,
    serviceWindows: windows,
  };
}
