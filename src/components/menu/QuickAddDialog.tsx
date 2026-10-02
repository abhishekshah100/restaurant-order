'use client';

import { Button, Dialog, IconButton, QuantityStepper, VegMark } from '@/components/ui';
import { useCart } from '@/hooks/useCart';
import { useDishConfig } from '@/hooks/useDishConfig';
import { cx } from '@/lib/cx';
import { formatINR } from '@/lib/format';
import type { CartLine } from '@/types/cart';
import type { Dish } from '@/types/menu';
import { DishOptionsForm } from './DishOptionsForm';
import styles from './QuickAdd.module.css';

export interface QuickAddDialogProps {
  dish: Dish;
  /** When set, the dialog edits this cart line instead of adding a new one. */
  editing?: CartLine;
  onClose: () => void;
}

const TAG_TEXT = { chef: "Chef's pick", new: 'New', bestseller: 'Bestseller' } as const;

/** Quick-add for dishes without a photo: bottom sheet below 1024px, modal from 1024px (07 / w07). */
export function QuickAddDialog({ dish, editing, onClose }: QuickAddDialogProps) {
  const { addItem, editLine } = useCart();
  const state = useDishConfig(
    dish,
    editing ? { config: editing, quantity: editing.quantity } : undefined,
  );
  const titleId = `qa-${dish.slug}-title`;
  const meta = [
    dish.veg ? 'Vegetarian' : 'Non-vegetarian',
    ...dish.tags.map((t) => TAG_TEXT[t]),
  ].join(' · ');

  const submit = () => {
    if (!state.valid) return;
    if (editing) editLine(editing.key, dish, state.config, state.quantity);
    else addItem(dish, state.config, state.quantity);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={dish.name}
      labelledBy={titleId}
      presentation="adaptive"
      footer={
        <div className={styles.foot}>
          <QuantityStepper
            variant="outline"
            size="lg"
            value={state.quantity}
            onChange={state.setQuantity}
            itemName={dish.name}
          />
          <Button block meta={formatINR(state.total)} onClick={submit} disabled={!state.valid}>
            {editing ? 'Update item' : 'Add to cart'}
          </Button>
        </div>
      }
    >
      <div className={styles.head}>
        <div className={styles.headText}>
          <span className={cx(styles.meta, !dish.veg && styles.metaNv)}>
            <VegMark veg={dish.veg} decorative />
            {meta}
          </span>
          <h2 id={titleId} className={styles.title}>
            {dish.name}
          </h2>
          <p className="t-small c2">{dish.longDescription ?? dish.description}</p>
        </div>
        <IconButton icon="x" iconSize="sm" label="Close" variant="soft" onClick={onClose} />
      </div>
      <DishOptionsForm dish={dish} state={state} variant="quick" idPrefix={`qa-${dish.slug}`} />
    </Dialog>
  );
}
