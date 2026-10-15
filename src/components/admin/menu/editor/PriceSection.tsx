'use client';

import { useContent } from '@/api/hooks';
import { Chip, Input } from '@/components/ui';
import { moveItem, newSizeRow, type DishForm, type SizeRow } from '@/lib/adminMenu';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { Switch } from '../Switch';
import { EditorSection } from './EditorSection';
import { RowButtons } from './parts';
import styles from './Editor.module.css';

/** One price, or two or more sizes (name, price, on or off) with what they're called. */
export function PriceSection({
  form,
  set,
  error,
}: {
  form: DishForm;
  set: (fields: Partial<DishForm>) => void;
  error?: string;
}) {
  const t = useContent('common');
  const { region, money } = useAdminWorkspace();
  const currency = region.currency.symbol;
  const setSize = (key: string, fields: Partial<SizeRow>) =>
    set({ sizes: form.sizes.map((s) => (s.key === key ? { ...s, ...fields } : s)) });
  const price = Number(form.price);
  const summary =
    form.pricing === 'single'
      ? t('adminMenu.editor.summary.single', {
          price: Number.isFinite(price) && price > 0 ? money.format(price) : '—',
        })
      : t.plural('adminMenu.editor.summary.sizes', form.sizes.length);

  return (
    <EditorSection
      title={t('adminMenu.editor.sections.price')}
      summary={summary}
      defaultOpen
      error={error}
    >
      <div className={styles.chips}>
        <Chip pressed={form.pricing === 'single'} onClick={() => set({ pricing: 'single' })}>
          {t('adminMenu.editor.single')}
        </Chip>
        <Chip pressed={form.pricing === 'sizes'} onClick={() => set({ pricing: 'sizes' })}>
          {t('adminMenu.editor.sizes')}
        </Chip>
      </div>
      {form.pricing === 'single' ? (
        <Input
          id="dish-price"
          label={t('adminMenu.editor.price', { currency })}
          inputMode="decimal"
          value={form.price}
          onChange={(event) => set({ price: event.target.value })}
        />
      ) : (
        <>
          <Input
            id="dish-size-label"
            label={t('adminMenu.editor.sizeLabel')}
            optional
            placeholder={t('adminMenu.editor.sizeLabelPlaceholder')}
            value={form.sizeLabel}
            onChange={(event) => set({ sizeLabel: event.target.value })}
          />
          <ul className={styles.rows}>
            {form.sizes.map((size, index) => {
              const label = size.name || String(index + 1);
              return (
                <li key={size.key} className={styles.sizeItem}>
                  <div className={styles.sizeRow}>
                    <Input
                      id={`${size.key}-name`}
                      label={t('adminMenu.editor.sizeName')}
                      hideLabel={index > 0}
                      placeholder={t('adminMenu.editor.sizeNamePlaceholder')}
                      value={size.name}
                      maxLength={40}
                      onChange={(event) => setSize(size.key, { name: event.target.value })}
                    />
                    <Input
                      id={`${size.key}-price`}
                      label={t('adminMenu.editor.sizePrice')}
                      hideLabel={index > 0}
                      inputMode="decimal"
                      placeholder={currency}
                      value={size.price}
                      onChange={(event) => setSize(size.key, { price: event.target.value })}
                    />
                    <Switch
                      checked={size.available}
                      onChange={(available) => setSize(size.key, { available })}
                      label={t('adminMenu.editor.sizeOn', { size: label })}
                    />
                    <RowButtons
                      name={label}
                      first={index === 0}
                      last={index === form.sizes.length - 1}
                      canRemove={form.sizes.length > 1}
                      removeLabel={t('adminMenu.editor.removeSize', { size: label })}
                      onMove={(by) => set({ sizes: moveItem(form.sizes, index, by) })}
                      onRemove={() => set({ sizes: form.sizes.filter((s) => s.key !== size.key) })}
                    />
                  </div>
                  <Input
                    id={`${size.key}-note`}
                    label={t('adminMenu.editor.sizeNote', { size: label })}
                    hideLabel
                    maxLength={40}
                    placeholder={t('adminMenu.editor.sizeNotePlaceholder')}
                    value={size.note}
                    onChange={(event) => setSize(size.key, { note: event.target.value })}
                  />
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className={styles.addRow}
            onClick={() => set({ sizes: [...form.sizes, newSizeRow()] })}
          >
            {t('adminMenu.editor.addSize')}
          </button>
        </>
      )}
    </EditorSection>
  );
}
