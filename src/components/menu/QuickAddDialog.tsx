'use client';

import Image from 'next/image';
import { Button, Dialog, IconButton, QuantityStepper, VegMark } from '@/components/ui';
import { useContent } from '@/api/hooks';
import { useCartActions } from '@/hooks/useCart';
import { useDishConfig } from '@/hooks/useDishConfig';
import { cx } from '@/lib/cx';
import { formatINR } from '@/lib/format';
import { dishImage } from '@/lib/menu';
import type { CartLine } from '@/types/cart';
import type { Dish } from '@/types/menu';
import { DishOptionsForm } from './DishOptionsForm';
import { tagLabel } from './dishTag';
import styles from './QuickAdd.module.css';

/** The thumbnail sits beside the dish name, so screen readers skip it. */
const DECORATIVE = '';

export interface QuickAddDialogProps {
  dish: Dish;
  /** When set, the dialog edits this cart line instead of adding a new one. */
  editing?: CartLine;
  onClose: () => void;
}

/** Quick-add for dishes without a photo: bottom sheet below 1024px, modal from 1024px (07 / w07). */
export function QuickAddDialog({ dish, editing, onClose }: QuickAddDialogProps) {
  const { addItem, editLine } = useCartActions();
  const t = useContent('menu');
  const state = useDishConfig(
    dish,
    editing ? { config: editing, quantity: editing.quantity } : undefined,
  );
  const titleId = `qa-${dish.slug}-title`;
  const thumb = dishImage(dish, 'thumb');
  const meta = [
    dish.veg ? t('dish.vegetarian') : t('dish.nonVegetarian'),
    ...dish.tags.map((tag) => tagLabel(t, tag)),
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
      header={
        <div className={styles.head}>
          {thumb && (
            <Image
              className={styles.thumb}
              src={thumb.src}
              alt={DECORATIVE}
              width={thumb.width}
              height={thumb.height}
              sizes="52px"
            />
          )}
          <div className={styles.headText}>
            <span className={cx(styles.meta, !dish.veg && styles.metaNv)}>
              <VegMark veg={dish.veg} decorative />
              {meta}
            </span>
            <h2 id={titleId} className={styles.title}>
              {dish.name}
            </h2>
          </div>
          <IconButton
            icon="x"
            iconSize="sm"
            label={t('quickAdd.close')}
            variant="soft"
            onClick={onClose}
          />
        </div>
      }
      footer={
        <div className={styles.foot}>
          <QuantityStepper
            className={styles.stepper}
            variant="outline"
            size="lg"
            value={state.quantity}
            onChange={state.setQuantity}
            itemName={dish.name}
          />
          <Button
            block
            className={styles.cta}
            meta={formatINR(state.total)}
            onClick={submit}
            disabled={!state.valid}
          >
            {editing ? t('detail.updateItem') : t('detail.addToCart')}
          </Button>
        </div>
      }
    >
      <p className={cx('t-small c2', styles.desc)}>{dish.longDescription ?? dish.description}</p>
      <DishOptionsForm dish={dish} state={state} variant="quick" idPrefix={`qa-${dish.slug}`} />
    </Dialog>
  );
}
