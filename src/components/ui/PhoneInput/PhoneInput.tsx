'use client';

import type { ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import { formatMobile } from '@/lib/format';
import { Icon } from '../Icon';
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
  /** Show the fixed "+91" country-code box (off for now at checkout). */
  showCountryCode?: boolean;
  /** Show a phone icon inside the field. */
  withIcon?: boolean;
}

/** Indian mobile number (+91). Stores digits only, shows them as "98765 43210". */
export function PhoneInput({
  id,
  label,
  value,
  onChange,
  onBlur,
  hint,
  error,
  showCountryCode = true,
  withIcon,
}: PhoneInputProps) {
  const t = useContent('common');
  return (
    <Field id={id} label={label ?? t('phone.label')} hint={hint} error={error}>
      <div className={styles.phone}>
        {showCountryCode && (
          <span className={cx(inputStyles.input, styles.cc)}>
            <span className="visually-hidden">{t('phone.countryCodeLabel')}</span>
            {t('phone.countryCode')}
          </span>
        )}
        <span className={cx(styles.inputWrap, withIcon && inputStyles.withIcon)}>
          {withIcon && <Icon name="mobile" size="sm" />}
          <input
            id={id}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder={showCountryCode ? t('phone.placeholder') : t('phone.placeholderNoCode')}
            maxLength={11}
            value={formatMobile(value)}
            onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 10))}
            onBlur={onBlur}
            className={cx(inputStyles.input, Boolean(error) && inputStyles.error)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(id, hint, error)}
          />
        </span>
      </div>
    </Field>
  );
}
