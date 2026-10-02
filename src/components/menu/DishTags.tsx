import { Tag, VegMark } from '@/components/ui';
import { getCategory, unavailableTag } from '@/lib/menu';
import type { Dish } from '@/types/menu';
import styles from './DishRow.module.css';

const SPICE_TEXT = { medium: 'Medium spicy', hot: 'Hot' } as const;

export interface DishTagsProps {
  dish: Dish;
  /** Search results show the category instead of a tag (05). */
  showCategory?: boolean;
}

/** Veg mark plus the single most important label for a dish row. */
export function DishTags({ dish, showCategory }: DishTagsProps) {
  if (showCategory) {
    return (
      <span className={styles.metaRow}>
        <VegMark veg={dish.veg} />
        {getCategory(dish.categoryId)?.name}
      </span>
    );
  }
  const out = unavailableTag(dish);
  const tag = dish.tags[0];
  return (
    <div className={styles.top}>
      <VegMark veg={dish.veg} />
      {out ? (
        <Tag variant="out">{out}</Tag>
      ) : tag === 'chef' ? (
        <Tag variant="chef">Chef&apos;s pick</Tag>
      ) : tag === 'new' ? (
        <Tag variant="new">New</Tag>
      ) : tag === 'bestseller' ? (
        <Tag variant="pop">Bestseller</Tag>
      ) : dish.spice === 'medium' || dish.spice === 'hot' ? (
        <Tag variant="plain" icon="flame">
          {SPICE_TEXT[dish.spice]}
        </Tag>
      ) : null}
    </div>
  );
}
