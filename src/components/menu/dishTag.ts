import type { TagVariant } from '@/components/ui';
import type { ContentMap } from '@/api/queries';
import type { Translator } from '@/api/translator';
import { isSpicy, unavailableReason } from '@/lib/menu';
import type { Dish } from '@/types/menu';

/** The menu namespace's translator (`useContent('menu')`). */
export type MenuText = Translator<ContentMap['menu']>;

/** A highlight label a dish can carry: one of its tags, or "spicy" from its spice level. */
export type DishHighlight = Dish['tags'][number] | 'spicy';

export const TAG_VARIANT: Record<Dish['tags'][number], TagVariant> = {
  chef: 'chef',
  new: 'new',
  bestseller: 'best',
};

/** "Chef's pick" / "New" / "Bestseller". */
export const tagLabel = (t: MenuText, tag: Dish['tags'][number]) => t(`dish.tags.${tag}`);

/** The first highlight in `order` that applies to the dish. */
export function firstHighlight(
  dish: Dish,
  order: readonly DishHighlight[],
): DishHighlight | undefined {
  return order.find((h) => (h === 'spicy' ? isSpicy(dish) : dish.tags.includes(h)));
}

/** Text for a disabled ADD button ("Sold out", "Back 8 PM"), or undefined when the dish can be ordered. */
export function unavailableLabel(t: MenuText, dish: Dish): string | undefined {
  const reason = unavailableReason(dish);
  if (!reason) return undefined;
  return reason.kind === 'back-at'
    ? t('availability.backAt', { time: reason.time })
    : t('availability.soldOut');
}

/** Tag text shown for an unavailable dish ("Sold out", "Unavailable today"). */
export function unavailableTag(t: MenuText, dish: Dish): string | undefined {
  const reason = unavailableReason(dish);
  if (!reason) return undefined;
  return reason.kind === 'unavailable-today'
    ? t('availability.unavailableToday')
    : t('availability.soldOut');
}
