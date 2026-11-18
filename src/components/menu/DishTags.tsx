import { Tag, VegMark } from '@/components/ui';
import { useContent, useMenu } from '@/api/hooks';
import { useDishCardShared } from '@/context/DishCardContext';
import type { Dish } from '@/types/menu';
import { TAG_VARIANT, firstHighlight, tagLabel, unavailableTag } from './dishTag';
import styles from './DishRow.module.css';

export interface DishTagsProps {
  dish: Dish;
  /** Search results show the category instead of a tag (05). */
  showCategory?: boolean;
}

/** Veg mark plus the single most important label for a dish row. */
export function DishTags({ dish, showCategory }: DishTagsProps) {
  const t = useContent('menu');
  const { money } = useDishCardShared();
  if (showCategory) {
    return (
      <span className={styles.metaRow}>
        <VegMark veg={dish.veg} />
        <CategoryName categoryId={dish.categoryId} />
      </span>
    );
  }
  const out = unavailableTag(t, dish);
  // The dish's own first tag wins; otherwise its spice level.
  const highlight = firstHighlight(dish, [...dish.tags.slice(0, 1), 'spicy']);
  return (
    <div className={styles.top}>
      <VegMark veg={dish.veg} />
      {out ? (
        <Tag variant="out">{out}</Tag>
      ) : dish.combo ? (
        <Tag variant="ok" icon={null}>
          {dish.combo.savings
            ? t('dish.mealSave', { savings: money.format(dish.combo.savings) })
            : t('dish.meal')}
        </Tag>
      ) : highlight === 'spicy' ? (
        <Tag variant="plain" icon="flame">
          {(dish.spice === 'medium' || dish.spice === 'hot') && t(`dish.spice.${dish.spice}`)}
        </Tag>
      ) : highlight ? (
        <Tag variant={TAG_VARIANT[highlight]}>{tagLabel(t, highlight)}</Tag>
      ) : null}
    </div>
  );
}

/** A dish's category name (search results): only these read the menu. */
function CategoryName({ categoryId }: { categoryId: string }) {
  return useMenu().getCategory(categoryId)?.name ?? null;
}
