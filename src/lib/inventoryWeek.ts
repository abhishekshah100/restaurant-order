import type { UsageResponse } from '@/types/inventory';

/*
 * The inventory week at a glance: this week against last (waste, missing), the biggest problem,
 * and how many weeks in a row stock was counted. Pure, so it's unit-tested; Today words it.
 */

/** Change from last week, in whole percent (none when last week had nothing to compare). */
export function change(now: number, before: number): number | undefined {
  if (before <= 0) return undefined;
  return Math.round(((now - before) / before) * 100);
}

export interface WeekProblem {
  name: string;
  kind: 'wasted' | 'missing';
  value: number;
}

/** The item that cost most this week, wasted or missing (none when nothing did). */
export function biggestProblem(usage: UsageResponse): WeekProblem | undefined {
  let best: WeekProblem | undefined;
  for (const row of usage.rows) {
    const wasted = row.value?.wastage ?? 0;
    const missing = Math.max(0, row.value?.unexplained ?? 0);
    const [kind, value] =
      wasted >= missing ? (['wasted', wasted] as const) : (['missing', missing] as const);
    if (value > 0 && (!best || value > best.value)) best = { name: row.name, kind, value };
  }
  return best;
}

const DAY_MS = 86_400_000;

/**
 * Weeks in a row with a count applied, ending this week or last (a week without one yet doesn't
 * break the run until it's over). Weeks are 7-day blocks back from `now`.
 */
export function countStreak(appliedAt: readonly string[], now: Date): number {
  const weeks = new Set(
    appliedAt.map((at) => Math.floor((now.getTime() - Date.parse(at)) / (7 * DAY_MS))),
  );
  let week = weeks.has(0) ? 0 : 1;
  let streak = 0;
  while (weeks.has(week)) {
    streak += 1;
    week += 1;
  }
  return streak;
}
