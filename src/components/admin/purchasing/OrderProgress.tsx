'use client';

import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { ORDER_STEPS, progressOf } from '@/lib/purchasingFlow';
import type { PoStatus } from '@/types/purchasing';
import styles from './Purchasing.module.css';

/**
 * Where an order is, as three steps with a line between: Placed → Sent → Arrived. Done steps are
 * ticked, the one it's on is marked; a cancelled order says so instead.
 */
export function OrderProgress({ status }: { status: PoStatus }) {
  const t = useContent('common');
  const { done, stopped } = progressOf(status);
  if (stopped) {
    return (
      <p className={styles.stopped}>
        <Icon name="xc" size="xs" />
        {t('adminPurchasing.status.cancelled')}
      </p>
    );
  }
  return (
    <ol className={styles.flow} aria-label={t('adminPurchasing.flow.label')}>
      {ORDER_STEPS.map((step, index) => {
        const state = index < done ? 'done' : index === done ? 'now' : 'later';
        return (
          <li key={step} className={styles.flowStep} data-state={state}>
            <span className={styles.flowDot} aria-hidden="true">
              {state === 'done' && <Icon name="check" size="xs" />}
            </span>
            <span className={styles.flowLabel}>
              {t(`adminPurchasing.flow.${step}`)}
              <span className="visually-hidden"> {t(`adminPurchasing.flow.states.${state}`)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
