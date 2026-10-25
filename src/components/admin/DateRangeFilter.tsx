import { useContent } from '@/api/hooks';
import { Button, Input } from '@/components/ui';
import { firstDay, isDayKey, isTodayOnly, withFrom, withTo, type DayRange } from '@/lib/dayRange';
import styles from './DateRangeFilter.module.css';

/**
 * From and To days to look back over (the branch's calendar), with Today to come back to the
 * live day. A pick that would make the range wrong or too long moves the other end with it.
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
  const min = firstDay(today);
  return (
    <div className={styles.filter} role="group" aria-label={t('adminDateRange.label')}>
      <Input
        id={`${id}-from`}
        type="date"
        label={t('adminDateRange.from')}
        className={styles.field}
        value={range.from}
        min={min}
        max={today}
        onChange={(event) => {
          if (isDayKey(event.target.value)) onChange(withFrom(range, event.target.value, today));
        }}
      />
      <Input
        id={`${id}-to`}
        type="date"
        label={t('adminDateRange.to')}
        className={styles.field}
        value={range.to}
        min={min}
        max={today}
        onChange={(event) => {
          if (isDayKey(event.target.value)) onChange(withTo(range, event.target.value, today));
        }}
      />
      {!isTodayOnly(range, today) && (
        <Button
          variant="secondary"
          size="sm"
          iconStart="calendar"
          className={styles.today}
          onClick={() => onChange({ from: today, to: today })}
        >
          {t('adminDateRange.today')}
        </Button>
      )}
    </div>
  );
}
