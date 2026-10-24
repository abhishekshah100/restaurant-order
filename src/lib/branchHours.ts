import type { Branch, OpeningSchedule, OrderMode, Session, Weekday } from '@/types/branch';
import { WEEKDAYS } from '@/types/branch';
import { createClock } from './clock';

/*
 * Opening hours: a branch's week of sessions (Settings › Opening hours: lunch, dinner; one may
 * run past midnight or all day) and what it says at a moment — whether orders are taken and
 * until when, today's sessions, when a closed branch opens again. The same rules as the backend
 * (restaurant-backend › branch-schedule.ts): orders are taken inside a session until its last
 * orders. Pure: the branch and the time come in as arguments; hooks/useBranchTimes words them.
 */

/** 24-hour "HH:MM", 00:00 to 23:59. */
export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isTime = (v: unknown): v is string => typeof v === 'string' && TIME.test(v);

/** A session's closing time: any time, or "24:00" (the end of the day). */
export const isCloseTime = (v: unknown): v is string => isTime(v) || v === '24:00';

/** "18:30" → 1110; "24:00" → 1440. */
export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

/** 1110 → "18:30" (within the day). */
export const fromMinutes = (minutes: number) => {
  const m = Math.max(0, Math.min(minutes, 23 * 60 + 59));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * A session in minutes after its day's midnight: a closing time at or before the opening is the
 * next day's ("18:00"–"02:00" → 1080–1560), "24:00" the end of the day.
 */
export function sessionMinutes(s: Pick<Session, 'opens' | 'closes'>): {
  opens: number;
  closes: number;
} {
  const opens = toMinutes(s.opens);
  const closes = toMinutes(s.closes);
  return { opens, closes: closes > opens ? closes : closes + 1440 };
}

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

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

type WeekOf = Pick<Branch, 'schedule' | 'timezone' | 'locale'>;

/**
 * The sessions a way of ordering follows on one of the branch's calendar days ("2026-11-08"):
 * its special date's, else its own week's (takeaway or delivery with hours of their own) or the
 * opening hours'.
 */
export function sessionsOn(
  schedule: OpeningSchedule,
  dayKey: string,
  weekday: Weekday,
  mode: OrderMode = 'dineIn',
): Session[] {
  const special = schedule.specialDays.find((d) => d.from <= dayKey && dayKey <= d.to);
  if (special) return special.sessions;
  const own = mode === 'dineIn' ? null : schedule[mode];
  return (own ?? schedule.days)[weekday];
}

/** A session as it happens: the instants it opens and closes, on a day of the week. */
export interface SessionAt {
  opens: Date;
  closes: Date;
  day: Weekday;
  label?: string;
}

/**
 * The sessions that start from `fromDays` to `toDays` of the branch's days after today (-1:
 * yesterday's, which may still be running), as instants, in order. Times are placed with the
 * branch's UTC offset now (India and Nepal keep one all year).
 */
export function sessionsBetween(
  branch: WeekOf,
  now: Date,
  fromDays: number,
  toDays: number,
  mode: OrderMode = 'dineIn',
): SessionAt[] {
  const clock = createClock(branch);
  const today = WEEKDAYS.indexOf(weekdayAt(now, branch.timezone));
  const sessions: SessionAt[] = [];
  for (let ahead = fromDays; ahead <= toDays; ahead += 1) {
    const day = WEEKDAYS[(((today + ahead) % 7) + 7) % 7];
    const start = clock.localTimestamp(-ahead, '00:00', now);
    const midnight = Date.parse(start);
    const list = sessionsOn(branch.schedule, start.slice(0, 10), day, mode)
      .map((s) => ({ s, ...sessionMinutes(s) }))
      .sort((a, b) => a.opens - b.opens);
    for (const { s, opens, closes } of list) {
      sessions.push({
        opens: new Date(midnight + opens * MINUTE_MS),
        closes: new Date(midnight + closes * MINUTE_MS),
        day,
        ...(s.label ? { label: s.label } : {}),
      });
    }
  }
  return sessions;
}

/**
 * What the week alone says at `now`: open inside a session until its last orders (`until`,
 * when ordering stops), else closed until the next session opens (none when it never opens).
 */
export function scheduleStatus(
  branch: WeekOf,
  now: Date,
  mode: OrderMode = 'dineIn',
): { status: 'open' | 'closed'; until?: Date } {
  // Special dates can close a branch for a while: look a few weeks ahead for its next session.
  const sessions = sessionsBetween(branch, now, -1, 31, mode);
  const at = now.getTime();
  const lead = branch.schedule.lastOrdersMinutes * MINUTE_MS;
  const current = sessions.find((s) => s.opens.getTime() <= at && at < s.closes.getTime() - lead);
  if (current) return { status: 'open', until: new Date(current.closes.getTime() - lead) };
  const next = sessions.find((s) => s.opens.getTime() > at);
  return next ? { status: 'closed', until: next.opens } : { status: 'closed' };
}

/** A moment, how many of the branch's days ahead it is (0: today) and that day of the week. */
export interface DayMoment {
  at: Date;
  daysAhead: number;
  day: Weekday;
}

function dayMoment(branch: WeekOf, now: Date, at: Date): DayMoment {
  const clock = createClock(branch);
  const daysAhead = Math.round(
    (Date.parse(clock.dayKey(at)) - Date.parse(clock.dayKey(now))) / DAY_MS,
  );
  return { at, daysAhead, day: weekdayAt(at, branch.timezone) };
}

/**
 * When the branch next opens after today, by its week (what closing for the rest of today
 * waits for); null when it never opens.
 */
export function nextOpeningAfterToday(branch: WeekOf, now: Date): DayMoment | null {
  const next = sessionsBetween(branch, now, 1, 31)[0];
  return next ? dayMoment(branch, now, next.opens) : null;
}

/** What a branch's week and status say at a moment, in its time zone. */
export interface BranchTimes {
  /** Today's sessions as staff set them (none: a closed day). */
  today: Session[];
  /** Open: when ordering stops (last orders, or the end of a day staff opened). */
  ordersUntil: Date | null;
  /** Closed: when ordering opens again, and how many of the branch's days ahead (0: today). */
  reopens: DayMoment | null;
  /** Paused: whole minutes until orders resume (at least 1); 0 otherwise. */
  pausedMinutes: number;
}

export type BranchTimesInput = Pick<
  Branch,
  'status' | 'statusUntil' | 'schedule' | 'timezone' | 'locale'
> & { modeStatus?: Branch['modeStatus'] };

/** A way of ordering's status and next change: dine-in's is the branch's own. */
export function statusFor(branch: BranchTimesInput, mode: OrderMode) {
  const own = mode === 'dineIn' ? undefined : branch.modeStatus?.[mode];
  return own ?? { status: branch.status, statusUntil: branch.statusUntil };
}

/**
 * Today's sessions for a way of ordering, and until when it takes orders, opens again or
 * resumes: from its status and `statusUntil` (the server's: the next change), or from its hours
 * when there's none.
 */
export function branchTimes(
  branch: BranchTimesInput,
  now: Date,
  mode: OrderMode = 'dineIn',
): BranchTimes {
  const { status, statusUntil } = statusFor(branch, mode);
  const clock = createClock(branch);
  const dayKey = clock.localTimestamp(0, '00:00', now).slice(0, 10);
  const today = sessionsOn(branch.schedule, dayKey, weekdayAt(now, branch.timezone), mode);
  // Without the server's word, the hours' — when they agree with the status.
  const week = statusUntil ? null : scheduleStatus(branch, now, mode);
  const until = statusUntil
    ? new Date(statusUntil)
    : week?.status === status
      ? (week.until ?? null)
      : null;
  return {
    today,
    ordersUntil: status === 'open' ? until : null,
    reopens: status === 'closed' && until ? dayMoment(branch, now, until) : null,
    pausedMinutes:
      status === 'paused' && until
        ? Math.max(1, Math.ceil((until.getTime() - now.getTime()) / MINUTE_MS))
        : 0,
  };
}

/** Whether a week opens at all (on any day). */
export const opensAtAll = (schedule: OpeningSchedule) =>
  WEEKDAYS.some((d) => schedule.days[d].length > 0);
