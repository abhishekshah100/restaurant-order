import type { DietaryMark } from '@/types/branch';
import type { Category, CategoryId, Dish, DishImage, MenuData, Price } from '@/types/menu';

/** The menu from GET /menu, with lookups. Build one with createMenuCatalog. */
export interface MenuCatalog extends MenuData {
  getCategory(id: string): Category | undefined;
  getDish(slug: string): Dish | undefined;
  dishesIn(categoryId: CategoryId): Dish[];
  categoryCount(categoryId: CategoryId): number;
  /** "8 dishes" / "14 drinks": the count with the category's unit word from the API. */
  categoryCountLabel(category: Category): string;
  /** The chef's picks, in rail order. */
  featuredDishes(): Dish[];
  /** Each query word must appear in the dish name, description or category. Plurals are forgiven. */
  searchDishes(query: string, list?: readonly Dish[]): Dish[];
}

const catalogs = new WeakMap<MenuData, MenuCatalog>();

/** The catalog for a menu response. Built once per response object, so lookups stay cheap. */
export function createMenuCatalog(data: MenuData): MenuCatalog {
  const cached = catalogs.get(data);
  if (cached) return cached;

  const categoriesById = new Map<string, Category>(data.categories.map((c) => [c.id, c]));
  const dishesBySlug = new Map(data.dishes.map((d) => [d.slug, d]));
  const getCategory = (id: string) => categoriesById.get(id);
  const getDish = (slug: string) => dishesBySlug.get(slug);
  const dishesIn = (categoryId: CategoryId) =>
    data.dishes.filter((d) => d.categoryId === categoryId);
  const categoryCount = (categoryId: CategoryId) => dishesIn(categoryId).length;

  const catalog: MenuCatalog = {
    ...data,
    getCategory,
    getDish,
    dishesIn,
    categoryCount,
    categoryCountLabel: (category) => `${categoryCount(category.id)} ${category.unit}`,
    featuredDishes: () =>
      data.chefsPicks.map((slug) => getDish(slug)).filter((d): d is Dish => d !== undefined),
    searchDishes: (query, list = data.dishes) =>
      searchDishes(query, list, (id) => getCategory(id)?.name ?? ''),
  };
  catalogs.set(data, catalog);
  return catalog;
}

export const isAvailable = (dish: Dish) => dish.availability.status === 'available';

/** Something to choose: more than one size, an option group or add-ons. A single size alone isn't a choice. */
export const isCustomisable = (dish: Dish) =>
  Boolean(
    (dish.variants?.length ?? 0) > 1 ||
    dish.optionGroups?.length ||
    dish.addOns?.length ||
    dish.removables?.length,
  );

/** "From" price shown on menu cards: the cheapest available size, or the dish price. */
export function startingPrice(dish: Dish): number {
  const prices = (dish.variants ?? []).filter((v) => v.available !== false).map((v) => v.price);
  return prices.length ? Math.min(...prices) : dish.price;
}

export const isSpicy = (dish: Dish) => dish.spice === 'medium' || dish.spice === 'hot';

/**
 * Why a dish can't be ordered right now, or undefined when it can. Components turn this into
 * copy (menu content: availability.*): "Sold out", "Back 8 PM", "Unavailable today".
 */
export type UnavailableReason =
  { kind: 'sold-out' } | { kind: 'back-at'; time: string } | { kind: 'unavailable-today' };

export function unavailableReason(dish: Dish): UnavailableReason | undefined {
  const a = dish.availability;
  if (a.status === 'sold-out')
    return a.backAt ? { kind: 'back-at', time: a.backAt } : { kind: 'sold-out' };
  if (a.status === 'unavailable-today') return { kind: 'unavailable-today' };
  return undefined;
}

export function dishImage(dish: Dish, kind: 'hero' | 'card' | 'thumb'): DishImage | undefined {
  if (kind === 'thumb') return dish.thumb ?? dish.image;
  return dish.image;
}

/* ---------- Filters and sorting ---------- */

/** All dishes, or only those with one dietary mark (the branch lists its marks). */
export type Diet = 'all' | DietaryMark;
export type SortKey = 'recommended' | 'price-asc' | 'price-desc' | 'best-match';

export interface MenuFilters {
  diet: Diet;
  spicy: boolean;
  chefs: boolean;
  /** Only dishes under the menu's price filter (GET /branches/:id/menu › priceFilter). */
  underPrice: boolean;
}

export const DEFAULT_FILTERS: MenuFilters = {
  diet: 'all',
  spicy: false,
  chefs: false,
  underPrice: false,
};

/** The dietary mark a dish carries. */
export const dietaryMark = (dish: Pick<Dish, 'veg'>): DietaryMark => (dish.veg ? 'veg' : 'nonveg');

/** Whether a mark is drawn as the vegetarian one (VegMark and Chip take `veg`). */
export const isVegMark = (mark: DietaryMark) => mark === 'veg';

/** The dishes that pass the filters; `priceLimit` is the menu's "Under {price}" limit. */
export function applyFilters(list: readonly Dish[], f: MenuFilters, priceLimit: Price): Dish[] {
  return list.filter(
    (d) =>
      (f.diet === 'all' || dietaryMark(d) === f.diet) &&
      (!f.spicy || isSpicy(d)) &&
      (!f.chefs || d.featured || d.tags.includes('chef')) &&
      (!f.underPrice || d.price < priceLimit),
  );
}

export function hasActiveFilters(f: MenuFilters): boolean {
  return f.diet !== 'all' || f.spicy || f.chefs || f.underPrice;
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

/**
 * Which result summary fits the filters (menu content: filters.summary.*): "Showing 7 vegetarian
 * dishes" for veg alone, "non-vegetarian" for non-veg alone, else "Showing 7 of 12 dishes".
 */
export type FilterSummaryKind = DietaryMark | 'mixed';

export function filterSummaryKind(f: MenuFilters): FilterSummaryKind {
  const dietOnly = !f.spicy && !f.chefs && !f.underPrice;
  return dietOnly && f.diet !== 'all' ? f.diet : 'mixed';
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

/** Forgives a plural: "kebabs" → "kebab". Words of three letters or fewer are left alone. */
const stem = (word: string) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word);

function searchDishes(
  query: string,
  list: readonly Dish[],
  categoryName: (id: CategoryId) => string,
): Dish[] {
  const words = tokens(query);
  if (words.length === 0) return [];
  const scored = list
    .map((dish) => {
      const name = normalise(dish.name);
      const hay = `${name} ${normalise(dish.description)} ${normalise(categoryName(dish.categoryId))}`;
      let score = 0;
      for (const word of words) {
        const base = stem(word);
        if (name.includes(word) || name.includes(base)) score += 2;
        else if (hay.includes(word) || hay.includes(base)) score += 1;
        else return null;
      }
      return { dish, score };
    })
    .filter((r): r is { dish: Dish; score: number } => r !== null);
  // Best match keeps menu order among equal scores, so results read like the menu.
  return scored.sort((a, b) => b.score - a.score).map((r) => r.dish);
}

interface TextPart {
  text: string;
  match: boolean;
}

/** Splits `text` into matched / unmatched parts for highlighting the query words. */
export function highlight(text: string, query: string): TextPart[] {
  const words = tokens(query).map(stem);
  if (words.length === 0) return [{ text, match: false }];
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  return text
    .split(re)
    .filter(Boolean)
    .map((part) => ({ text: part, match: words.some((w) => part.toLowerCase() === w) }));
}
