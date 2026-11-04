'use client';

import { useContent } from '@/api/hooks';
import { countTotal, type CountState } from '@/lib/cashRegister';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './CashRegister.module.css';

/**
 * The drawer counted note by note: how many of each (₹500 × 4), each line's value and the total.
 * The total is what's sent; the count goes with it.
 */
export function CashCounter({
  id,
  values,
  state,
  onChange,
}: {
  id: string;
  values: readonly number[];
  state: CountState;
  onChange: (next: CountState) => void;
}) {
  const t = useContent('common');
  const { money, region } = useAdminWorkspace();
  const total = countTotal(values, state);
  return (
    <fieldset className={styles.counter}>
      <legend className={styles.counterLegend}>{t('adminCash.counter.label')}</legend>
      <ul className={styles.counterRows}>
        {values.map((value) => {
          const quantity = Number(state[String(value)] ?? '') || 0;
          return (
            <li key={value} className={styles.counterRow}>
              <label htmlFor={`${id}-${String(value)}`} className={styles.counterValue}>
                {region.currency.symbol}
                {value}
              </label>
              <span aria-hidden="true">×</span>
              <input
                id={`${id}-${String(value)}`}
                className={styles.counterInput}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoComplete="off"
                aria-label={t('adminCash.counter.quantity', {
                  value: `${region.currency.symbol}${String(value)}`,
                })}
                value={state[String(value)] ?? ''}
                onChange={(event) =>
                  onChange({ ...state, [String(value)]: event.target.value.replace(/\D/g, '') })
                }
              />
              <span className={styles.counterLine}>
                {quantity > 0 ? money.format(value * quantity) : ''}
              </span>
            </li>
          );
        })}
      </ul>
      <p className={styles.counterTotal} aria-live="polite">
        {t('adminCash.counter.total', { amount: money.format(total) })}
      </p>
    </fieldset>
  );
}
