'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Chip, Input } from '@/components/ui';
import { newNameRow, type DishForm, type NameRow } from '@/lib/adminMenu';
import { EditorSection } from './EditorSection';
import { RowButtons } from './parts';
import styles from './Editor.module.css';

const QUICK_MAX = 10;

/** Ingredients guests can leave out ("No onion"), and quick notes they can tap for the kitchen. */
export function LeaveOutSection({
  form,
  set,
  error,
}: {
  form: DishForm;
  set: (fields: Partial<DishForm>) => void;
  error?: string;
}) {
  const t = useContent('common');
  const [note, setNote] = useState('');
  const setRow = (key: string, fields: Partial<NameRow>) =>
    set({ removables: form.removables.map((r) => (r.key === key ? { ...r, ...fields } : r)) });
  const items = form.removables.length + form.quickInstructions.length;
  const addNote = () => {
    const value = note.trim();
    if (!value || form.quickInstructions.some((q) => q.toLowerCase() === value.toLowerCase())) {
      return;
    }
    set({ quickInstructions: [...form.quickInstructions, value] });
    setNote('');
  };

  return (
    <EditorSection
      title={t('adminMenu.editor.sections.leaveOut')}
      summary={
        items > 0
          ? t.plural('adminMenu.editor.summary.items', items)
          : t('adminMenu.editor.summary.none')
      }
      error={error}
    >
      <p className={styles.hint}>{t('adminMenu.editor.leaveOutHint')}</p>
      {form.removables.length > 0 && (
        <ul className={styles.rows}>
          {form.removables.map((row, index) => {
            const label = row.name || String(index + 1);
            return (
              <li key={row.key} className={styles.nameRow}>
                <Input
                  id={`${row.key}-name`}
                  label={t('adminMenu.editor.ingredient')}
                  hideLabel={index > 0}
                  placeholder={t('adminMenu.editor.ingredientPlaceholder')}
                  value={row.name}
                  maxLength={40}
                  onChange={(event) => setRow(row.key, { name: event.target.value })}
                />
                <RowButtons
                  name={label}
                  first={index === 0}
                  last={index === form.removables.length - 1}
                  removeLabel={t('adminMenu.editor.removeIngredient', { ingredient: label })}
                  onRemove={() =>
                    set({ removables: form.removables.filter((r) => r.key !== row.key) })
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        className={styles.addRow}
        onClick={() => set({ removables: [...form.removables, newNameRow()] })}
      >
        {t('adminMenu.editor.addIngredient')}
      </button>

      <div className={styles.quick}>
        <span className={styles.legend}>{t('adminMenu.editor.quick')}</span>
        <p className={styles.hint}>{t('adminMenu.editor.quickHint')}</p>
        {form.quickInstructions.length > 0 && (
          <div className={styles.chips}>
            {form.quickInstructions.map((q) => (
              <Chip
                key={q}
                iconEnd="x"
                aria-label={t('adminMenu.editor.removeQuick', { note: q })}
                onClick={() =>
                  set({ quickInstructions: form.quickInstructions.filter((x) => x !== q) })
                }
              >
                {q}
              </Chip>
            ))}
          </div>
        )}
        {form.quickInstructions.length < QUICK_MAX && (
          <div className={styles.quickAdd}>
            <Input
              id="dish-quick-note"
              label={t('adminMenu.editor.quick')}
              hideLabel
              maxLength={30}
              placeholder={t('adminMenu.editor.quickPlaceholder')}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addNote();
                }
              }}
            />
            <Button size="sm" variant="secondary" onClick={addNote}>
              {t('adminMenu.editor.addQuick')}
            </Button>
          </div>
        )}
      </div>
    </EditorSection>
  );
}
