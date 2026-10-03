import { useContent } from '@/api/hooks';
import { Icon, type IconName } from '@/components/ui';
import { cx } from '@/lib/cx';
import styles from './TrackTimeline.module.css';

export interface TimelineEntry {
  key: string;
  title: string;
  detail?: string;
  icon: IconName;
  state: 'done' | 'cancel';
}

/** Vertical timeline of a cancelled order (s10): done steps in green, the cancellation in red. */
export function TrackTimeline({
  entries,
  className,
  label,
}: {
  entries: TimelineEntry[];
  className?: string;
  /** Accessible name of the list; "Order progress" by default. */
  label?: string;
}) {
  const t = useContent('orders');
  return (
    <ol className={cx(styles.track, className)} aria-label={label ?? t('shared.orderProgress')}>
      {entries.map((entry) => (
        <li key={entry.key} className={cx(styles.ts, styles[entry.state])}>
          <span className={styles.dot} aria-hidden="true">
            <Icon name={entry.state === 'done' ? 'check' : entry.icon} />
          </span>
          <div className={styles.body}>
            <p className={styles.title}>
              {entry.title}
              <span className="visually-hidden">
                {t('stepper.stateSuffix', { state: t(`timeline.state.${entry.state}`) })}
              </span>
            </p>
            {entry.detail && <p className={styles.detail}>{entry.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
