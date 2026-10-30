import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Input } from '@/components/ui';
import {
  RANGE_DAYS,
  firstDay,
  isDayKey,
  isTodayOnly,
  rangeProblem,
  type DayRange,
} from '@/lib/dayRange';
import { useAdminWorkspace } from './shell/AdminWorkspace';
import styles from './DateRangeFilter.module.css';

/**
 * From and To days to look back over (the branch's calendar), with Today to come back to the
 * live day. Each day stays as staff set it: a pick that doesn't work with the other (From after
 * To, more than RANGE_DAYS apart, outside the year) says why and waits, and the days shown
 * change only once both work together. The other day is never moved for them.
 */
export function DateRangeFilter({
  id,
  range,
  today,
  onChange,
}: {
  /** Prefix for the fields' ids (two filters can share a page). */
  id: string;
  range: DayRange;
  /** The branch's today, "2026-10-26". */
  today: string;
  onChange: (range: DayRange) => void;
}) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  const min = firstDay(today);
  // The days as typed; the page's range until staff change one.
  const [draft, setDraft] = useState(range);
  const [shown, setShown] = useState(range);
  if (shown.from !== range.from || shown.to !== range.to) {
    // The page moved to other days (Today, the address): start from those.
    setShown(range);
    setDraft(range);
  }
  const complete = isDayKey(draft.from) && isDayKey(draft.to);
  const problem = complete ? rangeProblem(draft, today) : null;

  const pick = (next: DayRange) => {
    setDraft(next);
    if (isDayKey(next.from) && isDayKey(next.to) && !rangeProblem(next, today)) onChange(next);
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
            ? t('adminDateRange.problems.outside', { first: clock.date(`${min}T12:00:00Z`) })
            : problem === 'order'
              ? t('adminDateRange.problems.order')
              : t('adminDateRange.problems.tooLong', { days: RANGE_DAYS })}
        </p>
      )}
    </div>
  );
}
