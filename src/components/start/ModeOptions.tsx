'use client';

import { useRef, type KeyboardEvent } from 'react';
import { useContent } from '@/api/hooks';
import { Icon, type IconName } from '@/components/ui';
import { branchModes, deliverySummary } from '@/lib/fulfilment';
import { createMoney } from '@/lib/money';
import { cx } from '@/lib/cx';
import type { Branch, OrderMode } from '@/types/branch';
import styles from './ModeOptions.module.css';

export const MODE_ICON: Record<OrderMode, IconName> = {
  dineIn: 'table',
  takeaway: 'bag',
  delivery: 'scooter',
};

export interface ModeOptionsProps {
  branch: Branch;
  value: OrderMode | null;
  onChange: (mode: OrderMode) => void;
  /** The table a QR code was scanned at, at this branch: dine-in needs one. */
  scannedTable: number | null;
  /** Accessible name of the radio group. */
  label: string;
  /** Marks the guest's current mode. */
  current?: OrderMode;
  className?: string;
}

const NEXT_KEYS = ['ArrowDown', 'ArrowRight'];
const PREV_KEYS = ['ArrowUp', 'ArrowLeft'];

/**
 * The ways a branch takes orders, as radio cards: dine-in (only with a table QR scan, otherwise
 * it says to scan one), takeaway (ready time) and delivery (time range and lowest fee).
 */
export function ModeOptions({
  branch,
  value,
  onChange,
  scannedTable,
  label,
  current,
  className,
}: ModeOptionsProps) {
  const t = useContent('home');
  const groupRef = useRef<HTMLDivElement>(null);
  const money = createMoney(branch);
  const modes = branchModes(branch);
  const available = (mode: OrderMode) => mode !== 'dineIn' || scannedTable !== null;
  const choosable = modes.filter(available);

  const sub = (mode: OrderMode): string => {
    if (mode === 'dineIn') {
      return scannedTable === null
        ? t('start.modes.dineIn.unavailable')
        : t('start.modes.dineIn.tableReady', { table: scannedTable });
    }
    if (mode === 'takeaway') {
      return t('start.modes.takeaway.sub', { minutes: branch.modes.takeaway.prepMinutes });
    }
    const summary = deliverySummary(branch.modes.delivery.zones);
    return t('start.modes.delivery.sub', {
      min: summary.etaMin,
      max: summary.etaMax,
      fee: money.format(summary.fee),
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = NEXT_KEYS.includes(event.key) ? 1 : PREV_KEYS.includes(event.key) ? -1 : 0;
    if (step === 0 || choosable.length === 0) return;
    event.preventDefault();
    const index = value ? choosable.indexOf(value) : -1;
    const next = choosable[(index + step + choosable.length) % choosable.length];
    onChange(next);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
  };

  // Roving focus: the chosen card, or the first one that can be chosen.
  const focusable = value && available(value) ? value : choosable[0];

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      className={cx(styles.options, className)}
    >
      {modes.map((mode) => {
        const on = value === mode;
        const disabled = !available(mode);
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            data-mode={mode}
            aria-checked={on}
            aria-disabled={disabled || undefined}
            tabIndex={mode === focusable ? 0 : -1}
            className={cx(styles.option, on && styles.on, disabled && styles.disabled)}
            onClick={() => !disabled && onChange(mode)}
            onKeyDown={onKeyDown}
          >
            <span className={styles.badge} aria-hidden="true">
              <Icon name={MODE_ICON[mode]} />
            </span>
            <span className={styles.body}>
              <span className={styles.title}>
                {t(`start.modes.${mode}.title`)}
                {current === mode && (
                  <span className={styles.current}>{t('modeSwitch.current')}</span>
                )}
              </span>
              <span className={styles.sub}>
                {disabled && <Icon name="qr" size="xs" />}
                {sub(mode)}
              </span>
            </span>
            <span className={styles.radio} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
