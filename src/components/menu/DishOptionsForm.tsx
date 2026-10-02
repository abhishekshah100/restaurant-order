'use client';

import { Chip, Icon, OptionGroup } from '@/components/ui';
import type { DishConfigState } from '@/hooks/useDishConfig';
import { cx } from '@/lib/cx';
import { formatAddOnPrice, formatINR } from '@/lib/format';
import type { Dish } from '@/types/menu';
import { ChoiceChips } from './ChoiceChips';
import styles from './DishOptionsForm.module.css';

export interface DishOptionsFormProps {
  dish: Dish;
  state: DishConfigState;
  /** detail: food-detail page · quick: quick-add sheet / modal. */
  variant: 'detail' | 'quick';
  idPrefix: string;
}

/** Variant, option, add-on and instruction choices for a dish. No business logic — state comes from useDishConfig. */
export function DishOptionsForm({ dish, state, variant, idPrefix }: DishOptionsFormProps) {
  const { config } = state;
  const quick = variant === 'quick';
  const Heading = quick ? 'h3' : 'h2';
  const addOnHint =
    dish.maxAddOns !== undefined ? `Optional · up to ${dish.maxAddOns}` : 'Optional';

  return (
    <div className={cx(styles.form, quick ? styles.quick : styles.detail)}>
      {dish.variants && dish.variants.length > 0 && (
        <OptionGroup
          id={`${idPrefix}-variant`}
          type="radio"
          title={dish.variantLabel ?? 'Choose an option'}
          hint="Required"
          layout="grid"
          tilesOnMobile={quick}
          headingAs={Heading}
          value={config.variantId}
          onChange={state.setVariant}
          choices={dish.variants.map((v) => ({
            id: v.id,
            label: v.name,
            sub: quick ? undefined : v.description,
            price: formatINR(v.price),
            disabled: v.available === false,
          }))}
        />
      )}

      {dish.optionGroups?.map((group) => (
        <div key={group.id} className={styles.group}>
          <div className={styles.head}>
            <Heading id={`${idPrefix}-${group.id}-title`} className="t-h3">
              {group.name}
            </Heading>
          </div>
          <ChoiceChips
            id={`${idPrefix}-${group.id}`}
            labelledBy={`${idPrefix}-${group.id}-title`}
            choices={group.choices}
            value={config.options[group.id] ?? group.choices[0]}
            onChange={(choice) => state.setOption(group.id, choice)}
            icons={group.id === 'spice' ? { Hot: 'flame' } : undefined}
          />
        </div>
      ))}

      {dish.addOns && dish.addOns.length > 0 && (
        <OptionGroup
          id={`${idPrefix}-addons`}
          type="checkbox"
          title="Add-ons"
          hint={addOnHint}
          layout="grid"
          headingAs={Heading}
          max={dish.maxAddOns}
          value={config.addOnIds}
          onChange={state.setAddOns}
          choices={dish.addOns.map((a) => ({
            id: a.id,
            label: a.name,
            price: formatAddOnPrice(a.price),
          }))}
        />
      )}

      {!quick && (
        <div className={styles.group}>
          <div className={styles.head}>
            <label htmlFor={`${idPrefix}-note`} className="t-h3">
              Special instructions
            </label>
            <span className={styles.req}>Optional</span>
          </div>
          {dish.quickInstructions && dish.quickInstructions.length > 0 && (
            <div className={styles.chips} role="group" aria-label="Quick instructions">
              {dish.quickInstructions.map((text) => (
                <Chip
                  key={text}
                  pressed={config.instructions.includes(text)}
                  onClick={() => state.toggleInstruction(text)}
                >
                  {text}
                </Chip>
              ))}
            </div>
          )}
          <textarea
            id={`${idPrefix}-note`}
            className={styles.note}
            placeholder="Anything else? e.g. sauce on the side"
            maxLength={140}
            rows={1}
            value={config.note}
            onChange={(e) => state.setNote(e.target.value)}
          />
          <p className={cx(styles.hint, 'hide-desktop')}>
            <Icon name="info" size="xs" />
            For allergies, please also tell your server.
          </p>
        </div>
      )}
    </div>
  );
}
