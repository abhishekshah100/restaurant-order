import type { Clock } from '@/lib/clock';
import type { Category, Dish, DishAvailability, MenuData } from '@/types/menu';

/*
 * MOCK ONLY — the menu as staff left it: the dummy JSON with the dishes they edited replaced,
 * the ones they added in, the ones they removed gone (from the curated lists too), and the
 * categories renamed and in their order. Dishes keep their order within a category by rank.
 * A dish sold out until a time, or off for a day, is available again once that's passed.
 */

/** One branch's changes. */
export interface BranchMenuChanges {
  /** Edited or added, in full, by slug. */
  dishes: Record<string, Dish>;
  /** Slugs taken off the menu. */
  removed: string[];
  /** Every category, renamed and in staff's order (none: as in the JSON). */
  categories?: Category[];
  /** Admin › Menu › Search suggestions (none: the JSON's lists, auto-fill on). */
  suggestions?: {
    pins: string[];
    words: string[];
    trendingAuto: boolean;
    popularAuto: boolean;
  };
  /** "Goes well with your order" (none: on, the default categories, the JSON's list as pins). */
  cart?: { enabled: boolean; categories: string[]; pins: string[] };
}

export const noMenuChanges = (): BranchMenuChanges => ({ dishes: {}, removed: [] });

/** Available again once a sold-out time or an off day has passed. */
function current(availability: DishAvailability, now: Date, clock: Clock): DishAvailability {
  if (availability.status === 'sold-out' && availability.until) {
    return Date.parse(availability.until) <= now.getTime() ? { status: 'available' } : availability;
  }
  if (availability.status === 'unavailable-today' && availability.day) {
    return clock.dayKey(now) > availability.day ? { status: 'available' } : availability;
  }
  return availability;
}

/** The menu with staff changes on top, as of `now` at the branch. */
export function applyMenuChanges(
  base: MenuData,
  changes: BranchMenuChanges | undefined,
  now: Date,
  clock: Clock,
): MenuData {
  const {
    dishes: edited,
    removed,
    categories: staffCategories,
    suggestions,
    cart,
  } = changes ?? noMenuChanges();
  const gone = new Set(removed);
  const known = new Set(base.dishes.map((d) => d.slug));
  const categories = staffCategories ?? base.categories;
  const order = new Map(categories.map((c, i) => [c.id, i]));
  const dishes = [
    ...base.dishes.map((d) => edited[d.slug] ?? d),
    ...Object.values(edited).filter((d) => !known.has(d.slug)),
  ]
    .filter((d) => !gone.has(d.slug))
    .map((d) => ({ ...d, availability: current(d.availability, now, clock) }))
    // By category, then rank: the order guests see within a category.
    .sort(
      (a, b) => (order.get(a.categoryId) ?? 0) - (order.get(b.categoryId) ?? 0) || a.rank - b.rank,
    );
  const kept = (slug: string) => !gone.has(slug);
  return {
    ...base,
    categories,
    dishes,
    chefsPicks: base.chefsPicks.filter(kept),
    cartSuggestions: (cart?.pins ?? base.cartSuggestions).filter(kept),
    trendingTonight: (suggestions?.pins ?? base.trendingTonight).filter(kept),
    popularSearches: suggestions?.words ?? base.popularSearches,
    popularAtTable: base.popularAtTable.filter((link) => kept(link.slug)),
  };
}
