'use client';

import Link from 'next/link';
import type { KeyboardEvent, ReactNode, Ref } from 'react';
import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton/IconButton';
import styles from './SearchField.module.css';

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
  /** Id of a suggestions region the field drives. */
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
  'aria-controls': ariaControls,
}: SearchFieldProps) {
  const t = useContent('common');
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') onSubmit?.(value);
    if (event.key === 'Escape') onEscape?.();
  };
  return (
    <div className={cx(styles.search, className)} role="search">
      <Icon name="search" size="sm" />
      <label htmlFor={id} className="visually-hidden">
        {t('search.label')}
      </label>
      <input
        ref={ref}
        id={id}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder={t('search.placeholder')}
        value={value}
        autoFocus={autoFocus}
        aria-controls={ariaControls}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
      />
      {trailing ??
        (value ? (
          <IconButton
            icon="xc"
            label={t('search.clear')}
            size="sm"
            onClick={() => onChange('')}
            className={styles.clear}
          />
        ) : (
          showEscHint && (
            <span className={styles.kbd} aria-hidden="true">
              {t('search.escHint')}
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
  const t = useContent('common');
  return (
    <Link href={href} className={cx(styles.search, className)} aria-label={t('search.openLabel')}>
      <Icon name="search" size="sm" />
      <span className={styles.ph}>{t('search.placeholder')}</span>
    </Link>
  );
}
