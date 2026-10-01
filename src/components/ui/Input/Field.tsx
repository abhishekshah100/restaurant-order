import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './Input.module.css';

export interface FieldProps {
  id: string;
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  /** Render the label visually hidden (still read by screen readers). */
  hideLabel?: boolean;
  /** Use a <span> instead of <label> (for grouped controls such as OTP). */
  labelAs?: 'label' | 'span';
  labelId?: string;
  children: ReactNode;
  className?: string;
}

export const hintId = (id: string) => `${id}-hint`;
export const errorId = (id: string) => `${id}-error`;

export function describedBy(id: string, hint?: ReactNode, error?: ReactNode): string | undefined {
  const ids = [hint ? hintId(id) : null, error ? errorId(id) : null].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

export function Field({
  id,
  label,
  optional,
  hint,
  error,
  hideLabel,
  labelAs = 'label',
  labelId,
  children,
  className,
}: FieldProps) {
  const LabelTag = labelAs;
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <LabelTag
        id={labelId}
        className={hideLabel ? 'visually-hidden' : styles.label}
        htmlFor={labelAs === 'label' ? id : undefined}
      >
        {label}
        {optional && <span className={styles.optional}> (optional)</span>}
      </LabelTag>
      {children}
      {error ? (
        <p id={errorId(id)} className={styles.err} role="alert">
          <Icon name="alert" size="xs" />
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId(id)} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
