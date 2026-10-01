'use client';

import Link from 'next/link';
import type { KeyboardEvent, Ref } from 'react';
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
  /** Shows an "Esc" hint (desktop search). */
  showEscHint?: boolean;
  autoFocus?: boolean;
  id?: string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

export function SearchField({
  value,
  onChange,
  onSubmit,
  onEscape,
  showEscHint,
  autoFocus,
  id = 'search',
  className,
  ref,
}: SearchFieldProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') onSubmit?.(value);
    if (event.key === 'Escape') onEscape?.();
  };
  return (
    <div className={cx(styles.search, className)} role="search">
      <Icon name="search" size="sm" />
      <label htmlFor={id} className="visually-hidden">
        Search the menu
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
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {value ? (
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
      )}
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
    <Link href={href} className={cx(styles.search, className)}>
      <Icon name="search" size="sm" />
      <span className={styles.ph}>{SEARCH_PLACEHOLDER}</span>
    </Link>
  );
}
