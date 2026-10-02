import { categories, chefsPicks, dishes } from '@/data/menu';
import type { Category, CategoryId, Dish, DishImage } from '@/types/menu';
import { formatINR } from './format';

export function getCategory(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function getDish(slug: string): Dish | undefined {
  return dishes.find((d) => d.slug === slug);
}

export function dishesIn(categoryId: CategoryId): Dish[] {
  return dishes.filter((d) => d.categoryId === categoryId);
}

export function categoryCount(categoryId: CategoryId): number {
  return dishesIn(categoryId).length;
}

/** "8 dishes" / "14 drinks". */
export function categoryCountLabel(category: Category): string {
  return `${categoryCount(category.id)} ${category.unit}`;
}

export const featuredDishes = (): Dish[] =>
  chefsPicks.map((slug) => getDish(slug)).filter((d): d is Dish => d !== undefined);

export const isAvailable = (dish: Dish) => dish.availability.status === 'available';

/** Needs a choice before adding (variants, option groups or add-ons). */
export const isCustomisable = (dish: Dish) =>
  Boolean(dish.variants?.length || dish.optionGroups?.length || dish.addOns?.length);

export const isSpicy = (dish: Dish) => dish.spice === 'medium' || dish.spice === 'hot';

/** Text for a disabled ADD button, or undefined when the dish can be ordered. */
export function unavailableLabel(dish: Dish): string | undefined {
  const a = dish.availability;
  if (a.status === 'sold-out') return a.backAt ? `Back ${a.backAt}` : 'Sold out';
  if (a.status === 'unavailable-today') return 'Sold out';
  return undefined;
}

/** Tag text shown for an unavailable dish. */
export function unavailableTag(dish: Dish): string | undefined {
  const a = dish.availability;
  if (a.status === 'sold-out') return 'Sold out';
  if (a.status === 'unavailable-today') return 'Unavailable today';
  return undefined;
}

/** Price line: "₹329" plus "Half · ₹549 Full" style secondary text for 2-variant portions. */
export function variantSummary(dish: Dish): string | undefined {
  // Only piece-count portions get the secondary price line (Paneer Tikka, 02).
  if (dish.variants?.length !== 2 || !dish.variants[0].name.includes(' · ')) return undefined;
  const [a, b] = dish.variants;
  const short = (name: string) => name.split(' · ')[0];
  return `${short(a.name)} · ${formatINR(b.price)} ${short(b.name)}`;
}

export function dishImage(dish: Dish, kind: 'hero' | 'card' | 'thumb'): DishImage | undefined {
  if (kind === 'thumb') return dish.thumb ?? dish.image;
  return dish.image;
}

/* ---------- Filters and sorting ---------- */

export type Diet = 'all' | 'veg' | 'nonveg';
export type SortKey = 'recommended' | 'price-asc' | 'price-desc' | 'best-match';

export interface MenuFilters {
  diet: Diet;
  spicy: boolean;
  chefs: boolean;
  under400: boolean;
}

export const DEFAULT_FILTERS: MenuFilters = {
  diet: 'all',
  spicy: false,
  chefs: false,
  under400: false,
};

export const SORT_LABEL: Record<SortKey, string> = {
  recommended: 'Recommended',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  'best-match': 'Best match',
};

export const PRICE_LIMIT = 400;

export function applyFilters(list: readonly Dish[], f: MenuFilters): Dish[] {
  return list.filter(
    (d) =>
      (f.diet === 'all' || (f.diet === 'veg' ? d.veg : !d.veg)) &&
      (!f.spicy || isSpicy(d)) &&
      (!f.chefs || d.featured || d.tags.includes('chef')) &&
      (!f.under400 || d.price < PRICE_LIMIT),
  );
}

export function hasActiveFilters(f: MenuFilters): boolean {
  return f.diet !== 'all' || f.spicy || f.chefs || f.under400;
}

/** Sorts a copy. Unavailable dishes always go last; they stay visible. */
export function sortDishes(list: readonly Dish[], sort: SortKey): Dish[] {
  const avail = (d: Dish) => (isAvailable(d) ? 0 : 1);
  const byKey: Record<SortKey, (a: Dish, b: Dish) => number> = {
    recommended: (a, b) => a.rank - b.rank,
    'best-match': () => 0,
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
  };
  return [...list].sort((a, b) => avail(a) - avail(b) || byKey[sort](a, b));
}

/** "Showing 7 vegetarian dishes" / "Showing 7 of 12 dishes". */
export function filterSummary(f: MenuFilters, shown: number, total: number): string {
  if (f.diet === 'veg' && !f.spicy && !f.chefs && !f.under400)
    return `Showing ${shown} vegetarian ${shown === 1 ? 'dish' : 'dishes'}`;
  if (f.diet === 'nonveg' && !f.spicy && !f.chefs && !f.under400)
    return `Showing ${shown} non-vegetarian ${shown === 1 ? 'dish' : 'dishes'}`;
  return `Showing ${shown} of ${total} dishes`;
}

/* ---------- Search ---------- */

const normalise = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');

function tokens(query: string): string[] {
  return normalise(query).split(/\s+/).filter(Boolean);
}

/** Each query word must appear in the dish name, description or category. Plurals are forgiven. */
export function searchDishes(query: string, list: readonly Dish[] = dishes): Dish[] {
  const words = tokens(query);
  if (words.length === 0) return [];
  const scored = list
    .map((dish) => {
      const name = normalise(dish.name);
      const hay = `${name} ${normalise(dish.description)} ${normalise(getCategory(dish.categoryId)?.name ?? '')}`;
      let score = 0;
      for (const word of words) {
        const stem = word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
        if (name.includes(word) || name.includes(stem)) score += 2;
        else if (hay.includes(word) || hay.includes(stem)) score += 1;
        else return null;
      }
      return { dish, score };
    })
    .filter((r): r is { dish: Dish; score: number } => r !== null);
  // Best match keeps menu order among equal scores, so results read like the menu.
  return scored.sort((a, b) => b.score - a.score).map((r) => r.dish);
}

export interface TextPart {
  text: string;
  match: boolean;
}

/** Splits `text` into matched / unmatched parts for highlighting the query words. */
export function highlight(text: string, query: string): TextPart[] {
  const words = tokens(query).map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
  if (words.length === 0) return [{ text, match: false }];
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  return text
    .split(re)
    .filter(Boolean)
    .map((part) => ({ text: part, match: words.some((w) => part.toLowerCase() === w) }));
}
