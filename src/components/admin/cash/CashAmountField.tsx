'use client';

import { useState } from 'react';
import type { DrawerCount } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { countOf, countTotal, denominationsOf, type CountState } from '@/lib/cashRegister';
import type { Price } from '@/types/menu';
import { AmountInput, parseAmount } from '../payments/PaymentFields';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { CashCounter } from './CashCounter';
import styles from './CashRegister.module.css';

/**
 * Cash in the drawer, counted note by note (where the currency's notes are known: the way staff
 * count, so it's where it starts) or typed as a total: what to send (`amount`, and `count` when
 * counted).
 */
export function useCashAmount(initial = '') {
  const { region } = useAdminWorkspace();
  const values = denominationsOf(region.currency.code);
  const [counting, setCounting] = useState(values.length > 0 && !initial);
  const [total, setTotal] = useState(initial);
  const [count, setCount] = useState<CountState>({});
  // Counting: nothing typed yet is no amount (not ₹0), so nothing goes until something's counted.
  const typed = Object.values(count).some((v) => v !== '');
  const amount: Price | null = counting
    ? typed
      ? countTotal(values, count)
      : null
    : parseAmount(total);
  const counted: DrawerCount | undefined = counting ? countOf(values, count) : undefined;
  return {
    values,
    counting,
    setCounting,
    total,
    setTotal,
    count,
    setCount,
    amount,
    counted,
    reset: () => {
      setTotal('');
      setCount({});
    },
  };
}

export type CashAmount = ReturnType<typeof useCashAmount>;

export function CashAmountField({
  id,
  label,
  hint,
  cash,
  suggestion,
}: {
  id: string;
  label: string;
  hint?: string;
  cash: CashAmount;
  /** A one-tap amount ("Same as last close: ₹2,000"): typed in as the total. */
  suggestion?: { label: string; amount: Price };
}) {
  const t = useContent('common');
  const { region } = useAdminWorkspace();
  const suggested = suggestion && !cash.counting && parseAmount(cash.total) === suggestion.amount;
  return (
    <div className={styles.amountField}>
      {suggestion && (
        <button
          type="button"
          className={styles.suggestion}
          aria-pressed={suggested}
          onClick={() => {
            cash.setCounting(false);
            cash.setTotal(String(suggestion.amount));
          }}
        >
          <Icon name={suggested ? 'checkc' : 'history'} size="xs" />
          {suggestion.label}
        </button>
      )}
      {cash.counting ? (
        <CashCounter
          id={`${id}-count`}
          values={cash.values}
          state={cash.count}
          onChange={cash.setCount}
        />
      ) : (
        <AmountInput
          id={id}
          label={label}
          symbol={region.currency.symbol}
          value={cash.total}
          onChange={cash.setTotal}
          hint={hint}
        />
      )}
      {cash.values.length > 0 && (
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => cash.setCounting(!cash.counting)}
        >
          <Icon name={cash.counting ? 'pencil' : 'cash'} size="xs" />
          {cash.counting ? t('adminCash.open.total') : t('adminCash.open.count')}
        </button>
      )}
    </div>
  );
}
