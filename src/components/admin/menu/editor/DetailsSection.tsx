'use client';

import { useContent } from '@/api/hooks';
import { Chip, Input, Textarea } from '@/components/ui';
import type { DishForm } from '@/lib/adminMenu';
import type { Allergen, DishTag, SpiceLevel } from '@/types/menu';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { Switch } from '../Switch';
import { EditorSection } from './EditorSection';
import styles from './Editor.module.css';

const TAGS: readonly DishTag[] = ['bestseller', 'chef', 'new'];
const SPICE: readonly (SpiceLevel | '')[] = ['', 'mild', 'medium', 'hot'];
const ALLERGENS: readonly Allergen[] = [
  'dairy',
  'gluten',
  'nuts',
  'shellfish',
  'egg',
  'soy',
  'sesame',
];

/** Toggles `item` in a list. */
const toggled = <T,>(items: readonly T[], item: T) =>
  items.includes(item) ? items.filter((x) => x !== item) : [...items, item];

/**
 * The rest guests read about a dish: its full description, highlights, spice, prep time and
 * serves, allergens, and — for a meal — what it includes and what it saves.
 */
export function DetailsSection({
  form,
  set,
  errors,
}: {
  form: DishForm;
  set: (fields: Partial<DishForm>) => void;
  /** Problems with the meal and serves fields. */
  errors: { meal?: string; serves?: string };
}) {
  const t = useContent('common');
  const { region } = useAdminWorkspace();
  const error = errors.meal ?? errors.serves;

  return (
    <EditorSection
      title={t('adminMenu.editor.sections.details')}
      summary={[
        ...form.tags.map((tag) => t(`adminMenu.editor.tag.${tag}`)),
        ...(form.allergens.length > 0
          ? [form.allergens.map((a) => t(`adminMenu.editor.allergen.${a}`)).join(', ')]
          : []),
      ].join(' · ')}
      error={error}
    >
      <Textarea
        id="dish-long-description"
        label={t('adminMenu.editor.longDescription')}
        optional
        rows={3}
        maxLength={600}
        placeholder={t('adminMenu.editor.longDescriptionPlaceholder')}
        value={form.longDescription}
        onChange={(event) => set({ longDescription: event.target.value })}
      />
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('adminMenu.editor.tags')}</legend>
        <div className={styles.chips}>
          {TAGS.map((tag) => (
            <Chip
              key={tag}
              pressed={form.tags.includes(tag)}
              onClick={() => set({ tags: toggled(form.tags, tag) })}
            >
              {t(`adminMenu.editor.tag.${tag}`)}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('adminMenu.editor.spice')}</legend>
        <div className={styles.chips}>
          {SPICE.map((level) => (
            <Chip
              key={level || 'none'}
              pressed={form.spice === level}
              onClick={() => set({ spice: level })}
            >
              {t(`adminMenu.editor.spiceLevel.${level || 'none'}`)}
            </Chip>
          ))}
        </div>
      </fieldset>
      <div className={styles.twoUp}>
        <Input
          id="dish-prep-time"
          label={t('adminMenu.editor.prepTime')}
          optional
          maxLength={20}
          placeholder={t('adminMenu.editor.prepTimePlaceholder')}
          value={form.prepTime}
          onChange={(event) => set({ prepTime: event.target.value })}
        />
        <Input
          id="dish-serves"
          label={t('adminMenu.editor.serves')}
          optional
          inputMode="numeric"
          value={form.serves}
          error={errors.serves}
          onChange={(event) => set({ serves: event.target.value })}
        />
      </div>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('adminMenu.editor.allergens')}</legend>
        <div className={styles.chips}>
          {ALLERGENS.map((allergen) => (
            <Chip
              key={allergen}
              pressed={form.allergens.includes(allergen)}
              onClick={() => set({ allergens: toggled(form.allergens, allergen) })}
            >
              {t(`adminMenu.editor.allergen.${allergen}`)}
            </Chip>
          ))}
        </div>
      </fieldset>
      <label className={styles.toggleRow}>
        <span>{t('adminMenu.editor.meal')}</span>
        <Switch
          checked={form.meal}
          onChange={(meal) => set({ meal })}
          label={t('adminMenu.editor.meal')}
        />
      </label>
      {form.meal && (
        <div className={styles.twoUp}>
          <Input
            id="dish-meal-includes"
            label={t('adminMenu.editor.mealIncludes')}
            maxLength={120}
            placeholder={t('adminMenu.editor.mealIncludesPlaceholder')}
            value={form.mealIncludes}
            onChange={(event) => set({ mealIncludes: event.target.value })}
          />
          <Input
            id="dish-meal-savings"
            label={t('adminMenu.editor.mealSavings', { currency: region.currency.symbol })}
            optional
            inputMode="decimal"
            value={form.mealSavings}
            onChange={(event) => set({ mealSavings: event.target.value })}
          />
        </div>
      )}
    </EditorSection>
  );
}
