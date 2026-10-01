'use client';

import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { formatMobile } from '@/lib/format';
import { Field, describedBy } from '../Input/Field';
import inputStyles from '../Input/Input.module.css';
import styles from './PhoneInput.module.css';

export interface PhoneInputProps {
  id: string;
  label?: ReactNode;
  /** Raw digits, at most 10. */
  value: string;
  onChange: (digits: string) => void;
  onBlur?: () => void;
  hint?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
}

/** Indian mobile number (+91). Stores digits only, shows them as "98765 43210". */
export function PhoneInput({
  id,
  label = 'Mobile number',
  value,
  onChange,
  onBlur,
  hint,
  error,
  disabled,
  autoFocus,
}: PhoneInputProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <div className={styles.phone}>
        <span className={cx(inputStyles.input, styles.cc)} aria-label="Country code +91">
          +91
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="10-digit number"
          maxLength={11}
          value={formatMobile(value)}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 10))}
          onBlur={onBlur}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cx(inputStyles.input, Boolean(error) && inputStyles.error)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
        />
      </div>
    </Field>
  );
}
