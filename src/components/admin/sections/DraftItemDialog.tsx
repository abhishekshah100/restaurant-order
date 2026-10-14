'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Dialog } from '@/components/ui';
import type { Money } from '@/lib/money';
import type { Dish } from '@/types/menu';
import {
  addOnsFor,
  choiceName,
  choicePrice,
  draftLine,
  groupsFor,
  initialSelection,
  withVariant,
  type DraftLine,
} from './draft';
import styles from './DraftItemDialog.module.css';

/** Configure a dish (size, add-ons, choices) and add it to the unsent draft. */
export function DraftItemDialog({
  dish,
  money,
  onAdd,
  onClose,
}: {
  dish: Dish | undefined;
  money: Money;
  onAdd: (line: DraftLine) => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  return (
    <Dialog
      open={Boolean(dish)}
      onClose={onClose}
      title={dish?.name ?? t('adminDashboard.configureItem')}
      description={t('adminDashboard.addItemDescription')}
    >
      {dish && <DraftItemForm key={dish.slug} dish={dish} money={money} onAdd={onAdd} />}
    </Dialog>
  );
}

function DraftItemForm({
  dish,
  money,
  onAdd,
}: {
  dish: Dish;
  money: Money;
  onAdd: (line: DraftLine) => void;
}) {
  const t = useContent('common');
  const [selection, setSelection] = useState(() => initialSelection(dish));
  const { variantId, addOnIds, choices } = selection;
  const limitReached = dish.maxAddOns !== undefined && addOnIds.length >= dish.maxAddOns;

  return (
    <div className={styles.customiser}>
      {dish.variants && dish.variants.length > 0 && (
        <label className={styles.formLabel}>
          {t('adminDashboard.chooseVariant', {
            variant: dish.variantLabel ?? t('adminDashboard.variant'),
          })}
          <select
            value={variantId}
            onChange={(event) => setSelection(withVariant(dish, selection, event.target.value))}
            required
          >
            {dish.variants
              .filter((variant) => variant.available !== false)
              .map((variant) => (
                <option value={variant.id} key={variant.id}>
                  {variant.name} · {money.format(variant.price)}
                </option>
              ))}
          </select>
        </label>
      )}
      {addOnsFor(dish, variantId).map((addOn) => (
        <label key={addOn.id} className={styles.checkOption}>
          <input
            type="checkbox"
            checked={addOnIds.includes(addOn.id)}
            disabled={!addOnIds.includes(addOn.id) && limitReached}
            onChange={(event) =>
              setSelection({
                ...selection,
                addOnIds: event.target.checked
                  ? [...addOnIds, addOn.id]
                  : addOnIds.filter((id) => id !== addOn.id),
              })
            }
          />
          <span>{addOn.name}</span>
          <small>{money.format(addOn.priceByVariant?.[variantId] ?? addOn.price)}</small>
        </label>
      ))}
      {groupsFor(dish, variantId).map(({ group, choices: offered }) => (
        <label className={styles.formLabel} key={group.id}>
          {group.name}
          <select
            value={choices[group.id] ?? choiceName(offered[0])}
            onChange={(event) =>
              setSelection({
                ...selection,
                choices: { ...choices, [group.id]: event.target.value },
              })
            }
          >
            {offered.map((choice) => (
              <option key={choiceName(choice)} value={choiceName(choice)}>
                {choiceName(choice)}
                {choicePrice(choice) > 0 ? ` · ${money.format(choicePrice(choice))}` : ''}
              </option>
            ))}
          </select>
        </label>
      ))}
      <Button block onClick={() => onAdd(draftLine(dish, selection))} iconStart="plus">
        {t('adminDashboard.addToUnsentDraft')}
      </Button>
      <p className={styles.dataNote}>{t('adminDashboard.draftActionDisclaimer')}</p>
    </div>
  );
}
