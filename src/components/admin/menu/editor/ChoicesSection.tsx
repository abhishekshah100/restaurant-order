'use client';

import { useContent } from '@/api/hooks';
import { Input } from '@/components/ui';
import {
  moveItem,
  newChoiceRow,
  newGroupRow,
  type ChoiceRow,
  type DishForm,
  type GroupRow,
} from '@/lib/adminMenu';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { Switch } from '../Switch';
import { EditorSection } from './EditorSection';
import { RowButtons, SizePicker } from './parts';
import styles from './Editor.module.css';

/**
 * Choice groups: single choices a guest picks one of — a meal's curry, bread and drink, a spice
 * level, a crust. Each has two or more choices with an extra price (empty: included), in order
 * (the first is the default), optionally offered only with some sizes.
 */
export function ChoicesSection({
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
  const sized = form.pricing === 'sizes';
  const setGroup = (key: string, fields: Partial<GroupRow>) =>
    set({ groups: form.groups.map((g) => (g.key === key ? { ...g, ...fields } : g)) });
  const setChoice = (group: GroupRow, key: string, fields: Partial<ChoiceRow>) =>
    setGroup(group.key, {
      choices: group.choices.map((c) => (c.key === key ? { ...c, ...fields } : c)),
    });

  return (
    <EditorSection
      title={t('adminMenu.editor.sections.choices')}
      summary={
        form.groups.length > 0
          ? t.plural('adminMenu.editor.summary.groups', form.groups.length)
          : t('adminMenu.editor.summary.none')
      }
      error={error}
    >
      <p className={styles.hint}>{t('adminMenu.editor.choicesHint')}</p>
      {form.groups.map((group, index) => {
        const groupLabel = group.name || String(index + 1);
        return (
          <div key={group.key} className={styles.card}>
            <div className={styles.cardHead}>
              <Input
                id={`${group.key}-name`}
                label={t('adminMenu.editor.groupName')}
                placeholder={t('adminMenu.editor.groupNamePlaceholder')}
                value={group.name}
                maxLength={60}
                onChange={(event) => setGroup(group.key, { name: event.target.value })}
              />
              <RowButtons
                name={groupLabel}
                first={index === 0}
                last={index === form.groups.length - 1}
                removeLabel={t('adminMenu.editor.removeGroup', { group: groupLabel })}
                onMove={(by) => set({ groups: moveItem(form.groups, index, by) })}
                onRemove={() => set({ groups: form.groups.filter((g) => g.key !== group.key) })}
              />
            </div>
            <ul className={styles.rows}>
              {group.choices.map((choice, i) => {
                const choiceLabel = choice.name || String(i + 1);
                return (
                  <li key={choice.key} className={styles.choice}>
                    <div className={styles.choiceRow}>
                      <Input
                        id={`${choice.key}-name`}
                        label={t('adminMenu.editor.choiceName')}
                        hideLabel={i > 0}
                        placeholder={t('adminMenu.editor.choiceNamePlaceholder')}
                        value={choice.name}
                        maxLength={60}
                        onChange={(event) =>
                          setChoice(group, choice.key, { name: event.target.value })
                        }
                      />
                      <Input
                        id={`${choice.key}-price`}
                        label={t('adminMenu.editor.extra', { currency: region.currency.symbol })}
                        hideLabel={i > 0}
                        inputMode="decimal"
                        placeholder={money.format(0)}
                        value={choice.price}
                        onChange={(event) =>
                          setChoice(group, choice.key, { price: event.target.value })
                        }
                      />
                      <RowButtons
                        name={choiceLabel}
                        first={i === 0}
                        last={i === group.choices.length - 1}
                        canRemove={group.choices.length > 2}
                        removeLabel={t('adminMenu.editor.removeChoice', { choice: choiceLabel })}
                        onMove={(by) =>
                          setGroup(group.key, { choices: moveItem(group.choices, i, by) })
                        }
                        onRemove={() =>
                          setGroup(group.key, {
                            choices: group.choices.filter((c) => c.key !== choice.key),
                          })
                        }
                      />
                    </div>
                    {sized && (
                      <SizePicker
                        sizes={form.sizes}
                        value={choice.onlySizes}
                        onChange={(onlySizes) => setChoice(group, choice.key, { onlySizes })}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className={styles.addRow}
              onClick={() => setGroup(group.key, { choices: [...group.choices, newChoiceRow()] })}
            >
              {t('adminMenu.editor.addChoice')}
            </button>
            <label className={styles.toggleRow}>
              <span>{t('adminMenu.editor.showInSummary')}</span>
              <Switch
                checked={group.showInSummary}
                onChange={(showInSummary) => setGroup(group.key, { showInSummary })}
                label={t('adminMenu.editor.showInSummary')}
              />
            </label>
            {sized && (
              <SizePicker
                sizes={form.sizes}
                value={group.onlySizes}
                onChange={(onlySizes) => setGroup(group.key, { onlySizes })}
              />
            )}
          </div>
        );
      })}
      <button
        type="button"
        className={styles.addBlock}
        onClick={() => set({ groups: [...form.groups, newGroupRow()] })}
      >
        {t('adminMenu.editor.addGroup')}
      </button>
    </EditorSection>
  );
}
