'use client';

import { useContent } from '@/api/hooks';
import { MAX_QUANTITY } from '@/lib/constants';
import { cx } from '@/lib/cx';
import { Icon } from '../Icon';
import styles from './QuantityStepper.module.css';

export interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  /** Lowest value "−" can reach. Use 0 in carts, where going to 0 removes the line. */
  min?: number;
  max?: number;
  variant?: 'filled' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  /** Used in button labels: "Remove one Paneer Tikka". */
  itemName?: string;
  className?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = MAX_QUANTITY,
  variant = 'filled',
  size = 'md',
  itemName,
  className,
}: QuantityStepperProps) {
  const t = useContent('common');
  const canDecrement = value > min;
  const canIncrement = value < max;

  return (
    <div
      className={cx(
        styles.qty,
        variant === 'outline' && styles.outline,
        size === 'lg' && styles.lg,
        size === 'sm' && styles.sm,
        className,
      )}
      role="group"
      aria-label={itemName ? t('quantity.labelFor', { item: itemName }) : t('quantity.label')}
    >
      <button
        type="button"
        className={styles.step}
        aria-label={
          itemName ? t('quantity.removeOneFor', { item: itemName }) : t('quantity.removeOne')
        }
        disabled={!canDecrement}
        onClick={() => canDecrement && onChange(value - 1)}
      >
        <Icon name="minus" size="sm" />
      </button>
      <output className={styles.n} aria-live="polite" aria-atomic="true">
        {value}
      </output>
      <button
        type="button"
        className={styles.step}
        aria-label={itemName ? t('quantity.addOneFor', { item: itemName }) : t('quantity.addOne')}
        disabled={!canIncrement}
        onClick={() => canIncrement && onChange(value + 1)}
      >
        <Icon name="plus" size="sm" />
      </button>
    </div>
  );
}
