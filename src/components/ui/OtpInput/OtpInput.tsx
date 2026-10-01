'use client';

import {
  useEffect,
  useRef,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cx } from '@/lib/cx';
import { Field, describedBy } from '../Input/Field';
import styles from './OtpInput.module.css';

export interface OtpInputProps {
  id: string;
  label?: ReactNode;
  /** Digits entered so far (contiguous, 0–length characters). */
  value: string;
  onChange: (value: string) => void;
  /** Fires once all digits are present. */
  onComplete?: (value: string) => void;
  length?: number;
  error?: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
}

const onlyDigits = (text: string) => text.replace(/\D/g, '');

/**
 * Six single-digit boxes that behave like one field: typing advances,
 * Backspace steps back, arrows move, and pasting (or SMS autofill) fills every box.
 */
export function OtpInput({
  id,
  label = 'One-time code',
  value,
  onChange,
  onComplete,
  length = 6,
  error,
  hint,
  disabled,
  autoFocus,
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  // Latest value, updated synchronously on commit so focus handlers fired
  // before the next render don't see a stale prop.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const labelId = `${id}-label`;

  const focusAt = (index: number) => {
    const clamped = Math.max(0, Math.min(index, length - 1));
    const el = refs.current[clamped];
    el?.focus();
    el?.select();
  };

  const commit = (next: string, focusIndex: number) => {
    const clean = onlyDigits(next).slice(0, length);
    latest.current = clean;
    onChange(clean);
    focusAt(focusIndex);
    if (clean.length === length) onComplete?.(clean);
  };

  /** Writes `text` starting at `index`, replacing what's there. */
  const writeAt = (index: number, text: string) => {
    const digits = onlyDigits(text);
    if (!digits) return;
    const start = Math.min(index, value.length);
    const next = (value.slice(0, start) + digits + value.slice(start + digits.length)).slice(
      0,
      length,
    );
    commit(next, Math.min(start + digits.length, length - 1));
  };

  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (value[index] !== undefined) {
        commit(value.slice(0, index) + value.slice(index + 1), index);
      } else if (index > 0) {
        commit(value.slice(0, index - 1) + value.slice(index), index - 1);
      }
    } else if (event.key === 'Delete') {
      event.preventDefault();
      commit(value.slice(0, index) + value.slice(index + 1), index);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusAt(Math.min(index + 1, value.length));
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusAt(value.length);
    }
  };

  const onPaste = (index: number) => (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const digits = onlyDigits(event.clipboardData.getData('text'));
    if (!digits) return;
    // A full code always fills from the first box.
    writeAt(digits.length >= length ? 0 : index, digits);
  };

  // Keep entry contiguous: focusing past the next empty box jumps back to it.
  const onFocus = (index: number) => (event: FocusEvent<HTMLInputElement>) => {
    if (index > latest.current.length) focusAt(latest.current.length);
    else event.target.select();
  };

  return (
    <Field id={id} label={label} labelAs="span" labelId={labelId} hint={hint} error={error}>
      <div
        className={cx(styles.otp, Boolean(error) && styles.error)}
        role="group"
        aria-labelledby={labelId}
        aria-describedby={describedBy(id, hint, error)}
      >
        {Array.from({ length }, (_, index) => {
          const digit = value[index] ?? '';
          return (
            <input
              key={index}
              ref={(el) => {
                refs.current[index] = el;
              }}
              id={index === 0 ? id : `${id}-${index}`}
              className={cx(digit && styles.filled)}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={index === 0 ? length : 1}
              aria-label={`Digit ${index + 1} of ${length}`}
              aria-invalid={error ? true : undefined}
              value={digit}
              disabled={disabled}
              autoFocus={autoFocus && index === 0}
              onChange={(event) =>
                writeAt(index, event.target.value.replace(digit, '') || event.target.value)
              }
              onKeyDown={onKeyDown(index)}
              onPaste={onPaste(index)}
              onFocus={onFocus(index)}
            />
          );
        })}
      </div>
    </Field>
  );
}
