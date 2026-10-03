'use client';

import { Chip, Icon, OptionGroup } from '@/components/ui';
import { useContent } from '@/api/hooks';
import type { DishConfigState } from '@/hooks/useDishConfig';
import { ITEM_NOTE_MAX } from '@/lib/constants';
import { cx } from '@/lib/cx';
import { formatAddOnPrice, formatINR } from '@/lib/format';
import type { Dish } from '@/types/menu';
import { addOnsFor, choicesFor, groupsFor, isPricedGroup } from '@/lib/options';
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
  const t = useContent('menu');
  const common = useContent('common');
  const quick = variant === 'quick';
  const Heading = quick ? 'h3' : 'h2';
  const groupTitle = quick ? styles.groupTitle : 't-h3';
  // Add-ons, groups and choices follow the selected size (e.g. an extra shot on Large only).
  const addOns = addOnsFor(dish, config.variantId);
  const addOnHint =
    dish.maxAddOns !== undefined
      ? t('options.optionalUpTo', { max: dish.maxAddOns })
      : t('options.optional');

  return (
    <div className={cx(styles.form, quick ? styles.quick : styles.detail)}>
      {dish.variants && dish.variants.length > 0 && (
        <OptionGroup
          id={`${idPrefix}-variant`}
          type="radio"
          title={dish.variantLabel ?? t('options.chooseOption')}
          hint={t('options.required')}
          layout="grid"
          tilesOnMobile={quick}
          headingAs={Heading}
          titleClassName={groupTitle}
          value={config.variantId}
          onChange={state.setVariant}
          choices={dish.variants.map((v) => {
            // With 3+ portions the pop-up tiles are narrow, so "Quarter · 1 pc" becomes
            // "Quarter" with "1 pc" underneath and never breaks mid-phrase.
            const split = quick && (dish.variants?.length ?? 0) >= 3;
            const [name, ...detail] = v.name.split(' · ');
            return {
              id: v.id,
              label: split ? name : v.name,
              sub: split ? detail.join(' · ') || undefined : quick ? undefined : v.description,
              price: formatINR(v.price),
              disabled: v.available === false,
            };
          })}
        />
      )}

      {groupsFor(dish, config.variantId).map((group) => {
        const choices = choicesFor(group, config.variantId);
        const value = config.options[group.id] ?? choices[0]?.name;
        // Priced choices (protein, upgrades) and every meal slot read best as rows with the price.
        if (isPricedGroup(group) || dish.combo) {
          return (
            <OptionGroup
              key={group.id}
              id={`${idPrefix}-${group.id}`}
              type="radio"
              title={group.name}
              hint={dish.combo ? t('options.chooseOne') : t('options.required')}
              layout="grid"
              headingAs={Heading}
              titleClassName={groupTitle}
              value={value}
              onChange={(name) => state.setOption(group.id, name)}
              choices={choices.map((c) => ({
                id: c.name,
                label: c.name,
                price: c.price ? `+${formatINR(c.price)}` : t('options.included'),
              }))}
            />
          );
        }
        return (
          <div key={group.id} className={styles.group}>
            <div className={styles.head}>
              <Heading id={`${idPrefix}-${group.id}-title`} className={groupTitle}>
                {group.name}
              </Heading>
              {dish.combo && <span className={styles.req}>{t('options.chooseOne')}</span>}
            </div>
            <ChoiceChips
              id={`${idPrefix}-${group.id}`}
              labelledBy={`${idPrefix}-${group.id}-title`}
              choices={choices.map((c) => c.name)}
              value={value ?? ''}
              onChange={(choice) => state.setOption(group.id, choice)}
              icons={group.id === 'spice' ? { Hot: 'flame' } : undefined}
            />
          </div>
        );
      })}

      {addOns.length > 0 && (
        <OptionGroup
          id={`${idPrefix}-addons`}
          type="checkbox"
          title={t('options.addOns')}
          hint={addOnHint}
          layout="grid"
          headingAs={Heading}
          titleClassName={groupTitle}
          max={dish.maxAddOns}
          value={config.addOnIds}
          onChange={state.setAddOns}
          choices={addOns.map((a) => ({
            id: a.id,
            label: a.name,
            price: formatAddOnPrice(a.price, common('price.free')),
          }))}
        />
      )}

      {dish.removables && dish.removables.length > 0 && (
        <div className={styles.group}>
          <div className={styles.head}>
            <Heading id={`${idPrefix}-remove-title`} className={groupTitle}>
              {t('options.leaveOut')}
            </Heading>
            <span className={styles.req}>{t('options.optional')}</span>
          </div>
          <div className={styles.chips} role="group" aria-labelledby={`${idPrefix}-remove-title`}>
            {dish.removables.map((r) => (
              <Chip
                key={r.id}
                iconStart={config.removals.includes(r.id) ? 'check' : undefined}
                pressed={config.removals.includes(r.id)}
                onClick={() => state.toggleRemoval(r.id)}
              >
                {t('options.without', { item: r.name.toLowerCase() })}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {!quick && (
        <div className={styles.group}>
          <div className={styles.head}>
            <label htmlFor={`${idPrefix}-note`} className="t-h3">
              {t('options.instructions')}
            </label>
            <span className={styles.req}>{t('options.optional')}</span>
          </div>
          {dish.quickInstructions && dish.quickInstructions.length > 0 && (
            <div className={styles.chips} role="group" aria-label={t('options.quickInstructions')}>
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
            placeholder={t('options.notePlaceholder')}
            maxLength={ITEM_NOTE_MAX}
            rows={1}
            value={config.note}
            onChange={(e) => state.setNote(e.target.value)}
          />
          <p className={cx(styles.hint, 'hide-desktop')}>
            <Icon name="info" size="xs" />
            {t('options.allergyHint')}
          </p>
        </div>
      )}
    </div>
  );
}
