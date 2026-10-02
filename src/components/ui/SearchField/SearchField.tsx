'use client';

import Link from 'next/link';
import type { KeyboardEvent, ReactNode, Ref } from 'react';
import { cx } from '@/lib/cx';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton/IconButton';
import styles from './SearchField.module.css';

export const SEARCH_PLACEHOLDER = 'Search dishes, drinks…';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  onEscape?: () => void;
  onFocus?: () => void;
  /** Shows an "Esc" hint when empty (desktop search). */
  showEscHint?: boolean;
  /** Replaces the clear button, e.g. a spinner while searching. */
  trailing?: ReactNode;
  autoFocus?: boolean;
  id?: string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
}

export function SearchField({
  value,
  onChange,
  onSubmit,
  onEscape,
  onFocus,
  showEscHint,
  trailing,
  autoFocus,
  id = 'search',
  className,
  ref,
  'aria-expanded': ariaExpanded,
  'aria-controls': ariaControls,
}: SearchFieldProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') onSubmit?.(value);
    if (event.key === 'Escape') onEscape?.();
  };
  return (
    <div className={cx(styles.search, className)} role="search">
      <Icon name="search" size="sm" />
      <label htmlFor={id} className="visually-hidden">
        Search dishes and drinks
      </label>
      <input
        ref={ref}
        id={id}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder={SEARCH_PLACEHOLDER}
        value={value}
        autoFocus={autoFocus}
        role={ariaExpanded !== undefined ? 'combobox' : undefined}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        aria-autocomplete={ariaExpanded !== undefined ? 'list' : undefined}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
      />
      {trailing ??
        (value ? (
          <IconButton
            icon="xc"
            label="Clear search"
            size="sm"
            onClick={() => onChange('')}
            className="c3"
          />
        ) : (
          showEscHint && (
            <span className={styles.kbd} aria-hidden="true">
              Esc
            </span>
          )
        ))}
    </div>
  );
}

export interface SearchLinkProps {
  href?: string;
  className?: string;
}

/** Read-only search bar that opens the search route. */
export function SearchLink({ href = '/search/', className }: SearchLinkProps) {
  return (
    <Link href={href} className={cx(styles.search, className)} aria-label="Search the menu">
      <Icon name="search" size="sm" />
      <span className={styles.ph}>{SEARCH_PLACEHOLDER}</span>
    </Link>
  );
}
