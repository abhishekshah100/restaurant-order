import { useContent } from '@/api/hooks';
import { Icon, type IconName } from '@/components/ui';
import { cx } from '@/lib/cx';
import type { TrackStepView } from '@/lib/orders';
import styles from './TrackStepper.module.css';

export interface StepperEntry {
  key: string;
  title: string;
  /** Short line under the title: "8:23 PM", "Up next", "~8:41 PM". */
  detail?: string;
  icon: IconName;
  state: TrackStepView['state'];
}

/**
 * Horizontal order progress: four steps left to right, joined by a line that fills in
 * green as the order moves. Fits a 360px phone, so the guest sees every step at a glance.
 */
export function TrackStepper({
  entries,
  note,
  className,
}: {
  entries: StepperEntry[];
  /** Extra word on the current step, e.g. "Your drinks are on the way first". */
  note?: string;
  className?: string;
}) {
  const t = useContent('orders');
  return (
    <section className={cx(styles.card, className)} aria-labelledby="progress-heading">
      <h2 id="progress-heading" className="visually-hidden">
        {t('shared.orderProgress')}
      </h2>
      <ol className={styles.steps}>
        {entries.map((entry) => (
          <li
            key={entry.key}
            className={cx(styles.step, styles[entry.state])}
            aria-current={entry.state === 'current' ? 'step' : undefined}
          >
            <span className={styles.node} aria-hidden="true">
              <Icon name={entry.state === 'done' ? 'check' : entry.icon} size="sm" />
            </span>
            <span className={styles.title}>
              {entry.title}
              <span className="visually-hidden">
                {t('stepper.stateSuffix', { state: t(`stepper.state.${entry.state}`) })}
              </span>
            </span>
            {entry.detail && <span className={styles.detail}>{entry.detail}</span>}
          </li>
        ))}
      </ol>
      {note && (
        <p className={styles.note}>
          <Icon name="info" size="xs" />
          {note}
        </p>
      )}
    </section>
  );
}
