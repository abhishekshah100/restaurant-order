'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { KITCHEN_NOTE_MAX } from '@/lib/constants';
import { cx } from '@/lib/cx';
import styles from './KitchenNote.module.css';

export interface KitchenNoteProps {
  value: string;
  onChange: (value: string) => void;
}

/** A slim "Add a note for the kitchen" row that expands into a text field. */
export function KitchenNote({ value, onChange }: KitchenNoteProps) {
  const [open, setOpen] = useState(value.trim() !== '');
  const t = useContent('cart');

  if (!open) {
    return (
      <button
        type="button"
        className={styles.row}
        onClick={() => setOpen(true)}
        aria-expanded={false}
      >
        <span className={styles.icon}>
          <Icon name="pencil" size="xs" />
        </span>
        <span className={styles.text}>
          <span className={styles.label}>{t('kitchenNote.add')}</span>
          <span className={styles.sub}>{t('kitchenNote.addHint')}</span>
        </span>
        <Icon name="chev" size="sm" className={styles.chev} />
      </button>
    );
  }

  return (
    <div className={cx(styles.row, styles.open)}>
      <span className={styles.icon}>
        <Icon name="pencil" size="xs" />
      </span>
      <div className={styles.field}>
        <label htmlFor="kitchen-note" className={styles.label}>
          {t('kitchenNote.label')}
        </label>
        <textarea
          id="kitchen-note"
          className={styles.input}
          placeholder={t('kitchenNote.placeholder')}
          maxLength={KITCHEN_NOTE_MAX}
          rows={2}
          value={value}
          autoFocus={value === ''}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className={styles.count} aria-hidden="true">
          {value.length}/{KITCHEN_NOTE_MAX}
        </span>
      </div>
    </div>
  );
}
