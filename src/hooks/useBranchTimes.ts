'use client';

import { useMemo } from 'react';
import { useBranch, useContent } from '@/api/hooks';
import { branchTimes, sessionsOn, type BranchTimesInput } from '@/lib/branchHours';
import { createClock } from '@/lib/clock';
import type { OrderMode, Session, Weekday } from '@/types/branch';
import { useNow } from './useNow';

/** A branch's hours and status in words, as the screens show them. */
export interface BranchTimeLabels {
  /** Open: when ordering stops (last orders), "8:30 PM". */
  ordersUntil: string | null;
  /** Open: whole minutes until ordering stops (at least 1); null otherwise. */
  minutesLeft: number | null;
  /** Closed: when ordering opens again, "11:00 AM"; null when it never opens. */
  opensAt: string | null;
  /** Closed and opening later today: "in about 1 hr 20 min". */
  opensIn: string;
  /** Closed: it opens again tomorrow. */
  reopensTomorrow: boolean;
  /** Closed: the day it opens again, when that's after tomorrow. */
  reopensOn?: Weekday;
  /** Paused: about how many minutes are left (at least 1); 0 otherwise. */
  pausedForMinutes: number;
  /** Today's sessions: "12:00 PM – 3:30 PM, 7:00 PM – 11:30 PM", or "Closed today". */
  hoursToday: string;
  /** "30 min before close". */
  lastOrdersNote: string;
  /**
   * The sessions guests are told about: today's, or on a closed day the next open day's
   * ("Lunch", "12:00 PM – 3:30 PM"; an unnamed one is "Open").
   */
  sessions: { label: string; hours: string }[];
}

/** "in about 1 hr 20 min" from minutes, in the status copy's words. */
type OpensInWords = (
  key: 'minutes' | 'hours' | 'hoursMinutes',
  values: Record<string, number>,
) => string;

function opensInLabel(minutes: number, words: OpensInWords): string {
  const m = Math.max(1, Math.ceil(minutes));
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  if (hours === 0) return words('minutes', { minutes: rest });
  return rest === 0 ? words('hours', { hours }) : words('hoursMinutes', { hours, minutes: rest });
}

/**
 * A way of ordering's hours and status in words (dine-in's: the branch's opening hours),
 * worked out on the device from its hours, its status and `statusUntil`, and kept current
 * (every 30 s). Null in the prerendered HTML and the first client render, so the words never
 * mismatch on hydration.
 */
export function useBranchTimes(
  branch: BranchTimesInput,
  mode: OrderMode = 'dineIn',
): BranchTimeLabels | null {
  const now = useNow();
  const t = useContent('status');
  return useMemo(() => {
    if (!now) return null;
    const clock = createClock(branch);
    const range = (s: Session, day = 0) => {
      const from = clock.localTimestamp(-day, s.opens, now);
      // A closing time past midnight (or "24:00") is the next day's: only its time is shown.
      const to = s.closes === '24:00' ? '00:00' : s.closes;
      return `${clock.time(from)} – ${clock.time(clock.localTimestamp(-day, to, now))}`;
    };
    const { today, ordersUntil, reopens, pausedMinutes } = branchTimes(branch, now, mode);
    // On a closed day, the sessions of the day it opens next.
    const shown =
      today.length || !reopens
        ? today
        : sessionsOn(
            branch.schedule,
            clock.localTimestamp(-reopens.daysAhead, '00:00', now).slice(0, 10),
            reopens.day,
            mode,
          );
    return {
      ordersUntil: ordersUntil ? clock.time(ordersUntil) : null,
      minutesLeft: ordersUntil
        ? Math.max(1, Math.ceil((ordersUntil.getTime() - now.getTime()) / 60_000))
        : null,
      opensAt: reopens ? clock.time(reopens.at) : null,
      opensIn: reopens
        ? opensInLabel((reopens.at.getTime() - now.getTime()) / 60_000, (key, values) =>
            t(`hours.opensIn.${key}`, values),
          )
        : '',
      reopensTomorrow: reopens?.daysAhead === 1,
      ...(reopens && reopens.daysAhead > 1 ? { reopensOn: reopens.day } : {}),
      pausedForMinutes: pausedMinutes,
      hoursToday: today.length ? today.map((s) => range(s)).join(', ') : t('hours.closedToday'),
      lastOrdersNote: t('hours.lastOrdersNote', {
        minutes: branch.schedule.lastOrdersMinutes,
      }),
      sessions: shown.map((s) => ({ label: s.label ?? t('hours.session'), hours: range(s) })),
    };
  }, [branch, mode, now, t]);
}

/** The active branch's usual kitchen time: "18–22 min". */
export function usePrepTime(): string {
  const { prepMinutes } = useBranch();
  return useContent('common')('prepTime', prepMinutes);
}
