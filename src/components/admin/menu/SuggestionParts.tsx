'use client';

import type { ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { Switch } from './Switch';
import styles from './SearchSuggestionsDialog.module.css';

/* Pieces both Suggestions tabs (Search, Cart) are made of. */

/** "Fill from orders": the switch, what it does, and its state in words. */
export function AutoRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className={styles.auto}>
      <div>
        <p className={styles.autoLabel}>{label}</p>
        <p className={styles.hint}>{hint}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

/** What guests see now (as saved), with a note while there are unsaved changes. */
export function GuestsSee({ dirty, children }: { dirty: boolean; children: ReactNode }) {
  const t = useContent('common');
  return (
    <div className={styles.preview}>
      <h4 className={styles.subheading}>{t('adminMenu.suggestions.guestsSee')}</h4>
      {dirty && <p className={styles.dirty}>{t('adminMenu.suggestions.unsaved')}</p>}
      {children}
    </div>
  );
}

/**
 * Where a suggestion came from: staff ("Pinned by you"), orders ("Ordered 14 times today"), or
 * the menu itself ("From the menu").
 */
export function Source({
  pinned,
  plain,
  text,
}: {
  pinned: boolean;
  plain?: boolean;
  text: string;
}) {
  return (
    <span
      className={pinned ? styles.sourcePinned : plain ? styles.sourcePlain : styles.sourceOrders}
    >
      <Icon name={pinned ? 'pin' : plain ? 'list' : 'flame'} size="xs" />
      {text}
    </span>
  );
}
