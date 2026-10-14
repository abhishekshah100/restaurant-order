'use client';

import { useContent } from '@/api/hooks';
import { Input, OptionGroup, QuantityStepper } from '@/components/ui';
import { choicesFor, groupsFor, normaliseConfig } from '@/lib/options';
import type { LineConfig } from '@/types/cart';
import type { Dish } from '@/types/menu';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './OrderPad.module.css';

/**
 * A dish's choices before it's added: its size and each choice group (the usual ones picked
 * already), how many, and a note for the kitchen.
 */
export function PadChoose({
  dish,
  config,
  quantity,
  onChange,
}: {
  dish: Dish;
  config: LineConfig;
  quantity: number;
  onChange: (config: LineConfig, quantity: number) => void;
}) {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  const set = (next: LineConfig) => onChange(normaliseConfig(dish, next), quantity);

  return (
    <div className={styles.choose}>
      <p className={styles.chooseDescription}>{dish.description}</p>

      {dish.variants && dish.variants.length > 0 && (
        <OptionGroup
          type="radio"
          id="pad-size"
          title={dish.variantLabel ?? t('adminOrderPad.choose.size')}
          value={config.variantId}
          onChange={(variantId) => set({ ...config, variantId })}
          choices={dish.variants.map((v) => ({
            id: v.id,
            label: v.name,
            price: money.format(v.price),
            disabled: v.available === false,
          }))}
        />
      )}

      {groupsFor(dish, config.variantId).map((group) => (
        <OptionGroup
          key={group.id}
          type="radio"
          id={`pad-${group.id}`}
          title={group.name}
          value={config.options[group.id]}
          onChange={(choice) =>
            set({ ...config, options: { ...config.options, [group.id]: choice } })
          }
          choices={choicesFor(group, config.variantId).map((c) => ({
            id: c.name,
            label: c.name,
            price: c.price
              ? t('adminOrderPad.choose.extra', { amount: money.format(c.price) })
              : undefined,
          }))}
        />
      ))}

      <div className={styles.quantityRow}>
        <span className={styles.quantityLabel}>{t('adminOrderPad.choose.quantity')}</span>
        <QuantityStepper
          value={quantity}
          min={1}
          itemName={dish.name}
          onChange={(next) => onChange(config, next)}
        />
      </div>

      <Input
        id="pad-dish-note"
        label={t('adminOrderPad.choose.note')}
        optional
        placeholder={t('adminOrderPad.choose.notePlaceholder')}
        value={config.note}
        onChange={(event) => onChange({ ...config, note: event.target.value }, quantity)}
      />
    </div>
  );
}
