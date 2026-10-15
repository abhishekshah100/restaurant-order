'use client';

import { useContent } from '@/api/hooks';
import { Input } from '@/components/ui';
import { moveItem, newAddOnRow, type AddOnRow, type DishForm } from '@/lib/adminMenu';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { Switch } from '../Switch';
import { EditorSection } from './EditorSection';
import { RowButtons, SizePicker } from './parts';
import styles from './Editor.module.css';

/**
 * Add-ons: extras a guest can add (free or priced; with sizes, optionally a price per size or
 * only with some sizes), and the most a guest can pick.
 */
export function AddOnsSection({
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
  const sized = form.pricing === 'sizes';
  const setAddOn = (key: string, fields: Partial<AddOnRow>) =>
    set({ addOns: form.addOns.map((a) => (a.key === key ? { ...a, ...fields } : a)) });
  const summary =
    form.addOns.length === 0
      ? t('adminMenu.editor.summary.none')
      : [
          t.plural('adminMenu.editor.summary.addOns', form.addOns.length),
          ...(form.maxAddOns.trim()
            ? [t('adminMenu.editor.summary.upTo', { count: form.maxAddOns.trim() })]
            : []),
        ].join(' · ');

  return (
    <EditorSection title={t('adminMenu.editor.sections.addOns')} summary={summary} error={error}>
      <p className={styles.hint}>{t('adminMenu.editor.addOnsHint')}</p>
      {form.addOns.length > 0 && (
        <ul className={styles.rows}>
          {form.addOns.map((addOn, index) => {
            const label = addOn.name || String(index + 1);
            return (
              <li key={addOn.key} className={styles.card}>
                <div className={styles.choiceRow}>
                  <Input
                    id={`${addOn.key}-name`}
                    label={t('adminMenu.editor.addOnName')}
                    placeholder={t('adminMenu.editor.addOnNamePlaceholder')}
                    value={addOn.name}
                    maxLength={60}
                    onChange={(event) => setAddOn(addOn.key, { name: event.target.value })}
                  />
                  <Input
                    id={`${addOn.key}-price`}
                    label={t('adminMenu.editor.addOnPrice', { currency })}
                    inputMode="decimal"
                    placeholder={money.format(0)}
                    value={addOn.price}
                    onChange={(event) => setAddOn(addOn.key, { price: event.target.value })}
                  />
                  <RowButtons
                    name={label}
                    first={index === 0}
                    last={index === form.addOns.length - 1}
                    removeLabel={t('adminMenu.editor.removeAddOn', { addOn: label })}
                    onMove={(by) => set({ addOns: moveItem(form.addOns, index, by) })}
                    onRemove={() => set({ addOns: form.addOns.filter((a) => a.key !== addOn.key) })}
                  />
                </div>
                {sized && (
                  <>
                    <SizePicker
                      sizes={form.sizes}
                      value={addOn.onlySizes}
                      onChange={(onlySizes) => setAddOn(addOn.key, { onlySizes })}
                    />
                    <label className={styles.toggleRow}>
                      <span>{t('adminMenu.editor.perSize')}</span>
                      <Switch
                        checked={addOn.sizePrices !== null}
                        label={t('adminMenu.editor.perSize')}
                        onChange={(on) =>
                          setAddOn(addOn.key, {
                            sizePrices: on
                              ? Object.fromEntries(form.sizes.map((s) => [s.key, '']))
                              : null,
                          })
                        }
                      />
                    </label>
                    {addOn.sizePrices && (
                      <div className={styles.sizePrices}>
                        <p className={styles.hint}>{t('adminMenu.editor.perSizeHint')}</p>
                        {form.sizes.map((s, i) => (
                          <Input
                            key={s.key}
                            id={`${addOn.key}-${s.key}`}
                            label={s.name || String(i + 1)}
                            inputMode="decimal"
                            placeholder={addOn.price || money.format(0)}
                            value={addOn.sizePrices?.[s.key] ?? ''}
                            onChange={(event) =>
                              setAddOn(addOn.key, {
                                sizePrices: { ...addOn.sizePrices, [s.key]: event.target.value },
                              })
                            }
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        className={styles.addBlock}
        onClick={() => set({ addOns: [...form.addOns, newAddOnRow()] })}
      >
        {t('adminMenu.editor.addAddOn')}
      </button>
      {form.addOns.length > 1 && (
        <Input
          id="dish-max-add-ons"
          label={t('adminMenu.editor.maxAddOns')}
          hint={t('adminMenu.editor.maxAddOnsHint')}
          inputMode="numeric"
          value={form.maxAddOns}
          onChange={(event) => set({ maxAddOns: event.target.value })}
        />
      )}
    </EditorSection>
  );
}
