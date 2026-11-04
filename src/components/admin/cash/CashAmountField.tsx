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
 * Cash in the drawer, as a total or counted note by note (in currencies whose notes are known):
 * what to send (`amount`, and `count` when counted).
 */
export function useCashAmount(initial = '') {
  const { region } = useAdminWorkspace();
  const values = denominationsOf(region.currency.code);
  const [counting, setCounting] = useState(false);
  const [total, setTotal] = useState(initial);
  const [count, setCount] = useState<CountState>({});
  const amount: Price | null = counting ? countTotal(values, count) : parseAmount(total);
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
}: {
  id: string;
  label: string;
  hint?: string;
  cash: CashAmount;
}) {
  const t = useContent('common');
  const { region } = useAdminWorkspace();
  return (
    <div className={styles.amountField}>
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
