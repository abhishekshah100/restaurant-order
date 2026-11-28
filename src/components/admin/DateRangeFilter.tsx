import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Chip, Input } from '@/components/ui';
import {
  RANGE_DAYS,
  firstDay,
  fiscalYearRanges,
  isDayKey,
  isTodayOnly,
  rangeProblem,
  shiftDay,
  withPlanHistory,
  type DayLimits,
  type DayRange,
} from '@/lib/dayRange';
import { useAdminWorkspace } from './shell/AdminWorkspace';
import styles from './DateRangeFilter.module.css';

/**
 * From and To days to look back over (the branch's calendar), with Today to come back to the
 * live day. Each day stays as staff set it: a pick that doesn't work with the other (From after
 * To, more than RANGE_DAYS apart, outside the year) says why and waits, and the days shown
 * change only once both work together. The other day is never moved for them. A history
 * (`planHistory`) goes back only as far as the package's History days, and says so.
 */
export function DateRangeFilter({
  id,
  range,
  today,
  onChange,
  limits: pageLimits,
  presets,
  fiscalYears = false,
  planHistory = false,
}: {
  /** Prefix for the fields' ids (two filters can share a page). */
  id: string;
  range: DayRange;
  /** The branch's today, "2026-10-26". */
  today: string;
  onChange: (range: DayRange) => void;
  /** How far back and how long (the page's server limits); the orders' by default. */
  limits?: DayLimits;
  /** Quick ranges ending today, in days ("Last 7 days", "Last 6 months"…). */
  presets?: readonly { days: number; label: string }[];
  /** Offer "This FY" and "Last FY" too (the branch's financial years, where the limits allow). */
  fiscalYears?: boolean;
  /** A history the package's History days limit (orders, payments, bookings, requests…). */
  planHistory?: boolean;
}) {
  const t = useContent('common');
  const { clock, branch } = useAdminWorkspace();
  const planDays = planHistory ? (branch.plan?.limits.reportDays ?? null) : null;
  const limits = planDays === null ? pageLimits : withPlanHistory(pageLimits, planDays);
  const years =
    fiscalYears && branch.fiscalYears ? fiscalYearRanges(branch.fiscalYears, today, limits) : [];
  const min = firstDay(today, limits);
  const rangeDays = limits?.rangeDays ?? RANGE_DAYS;
  // The days as typed; the page's range until staff change one.
  const [draft, setDraft] = useState(range);
  const [shown, setShown] = useState(range);
  if (shown.from !== range.from || shown.to !== range.to) {
    // The page moved to other days (Today, the address): start from those.
    setShown(range);
    setDraft(range);
  }
  const complete = isDayKey(draft.from) && isDayKey(draft.to);
  const problem = complete ? rangeProblem(draft, today, limits) : null;

  const pick = (next: DayRange) => {
    setDraft(next);
    if (isDayKey(next.from) && isDayKey(next.to) && !rangeProblem(next, today, limits)) {
      onChange(next);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.filter} role="group" aria-label={t('adminDateRange.label')}>
        <Input
          id={`${id}-from`}
          type="date"
          label={t('adminDateRange.from')}
          className={styles.field}
          value={draft.from}
          min={min}
          max={today}
          onChange={(event) => pick({ ...draft, from: event.target.value })}
        />
        <Input
          id={`${id}-to`}
          type="date"
          label={t('adminDateRange.to')}
          className={styles.field}
          value={draft.to}
          min={min}
          max={today}
          onChange={(event) => pick({ ...draft, to: event.target.value })}
        />
        {!isTodayOnly(draft, today) && (
          <Button
            variant="secondary"
            size="sm"
            iconStart="calendar"
            className={styles.today}
            onClick={() => pick({ from: today, to: today })}
          >
            {t('adminDateRange.today')}
          </Button>
        )}
      </div>
      {problem && (
        <p className={styles.problem} role="alert">
          {problem === 'outside'
            ? t('adminDateRange.problems.outside', { first: clock.day(min) })
            : problem === 'order'
              ? t('adminDateRange.problems.order')
              : t('adminDateRange.problems.tooLong', { days: rangeDays })}
        </p>
      )}
      {planDays !== null && (
        <p className={styles.note}>{t('adminDateRange.planNote', { days: planDays })}</p>
      )}
      {((presets && presets.length > 0) || years.length > 0) && (
        <div className={styles.presets} role="group" aria-label={t('adminDateRange.presets')}>
          {(presets ?? [])
            .filter((p) => planDays === null || p.days <= planDays)
            .map((p) => {
              const range = { from: shiftDay(today, -(p.days - 1)), to: today };
              return (
                <Chip
                  key={p.days}
                  pressed={draft.from === range.from && draft.to === range.to}
                  onClick={() => pick(range)}
                >
                  {p.label}
                </Chip>
              );
            })}
          {years.map((y) => (
            <Chip
              key={y.key}
              pressed={draft.from === y.range.from && draft.to === y.range.to}
              onClick={() => pick(y.range)}
            >
              {t(`adminDateRange.fiscalYear.${y.key}`, { label: y.label })}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
