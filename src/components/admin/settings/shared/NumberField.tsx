'use client';

import type { ReactNode } from 'react';
import { Input } from '@/components/ui';
import { formatDecimal, parseDecimal, parseWhole, useNumberText } from './SettingsEditor';

/**
 * A number typed as text: a whole number (minutes, km) or a decimal with up to two places
 * (money, a percentage). Empty is `undefined` (for an optional value), anything that isn't a
 * number is NaN, so the page's checks catch it.
 */
export function NumberField({
  id,
  label,
  value,
  onChange,
  whole = false,
  hint,
  error,
  optional,
  placeholder,
  className,
}: {
  id: string;
  label: ReactNode;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** Whole numbers only. */
  whole?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const parse = whole ? parseWhole : parseDecimal;
  const [text, setText] = useNumberText(value, formatDecimal, parse);
  return (
    <Input
      id={id}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      placeholder={placeholder}
      className={className}
      inputMode={whole ? 'numeric' : 'decimal'}
      autoComplete="off"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        onChange(parse(event.target.value));
      }}
    />
  );
}
