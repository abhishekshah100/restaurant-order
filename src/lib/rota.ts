import type { RotaShift } from '@/types/admin';

/*
 * The rota's sums and words: a shift's times as people read them ("4 PM – 11:30 PM"), each
 * person's planned hours in the week, and how many are on each day.
 */

/** Above this many planned hours in a week, the planner sees a warning. */
export const WEEK_HOURS_LIMIT = 48;

const DAY_MS = 86_400_000;

/** "2026-11-11" moved by some days. */
export const addDays = (key: string, days: number) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** The Monday of a day's week. */
export const mondayOf = (key: string) =>
  addDays(key, -((new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7));

/** "HH:MM" as minutes since midnight. */
export const minutesOf = (clock: string) => {
  const [h = 0, m = 0] = clock.split(':').map(Number);
  return h * 60 + m;
};

/** From start to end, past midnight when it ends at or before it starts. */
export const spanOf = (startsAt: string, endsAt: string) => {
  const span = minutesOf(endsAt) - minutesOf(startsAt);
  return span > 0 ? span : span + 24 * 60;
};

/** Whether a shift ends the next day. */
export const overnight = (startsAt: string, endsAt: string) =>
  minutesOf(endsAt) <= minutesOf(startsAt);

/** "16:00" → "4 PM", "23:30" → "11:30 PM" (the app's 12-hour style). */
export function clockLabel(clock: string): string {
  const total = minutesOf(clock);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  const period = h < 12 ? 'AM' : 'PM';
  return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

/** "4 PM – 11:30 PM". */
export const spanLabel = (startsAt: string, endsAt: string) =>
  `${clockLabel(startsAt)} – ${clockLabel(endsAt)}`;

/** Each person's planned (paid) minutes in these shifts. */
export function minutesByPerson(shifts: readonly RotaShift[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const s of shifts) totals.set(s.staffId, (totals.get(s.staffId) ?? 0) + s.minutes);
  return totals;
}

/** How many are on, and their planned minutes, each day. */
export function coverageByDay(
  shifts: readonly RotaShift[],
  days: readonly string[],
): { day: string; people: number; minutes: number }[] {
  return days.map((day) => {
    const on = shifts.filter((s) => s.day === day);
    return { day, people: on.length, minutes: on.reduce((sum, s) => sum + s.minutes, 0) };
  });
}

/** A person's week as a WhatsApp message: hello, the week, a line a shift, a sign-off. */
export const rotaMessage = (m: { hello: string; intro: string; lines: string[]; outro: string }) =>
  [m.hello, '', m.intro, ...m.lines, '', m.outro].join('\n');
