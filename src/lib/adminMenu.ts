import type { DishInput, SetAvailabilityRequest } from '@/api/contracts';
import type {
  Allergen,
  CategoryId,
  Dish,
  DishAvailability,
  DishImage,
  DishTag,
  MenuData,
  Price,
  SpiceLevel,
} from '@/types/menu';
import type { MenuCatalog } from './menu';

/*
 * The staff Menu page's logic, pure: each dish's state and the status filter with its counts,
 * search and category, sold-out-until times, the change shown before the server confirms, and
 * the dish editor's form (its checks, and the request it becomes).
 */

export type MenuStatus = 'available' | 'soldOut' | 'offToday';
export type MenuStatusFilter = 'all' | MenuStatus;

export const MENU_STATUS_FILTERS: readonly MenuStatusFilter[] = [
  'all',
  'available',
  'soldOut',
  'offToday',
];

export function menuStatus(dish: Pick<Dish, 'availability'>): MenuStatus {
  if (dish.availability.status === 'sold-out') return 'soldOut';
  if (dish.availability.status === 'unavailable-today') return 'offToday';
  return 'available';
}

/** Sizes switched off on a dish that's otherwise available. */
export const sizesOff = (dish: Dish) => (dish.variants ?? []).filter((v) => v.available === false);

export function menuCounts(dishes: readonly Dish[]): Record<MenuStatusFilter, number> {
  const counts: Record<MenuStatusFilter, number> = {
    all: dishes.length,
    available: 0,
    soldOut: 0,
    offToday: 0,
  };
  for (const dish of dishes) counts[menuStatus(dish)] += 1;
  return counts;
}

export interface MenuFilters {
  status: MenuStatusFilter;
  category: CategoryId | 'all';
  query: string;
}

/** The dishes to list, by category in menu order; a search lists every match in one group. */
export function menuSections(menu: MenuCatalog, { status, category, query }: MenuFilters) {
  const keep = (d: Dish) => status === 'all' || menuStatus(d) === status;
  if (query.trim()) {
    return [{ id: 'results', name: '', dishes: menu.searchDishes(query).filter(keep) }];
  }
  return menu.categories
    .filter((c) => category === 'all' || c.id === category)
    .map((c) => ({ id: c.id, name: c.name, dishes: menu.dishesIn(c.id).filter(keep) }))
    .filter((section) => section.dishes.length > 0);
}

/** The next few times on the half hour, for "sold out until…". */
export function backAtTimes(now: Date, count = 6, stepMinutes = 30): Date[] {
  const step = stepMinutes * 60_000;
  const first = Math.ceil((now.getTime() + 15 * 60_000) / step) * step;
  return Array.from({ length: count }, (_, i) => new Date(first + i * step));
}

/** The menu with a dish's availability (and sizes) as staff just set them. */
export function withAvailability(
  menu: MenuData,
  slug: string,
  { availability, variants }: SetAvailabilityRequest,
): MenuData {
  return {
    ...menu,
    dishes: menu.dishes.map((dish) => {
      if (dish.slug !== slug) return dish;
      const sizes = dish.variants?.map((v) => {
        if (!variants || !(v.id in variants)) return v;
        const { available: _was, ...size } = v;
        return variants[v.id] === false ? { ...size, available: false } : size;
      });
      return { ...dish, availability, ...(sizes ? { variants: sizes } : {}) };
    }),
  };
}

/* ---------- The dish editor ---------- */

/*
 * The form keeps every list as rows with a stable key. Choices, groups and add-ons limited to
 * some sizes refer to size rows by key, so renaming a size keeps them; ids are worked out when
 * the form is sent (an existing size keeps its id, a new one gets one from its name).
 */

export interface SizeRow {
  key: string;
  /** The size's id on an existing dish. */
  id?: string;
  name: string;
  /** A note guests see under it ("Perfect for one"). */
  note: string;
  price: string;
  available: boolean;
}

export interface ChoiceRow {
  key: string;
  name: string;
  /** Extra cost ("" or 0: included). */
  price: string;
  /** Size row keys it's offered with (none: every size). */
  onlySizes: string[];
}

export interface GroupRow {
  key: string;
  id?: string;
  name: string;
  /** Always name the choice on the order (a meal's slots). */
  showInSummary: boolean;
  onlySizes: string[];
  choices: ChoiceRow[];
}

export interface AddOnRow {
  key: string;
  id?: string;
  name: string;
  /** "" or 0: free. */
  price: string;
  onlySizes: string[];
  /** A price per size row key, when it differs by size (null: one price). */
  sizePrices: Record<string, string> | null;
}

export interface NameRow {
  key: string;
  id?: string;
  name: string;
}

export interface DishForm {
  name: string;
  description: string;
  longDescription: string;
  categoryId: CategoryId;
  veg: boolean;
  tags: DishTag[];
  spice: SpiceLevel | '';
  prepTime: string;
  serves: string;
  pricing: 'single' | 'sizes';
  price: string;
  sizeLabel: string;
  sizes: SizeRow[];
  groups: GroupRow[];
  addOns: AddOnRow[];
  /** "" : no limit. */
  maxAddOns: string;
  removables: NameRow[];
  quickInstructions: string[];
  meal: boolean;
  mealIncludes: string;
  mealSavings: string;
  allergens: Allergen[];
  image: DishImage | null;
  status: DishAvailability['status'];
}

let rowCount = 0;
const rowKey = () => `row-${++rowCount}`;

export const newSizeRow = (): SizeRow => ({
  key: rowKey(),
  name: '',
  note: '',
  price: '',
  available: true,
});
export const newChoiceRow = (): ChoiceRow => ({
  key: rowKey(),
  name: '',
  price: '',
  onlySizes: [],
});
export const newGroupRow = (): GroupRow => ({
  key: rowKey(),
  name: '',
  showInSummary: false,
  onlySizes: [],
  choices: [newChoiceRow(), newChoiceRow()],
});
export const newAddOnRow = (): AddOnRow => ({
  key: rowKey(),
  name: '',
  price: '',
  onlySizes: [],
  sizePrices: null,
});
export const newNameRow = (): NameRow => ({ key: rowKey(), name: '' });

const priceText = (price: Price | undefined) => (price ? String(price) : '');

/** The form for a dish (or a new one in this category). */
export function dishForm(dish: Dish | undefined, categoryId: CategoryId): DishForm {
  const sizes: SizeRow[] =
    dish?.variants && dish.variants.length > 0
      ? dish.variants.map((v) => ({
          key: rowKey(),
          id: v.id,
          name: v.name,
          note: v.description ?? '',
          price: String(v.price),
          available: v.available !== false,
        }))
      : [newSizeRow(), newSizeRow()];
  // Size ids on the dish → the rows' keys.
  const keysOf = (ids: readonly string[] | undefined) =>
    (ids ?? []).flatMap((id) => sizes.filter((s) => s.id === id).map((s) => s.key));
  return {
    name: dish?.name ?? '',
    description: dish?.description ?? '',
    longDescription: dish?.longDescription ?? '',
    categoryId: dish?.categoryId ?? categoryId,
    veg: dish?.veg ?? true,
    tags: dish?.tags ?? [],
    spice: dish?.spice ?? '',
    prepTime: dish?.prepTime ?? '',
    serves: dish?.serves ? String(dish.serves) : '',
    pricing: dish?.variants && dish.variants.length > 0 ? 'sizes' : 'single',
    price: dish ? String(dish.price) : '',
    sizeLabel: dish?.variantLabel ?? '',
    sizes,
    groups: (dish?.optionGroups ?? []).map((g) => ({
      key: rowKey(),
      id: g.id,
      name: g.name,
      showInSummary: g.showInSummary === true,
      onlySizes: keysOf(g.availableFor),
      choices: g.choices.map((c) => {
        const choice = typeof c === 'string' ? { name: c } : c;
        return {
          key: rowKey(),
          name: choice.name,
          price: priceText(choice.price),
          onlySizes: keysOf(choice.availableFor),
        };
      }),
    })),
    addOns: (dish?.addOns ?? []).map((a) => ({
      key: rowKey(),
      id: a.id,
      name: a.name,
      price: priceText(a.price),
      onlySizes: keysOf(a.availableFor),
      sizePrices: a.priceByVariant
        ? Object.fromEntries(
            sizes.map((s) => [s.key, priceText(s.id ? a.priceByVariant?.[s.id] : undefined)]),
          )
        : null,
    })),
    maxAddOns: dish?.maxAddOns ? String(dish.maxAddOns) : '',
    removables: (dish?.removables ?? []).map((r) => ({ key: rowKey(), id: r.id, name: r.name })),
    quickInstructions: dish?.quickInstructions ?? [],
    meal: Boolean(dish?.combo),
    mealIncludes: dish?.combo?.includes ?? '',
    mealSavings: priceText(dish?.combo?.savings),
    allergens: dish?.allergens ?? [],
    image: dish?.image ?? null,
    status: dish?.availability.status ?? 'available',
  };
}

/** A price: above 0, or (free) 0 and empty too. */
function priceOf(value: string, free = false): number | null {
  const trimmed = value.trim();
  if (!trimmed) return free ? 0 : null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n > 0 || (free && n === 0) ? n : null;
}

const twice = (names: readonly string[]) => {
  const named = names.map((n) => n.trim().toLowerCase()).filter(Boolean);
  return new Set(named).size !== named.length;
};

const count = (value: string, max: number) => {
  const n = Number(value.trim());
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
};

export type DishFormError =
  | 'name'
  | 'price'
  | 'sizes'
  | 'sizeNames'
  | 'groups'
  | 'addOns'
  | 'maxAddOns'
  | 'removables'
  | 'meal'
  | 'serves';

/** What's missing or wrong, if anything (one entry per part of the form). */
export function dishFormErrors(form: DishForm): DishFormError[] {
  const errors: DishFormError[] = [];
  if (!form.name.trim()) errors.push('name');
  if (form.pricing === 'single' && priceOf(form.price) === null) errors.push('price');
  if (form.pricing === 'sizes') {
    if (
      form.sizes.length < 1 ||
      form.sizes.some((s) => !s.name.trim() || priceOf(s.price) === null)
    ) {
      errors.push('sizes');
    }
    if (twice(form.sizes.map((s) => s.name))) errors.push('sizeNames');
  }
  const groupBad = form.groups.some(
    (g) =>
      !g.name.trim() ||
      g.choices.length < 2 ||
      g.choices.some((c) => !c.name.trim() || priceOf(c.price, true) === null) ||
      twice(g.choices.map((c) => c.name)),
  );
  if (groupBad || twice(form.groups.map((g) => g.name))) errors.push('groups');
  const addOnBad = form.addOns.some(
    (a) =>
      !a.name.trim() ||
      priceOf(a.price, true) === null ||
      Object.values(a.sizePrices ?? {}).some((p) => priceOf(p, true) === null),
  );
  if (addOnBad || twice(form.addOns.map((a) => a.name))) errors.push('addOns');
  if (form.maxAddOns.trim() && count(form.maxAddOns, form.addOns.length) === null) {
    errors.push('maxAddOns');
  }
  if (form.removables.some((r) => !r.name.trim()) || twice(form.removables.map((r) => r.name))) {
    errors.push('removables');
  }
  if (form.meal && (!form.mealIncludes.trim() || priceOf(form.mealSavings, true) === null)) {
    errors.push('meal');
  }
  if (form.serves.trim() && count(form.serves, 20) === null) errors.push('serves');
  return errors;
}

/** "Half · 6 pcs" → "half-6-pcs": the id a new size is sent with. */
const sizeSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'size';

/** Each size row's id: its own, or one from its name not used by another size. */
function sizeIds(sizes: readonly SizeRow[]): Map<string, string> {
  const taken = new Set(sizes.flatMap((s) => (s.id ? [s.id] : [])));
  return new Map(
    sizes.map((s) => {
      if (s.id) return [s.key, s.id];
      const base = sizeSlug(s.name);
      let id = base;
      for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
      taken.add(id);
      return [s.key, id];
    }),
  );
}

/** The request a checked form becomes; a sold-out time already set is kept. */
export function dishInputOf(form: DishForm, current?: DishAvailability): DishInput {
  const sized = form.pricing === 'sizes';
  const ids = sizeIds(form.sizes);
  // Size row keys → ids; every size (or none) means no limit.
  const only = (keys: readonly string[]) => {
    const picked = sized ? keys.flatMap((k) => (ids.has(k) ? [ids.get(k) as string] : [])) : [];
    return picked.length > 0 && picked.length < form.sizes.length ? { availableFor: picked } : {};
  };
  let availability: DishAvailability = { status: 'available' };
  if (form.status === 'unavailable-today') availability = { status: 'unavailable-today' };
  if (form.status === 'sold-out') {
    availability = current?.status === 'sold-out' ? current : { status: 'sold-out' };
  }
  const maxAddOns = count(form.maxAddOns, form.addOns.length);
  const serves = count(form.serves, 20);
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    ...(form.longDescription.trim() ? { longDescription: form.longDescription.trim() } : {}),
    categoryId: form.categoryId,
    veg: form.veg,
    tags: form.tags,
    ...(form.spice ? { spice: form.spice } : {}),
    ...(form.prepTime.trim() ? { prepTime: form.prepTime.trim() } : {}),
    ...(serves ? { serves } : {}),
    ...(sized
      ? {
          ...(form.sizeLabel.trim() ? { variantLabel: form.sizeLabel.trim() } : {}),
          variants: form.sizes.map((s) => ({
            id: ids.get(s.key),
            name: s.name.trim(),
            ...(s.note.trim() ? { description: s.note.trim() } : {}),
            price: priceOf(s.price) ?? 0,
            available: s.available,
          })),
        }
      : { price: priceOf(form.price) ?? 0 }),
    optionGroups: form.groups.map((g) => ({
      ...(g.id ? { id: g.id } : {}),
      name: g.name.trim(),
      ...(g.showInSummary ? { showInSummary: true } : {}),
      ...only(g.onlySizes),
      choices: g.choices.map((c) => ({
        name: c.name.trim(),
        ...(priceOf(c.price, true) ? { price: priceOf(c.price, true) ?? 0 } : {}),
        ...only(c.onlySizes),
      })),
    })),
    addOns: form.addOns.map((a) => ({
      ...(a.id ? { id: a.id } : {}),
      name: a.name.trim(),
      price: priceOf(a.price, true) ?? 0,
      ...only(a.onlySizes),
      ...(sized && a.sizePrices
        ? {
            // A size left empty takes the add-on's own price.
            priceByVariant: Object.fromEntries(
              form.sizes.flatMap((s) => {
                const price = a.sizePrices?.[s.key]?.trim();
                return price ? [[ids.get(s.key), priceOf(price, true) ?? 0]] : [];
              }),
            ),
          }
        : {}),
    })),
    ...(maxAddOns ? { maxAddOns } : {}),
    removables: form.removables.map((r) => ({
      ...(r.id ? { id: r.id } : {}),
      name: r.name.trim(),
    })),
    quickInstructions: form.quickInstructions,
    ...(form.meal
      ? {
          combo: {
            includes: form.mealIncludes.trim(),
            ...(priceOf(form.mealSavings, true)
              ? { savings: priceOf(form.mealSavings, true) ?? 0 }
              : {}),
          },
        }
      : {}),
    allergens: form.allergens,
    ...(form.image ? { image: form.image } : {}),
    availability,
  };
}

/** The list with the item at `index` moved one place up (-1) or down (1); unchanged at an end. */
export function moveItem<T>(items: readonly T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (to < 0 || to >= items.length) return [...items];
  const next = [...items];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
