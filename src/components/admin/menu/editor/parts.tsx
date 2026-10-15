'use client';

import { useContent } from '@/api/hooks';
import { Chip, IconButton } from '@/components/ui';
import type { SizeRow } from '@/lib/adminMenu';
import styles from './Editor.module.css';

/*
 * Small pieces the editor's sections share: which sizes something is offered with, and the
 * move up / move down / remove buttons on a row.
 */

/** "Offered with: All sizes · Half · Full" — none picked means every size. */
export function SizePicker({
  sizes,
  value,
  onChange,
}: {
  sizes: readonly SizeRow[];
  value: readonly string[];
  onChange: (keys: string[]) => void;
}) {
  const t = useContent('common');
  const named = sizes.filter((s) => s.name.trim());
  if (named.length < 2) return null;
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <div className={styles.sizePicker} role="group" aria-label={t('adminMenu.editor.onlyWith')}>
      <span className={styles.pickerLabel}>{t('adminMenu.editor.onlyWith')}</span>
      <Chip pressed={value.length === 0} onClick={() => onChange([])}>
        {t('adminMenu.editor.allSizes')}
      </Chip>
      {named.map((s) => (
        <Chip key={s.key} pressed={value.includes(s.key)} onClick={() => toggle(s.key)}>
          {s.name}
        </Chip>
      ))}
    </div>
  );
}

/** Move up and down (with `onMove`) and remove (with `onRemove`), for a row named `name`. */
export function RowButtons({
  name,
  first,
  last,
  canRemove = true,
  removeLabel,
  onMove,
  onRemove,
}: {
  name: string;
  first: boolean;
  last: boolean;
  canRemove?: boolean;
  removeLabel?: string;
  onMove?: (by: -1 | 1) => void;
  onRemove?: () => void;
}) {
  const t = useContent('common');
  return (
    <span className={styles.rowButtons}>
      {onMove && (
        <>
          <IconButton
            icon="chevd"
            size="sm"
            className={styles.up}
            disabled={first}
            label={t('adminMenu.editor.moveUp', { name })}
            onClick={() => onMove(-1)}
          />
          <IconButton
            icon="chevd"
            size="sm"
            disabled={last}
            label={t('adminMenu.editor.moveDown', { name })}
            onClick={() => onMove(1)}
          />
        </>
      )}
      {onRemove && removeLabel && (
        <IconButton
          icon="trash"
          size="sm"
          disabled={!canRemove}
          label={removeLabel}
          onClick={onRemove}
        />
      )}
    </span>
  );
}
