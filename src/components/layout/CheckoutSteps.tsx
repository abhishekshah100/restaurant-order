'use client';

import { Fragment } from 'react';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import styles from './CheckoutSteps.module.css';

export type CheckoutStep = 'details' | 'verify' | 'pay';

const MOBILE: readonly CheckoutStep[] = ['details', 'verify', 'pay'];

const DESKTOP = ['cart', ...MOBILE] as const;

/** Step names from common.json (the cart step reuses the cart's label). */
function useStepLabel(): (step: (typeof DESKTOP)[number]) => string {
  const t = useContent('common');
  return (step) => (step === 'cart' ? t('cart.label') : t(`checkoutSteps.${step}`));
}

/** Mobile checkout progress: 3 segments under the top bar. */
export function CheckoutProgress({ current }: { current: CheckoutStep }) {
  const t = useContent('common');
  const stepLabel = useStepLabel();
  const index = MOBILE.indexOf(current);
  return (
    <div className={cx(styles.mobile, 'hide-desktop')}>
      <div className={styles.seg} aria-hidden="true">
        {MOBILE.map((s, i) => (
          <i key={s} className={cx(i < index && styles.done, i === index && styles.cur)} />
        ))}
      </div>
      <ol className={styles.labels} aria-label={t('checkoutSteps.label')}>
        {MOBILE.map((s, i) => (
          <li
            key={s}
            className={cx(i <= index && styles.on)}
            aria-current={i === index ? 'step' : undefined}
          >
            {t('checkoutSteps.numbered', { n: i + 1, step: stepLabel(s) })}
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
  const t = useContent('common');
  const stepLabel = useStepLabel();
  const index = DESKTOP.indexOf(current);
  return (
    <ol className={cx(styles.bar, className)} aria-label={t('checkoutSteps.label')}>
      {DESKTOP.map((s, i) => (
        <Fragment key={s}>
          {i > 0 && (
            <li className={cx(styles.line, i <= index && styles.lineDone)} aria-hidden="true" />
          )}
          <li
            className={cx(styles.step, i < index && styles.stepDone, i === index && styles.stepCur)}
            aria-current={i === index ? 'step' : undefined}
          >
            <span className={styles.d}>
              {i < index ? <Icon name="check" size="xs" label={t('checkoutSteps.done')} /> : i + 1}
            </span>
            {stepLabel(s)}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
