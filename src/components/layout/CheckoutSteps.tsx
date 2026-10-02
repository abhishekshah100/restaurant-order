import { Fragment } from 'react';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import styles from './CheckoutSteps.module.css';

export type CheckoutStep = 'details' | 'verify' | 'pay';

const MOBILE: { id: CheckoutStep; label: string }[] = [
  { id: 'details', label: '1 · Details' },
  { id: 'verify', label: '2 · Verify' },
  { id: 'pay', label: '3 · Pay' },
];

const DESKTOP = [
  { id: 'cart', label: 'Cart' },
  { id: 'details', label: 'Details' },
  { id: 'verify', label: 'Verify' },
  { id: 'pay', label: 'Pay' },
] as const;

/** Mobile checkout progress: 3 segments under the top bar. */
export function CheckoutProgress({ current }: { current: CheckoutStep }) {
  const index = MOBILE.findIndex((s) => s.id === current);
  return (
    <div className={cx(styles.mobile, 'hide-desktop')}>
      <div className={styles.seg} aria-hidden="true">
        {MOBILE.map((s, i) => (
          <i key={s.id} className={cx(i < index && styles.done, i === index && styles.cur)} />
        ))}
      </div>
      <ol className={styles.labels} aria-label="Checkout progress">
        {MOBILE.map((s, i) => (
          <li
            key={s.id}
            className={cx(i <= index && styles.on)}
            aria-current={i === index ? 'step' : undefined}
          >
            {s.label}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Desktop checkout steps (Cart · Details · Verify · Pay) shown in the header. */
export function CheckoutStepsBar({
  current,
  className,
}: {
  current: CheckoutStep;
  className?: string;
}) {
  const index = DESKTOP.findIndex((s) => s.id === current);
  return (
    <ol className={cx(styles.bar, className)} aria-label="Checkout progress">
      {DESKTOP.map((s, i) => (
        <Fragment key={s.id}>
          {i > 0 && (
            <li className={cx(styles.line, i <= index && styles.lineDone)} aria-hidden="true" />
          )}
          <li
            className={cx(styles.step, i < index && styles.stepDone, i === index && styles.stepCur)}
            aria-current={i === index ? 'step' : undefined}
          >
            <span className={styles.d}>
              {i < index ? <Icon name="check" size="xs" label="Done:" /> : i + 1}
            </span>
            {s.label}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
