import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from '../Icon';
import { Field, describedBy } from './Field';
import styles from './Input.module.css';

interface FieldBits {
  id: string;
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  hideLabel?: boolean;
  className?: string;
  /** Icon shown inside the field on the left. */
  icon?: IconName;
}

export interface InputProps
  extends FieldBits, Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {}

export function Input({
  id,
  label,
  optional,
  hint,
  error,
  hideLabel,
  className,
  icon,
  ...rest
}: InputProps) {
  return (
    <Field
      id={id}
      label={label}
      optional={optional}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      className={className}
    >
      {icon ? (
        <span className={styles.withIcon}>
          <Icon name={icon} size="sm" />
          <input
            {...rest}
            id={id}
            className={cx(styles.input, Boolean(error) && styles.error)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(id, hint, error)}
          />
        </span>
      ) : (
        <input
          {...rest}
          id={id}
          className={cx(styles.input, Boolean(error) && styles.error)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
        />
      )}
    </Field>
  );
}

export interface TextareaProps
  extends FieldBits, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'> {}

export function Textarea({
  id,
  label,
  optional,
  hint,
  error,
  hideLabel,
  className,
  ...rest
}: TextareaProps) {
  return (
    <Field
      id={id}
      label={label}
      optional={optional}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      className={className}
    >
      <textarea
        {...rest}
        id={id}
        className={cx(styles.input, Boolean(error) && styles.error)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
      />
    </Field>
  );
}

export interface SelectProps
  extends FieldBits, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className'> {
  /** The <option> / <optgroup> elements. */
  children: ReactNode;
}

/** A native select styled as a field, with a chevron (e.g. a delivery area). */
export function Select({
  id,
  label,
  optional,
  hint,
  error,
  hideLabel,
  className,
  icon,
  children,
  ...rest
}: SelectProps) {
  return (
    <Field
      id={id}
      label={label}
      optional={optional}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      className={className}
    >
      <span className={cx(styles.selectWrap, icon && styles.withIcon)}>
        {icon && <Icon name={icon} size="sm" />}
        <select
          {...rest}
          id={id}
          className={cx(styles.input, styles.select, Boolean(error) && styles.error)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
        >
          {children}
        </select>
        <Icon name="chevd" size="sm" className={styles.selectChev} />
      </span>
    </Field>
  );
}
