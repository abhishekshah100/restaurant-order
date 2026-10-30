import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui';
import { cx } from '@/lib/cx';
import type { Price } from '@/types/menu';
import styles from './PaymentFields.module.css';

/*
 * The fields the collect and refund dialogs share: a set of tiles to choose one of (native
 * radios, so the arrow keys move between them), a money amount typed in, and a summary row.
 */

export interface TileChoice<T extends string> {
  id: T;
  label: ReactNode;
  icon?: IconName;
  sub?: ReactNode;
}

export function RadioTiles<T extends string>({
  name,
  legend,
  choices,
  value,
  onChange,
  columns = 3,
  compact = false,
}: {
  name: string;
  legend: ReactNode;
  choices: readonly TileChoice<T>[];
  value: T;
  onChange: (id: T) => void;
  columns?: 2 | 3 | 4;
  /** One short row: icon beside the label. */
  compact?: boolean;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={cx(styles.tiles, styles[`cols${columns}`], compact && styles.compact)}>
        {choices.map((choice) => (
          <label key={choice.id} className={styles.tile}>
            <input
              type="radio"
              name={name}
              value={choice.id}
              checked={value === choice.id}
              onChange={() => onChange(choice.id)}
              className={styles.radio}
            />
            {choice.icon && <Icon name={choice.icon} size="sm" className={styles.tileIcon} />}
            <span className={styles.tileLabel}>{choice.label}</span>
            {choice.sub && <span className={styles.tileSub}>{choice.sub}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A whole money amount as typed ("1,250" → 1250), or null when it isn't one. */
export function parseAmount(text: string): Price | null {
  const clean = text.replace(/[,\s]/g, '');
  if (!/^\d+$/.test(clean)) return null;
  return Number(clean);
}

/** Only the digits of what was typed or pasted: amounts are whole numbers. */
export const digitsOnly = (text: string) => text.replace(/\D/g, '');

/** A labelled money input with the currency's symbol in front; takes digits only. */
export function AmountInput({
  id,
  label,
  value,
  onChange,
  symbol,
  hint,
  error,
  compact = false,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (text: string) => void;
  symbol: string;
  hint?: ReactNode;
  error?: ReactNode;
  /** A smaller box, for a second amount under the main one. */
  compact?: boolean;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.legend}>
        {label}
      </label>
      <div
        className={cx(
          styles.amountBox,
          compact && styles.compactBox,
          Boolean(error) && styles.invalid,
        )}
      >
        <span className={styles.symbol} aria-hidden="true">
          {symbol}
        </span>
        <input
          id={id}
          className={styles.amountInput}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={9}
          autoComplete="off"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(digitsOnly(event.target.value))}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className={styles.hint}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Label and amount rows (a bill), the last one stressed when `total`. */
export function SumRows({
  rows,
}: {
  rows: readonly { label: ReactNode; value: ReactNode; tone?: 'total' | 'ok' | 'muted' | 'due' }[];
}) {
  return (
    <dl className={styles.sums}>
      {rows.map((row, index) => (
        <div key={index} className={cx(styles.sum, row.tone && styles[row.tone])}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
