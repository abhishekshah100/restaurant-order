'use client';

import type { ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import { formatMobile, mobileDigits, mobileInputLength } from '@/lib/phone';
import type { MobileRules } from '@/types/branch';
import { Icon } from '../Icon';
import { Field, describedBy } from '../Input/Field';
import inputStyles from '../Input/Input.module.css';
import styles from './PhoneInput.module.css';

export interface PhoneInputProps {
  id: string;
  label?: ReactNode;
  /** The branch's mobile-number rules (useRegion().mobile): dial code, length, grouping. */
  rules: MobileRules;
  /** Raw digits, at most `rules.length`. */
  value: string;
  onChange: (digits: string) => void;
  onBlur?: () => void;
  hint?: ReactNode;
  error?: ReactNode;
  /** Show the fixed dial-code box ("+977"). */
  showCountryCode?: boolean;
  /** Show a phone icon inside the field. */
  withIcon?: boolean;
}

/** A national mobile number. Stores digits only, shows them grouped ("98765 43210", "984-1234567"). */
export function PhoneInput({
  id,
  label,
  rules,
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
            {rules.dialCode}
          </span>
        )}
        <span className={cx(styles.inputWrap, withIcon && inputStyles.withIcon)}>
          {withIcon && <Icon name="mobile" size="sm" />}
          <input
            id={id}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder={t(showCountryCode ? 'phone.placeholder' : 'phone.placeholderNoCode', {
              length: rules.length,
            })}
            maxLength={mobileInputLength(rules)}
            value={formatMobile(value, rules)}
            onChange={(event) => onChange(mobileDigits(event.target.value, rules))}
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
