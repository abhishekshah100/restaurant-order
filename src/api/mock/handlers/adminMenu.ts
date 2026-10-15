import { createClock } from '@/lib/clock';
import type { Branch } from '@/types/branch';
import type {
  AddOn,
  Allergen,
  Category,
  ComboInfo,
  Dish,
  DishAvailability,
  DishImage,
  DishTag,
  MenuData,
  OptionGroup,
  Removable,
  SpiceLevel,
  Variant,
} from '@/types/menu';
import type { ImageUploadResponse } from '../../contracts';
import { fail, isObject, ok, type Handler, type MockContext } from '../context';
import { noMenuChanges, type BranchMenuChanges } from '../menuChanges';
import { adminBranch } from './adminSessions';

/*
 * The menu: GET /branches/:id/menu for everyone (the dummy JSON with staff changes on top), and
 * staff changing it — a dish's availability (and its sizes'), adding, editing and removing
 * dishes (sizes, choice groups, add-ons, leave-out options, allergens, picture…), the order of
 * dishes in a category, and the categories' names and order. Changes are kept per branch
 * (db.menuChanges) and every reader sees them: the guest's menu and the server's own pricing.
 */

const LIMITS = {
  name: 60,
  description: 200,
  longDescription: 600,
  label: 40,
  prepTime: 20,
  backAt: 20,
  includes: 120,
  instruction: 30,
  price: 1_000_000,
  list: 20,
  groups: 10,
  serves: 20,
  /** A picture as a data URL (the mock keeps it in Web Storage). */
  image: 400_000,
};

const TAGS: readonly DishTag[] = ['chef', 'new', 'bestseller'];
const SPICE: readonly SpiceLevel[] = ['mild', 'medium', 'hot'];
const ALLERGENS: readonly Allergen[] = [
  'dairy',
  'gluten',
  'nuts',
  'shellfish',
  'egg',
  'soy',
  'sesame',
];
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

/* ---------- Checking what staff send ---------- */

const bad = (): never => fail(400, 'invalid_request');

/** "Masala Dosa (Large)" → "masala-dosa-large". */
const toSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'item';

/** `base`, or `base-2`, `base-3`… — the first not taken. */
function unique(base: string, taken: ReadonlySet<string>) {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

const isPrice = (v: unknown, free = false): v is number =>
  typeof v === 'number' && Number.isFinite(v) && (free ? v >= 0 : v > 0) && v <= LIMITS.price;

const isCount = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= max;

function text(v: unknown, max: number, required = true): string {
  if (typeof v !== 'string') return bad();
  const value = v.trim();
  if ((required && !value) || value.length > max) bad();
  return value;
}

const optionalText = (v: unknown, max: number) =>
  v === undefined || v === null ? undefined : text(v, max, false) || undefined;

function list(v: unknown, max = LIMITS.list): unknown[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > max) return bad();
  return v;
}

/** A subset of `allowed`, each once. */
function subset<T extends string>(v: unknown, allowed: readonly T[]): T[] {
  const picked = list(v).map((x) => allowed.find((a) => a === x) ?? bad());
  if (new Set(picked).size !== picked.length) bad();
  return picked;
}

/** The id staff sent (when it's a valid one not taken yet), else one made from the name. */
function idFor(raw: unknown, name: string, taken: Set<string>) {
  const id =
    typeof raw === 'string' && ID.test(raw) && !taken.has(raw) ? raw : unique(toSlug(name), taken);
  taken.add(id);
  return id;
}

/** Names in a list must differ (in any case). */
function distinct(names: readonly string[]) {
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) bad();
}

/** A dish availability: sold out until a time comes back then, off today comes back tomorrow. */
function availabilityOf(v: unknown, now: number, branch: Branch): DishAvailability {
  if (!isObject(v)) return bad();
  if (v.status === 'available') return { status: 'available' };
  if (v.status === 'unavailable-today') {
    return { status: 'unavailable-today', day: createClock(branch).dayKey(new Date(now)) };
  }
  if (v.status !== 'sold-out') return bad();
  const backAt = optionalText(v.backAt, LIMITS.backAt);
  if (v.until === undefined)
    return backAt ? { status: 'sold-out', backAt } : { status: 'sold-out' };
  if (typeof v.until !== 'string' || !(Date.parse(v.until) > now) || !backAt) return bad();
  return { status: 'sold-out', backAt, until: new Date(v.until).toISOString() };
}

/** One or more sizes (one: a named size, e.g. "Regular · 350 ml"), each named once and priced. */
function sizesOf(v: unknown): Variant[] {
  const raw = list(v);
  if (raw.length < 1) bad();
  const ids = new Set<string>();
  const sizes = raw.map((s): Variant => {
    if (!isObject(s) || !isPrice(s.price)) return bad();
    const name = text(s.name, LIMITS.label);
    const description = optionalText(s.description, LIMITS.label);
    return {
      id: idFor(s.id, name, ids),
      name,
      ...(description ? { description } : {}),
      price: s.price,
      ...(s.available === false ? { available: false } : {}),
    };
  });
  distinct(sizes.map((s) => s.name));
  return sizes;
}

/** The sizes a choice, group or add-on is limited to (every size: none). */
function onlyWith(v: unknown, sizes: readonly Variant[]): string[] | undefined {
  if (v === undefined) return undefined;
  const ids = subset(
    v,
    sizes.map((s) => s.id),
  );
  return ids.length > 0 && ids.length < sizes.length ? ids : undefined;
}

function choiceGroupsOf(v: unknown, sizes: readonly Variant[]): OptionGroup[] {
  const ids = new Set<string>();
  const groups = list(v, LIMITS.groups).map((g): OptionGroup => {
    if (!isObject(g)) return bad();
    const name = text(g.name, LIMITS.name);
    const choices = list(g.choices).map((c) => {
      if (!isObject(c) || (c.price !== undefined && !isPrice(c.price, true))) return bad();
      const only = onlyWith(c.availableFor, sizes);
      return {
        name: text(c.name, LIMITS.name),
        ...(typeof c.price === 'number' && c.price > 0 ? { price: c.price } : {}),
        ...(only ? { availableFor: only } : {}),
      };
    });
    if (choices.length < 2) bad();
    distinct(choices.map((c) => c.name));
    const only = onlyWith(g.availableFor, sizes);
    return {
      id: idFor(g.id, name, ids),
      name,
      choices,
      ...(only ? { availableFor: only } : {}),
      ...(g.showInSummary === true ? { showInSummary: true } : {}),
    };
  });
  distinct(groups.map((g) => g.name));
  return groups;
}

/** Prices per size id, each one of the dish's sizes. */
function sizePrices(v: unknown, sizes: readonly Variant[]): Record<string, number> | undefined {
  if (v === undefined) return undefined;
  if (!isObject(v)) return bad();
  const prices = Object.entries(v).map(([id, price]) =>
    sizes.some((s) => s.id === id) && isPrice(price, true) ? ([id, price] as const) : bad(),
  );
  return prices.length > 0 ? Object.fromEntries(prices) : undefined;
}

function addOnsOf(v: unknown, sizes: readonly Variant[]): AddOn[] {
  const ids = new Set<string>();
  const addOns = list(v).map((a): AddOn => {
    if (!isObject(a) || !isPrice(a.price, true)) return bad();
    const name = text(a.name, LIMITS.name);
    const only = onlyWith(a.availableFor, sizes);
    const byVariant = sizePrices(a.priceByVariant, sizes);
    return {
      id: idFor(a.id, name, ids),
      name,
      price: a.price,
      ...(only ? { availableFor: only } : {}),
      ...(byVariant ? { priceByVariant: byVariant } : {}),
    };
  });
  distinct(addOns.map((a) => a.name));
  return addOns;
}

function removablesOf(v: unknown): Removable[] {
  const ids = new Set<string>();
  const items = list(v).map((r): Removable => {
    if (!isObject(r)) return bad();
    const name = text(r.name, LIMITS.label);
    return { id: idFor(r.id, name, ids), name };
  });
  distinct(items.map((r) => r.name));
  return items;
}

function comboOf(v: unknown): ComboInfo | undefined {
  if (v === undefined || v === null) return undefined;
  if (!isObject(v) || (v.savings !== undefined && !isPrice(v.savings, true))) return bad();
  return {
    includes: text(v.includes, LIMITS.includes),
    ...(typeof v.savings === 'number' && v.savings > 0 ? { savings: v.savings } : {}),
  };
}

function imageOf(v: unknown, name: string): DishImage | undefined {
  if (v === undefined || v === null) return undefined;
  if (
    !isObject(v) ||
    typeof v.src !== 'string' ||
    !(v.src.startsWith('/images/') || v.src.startsWith('data:image/')) ||
    v.src.length > LIMITS.image ||
    typeof v.width !== 'number' ||
    typeof v.height !== 'number'
  ) {
    return bad();
  }
  return { src: v.src, alt: name, width: v.width, height: v.height };
}

/** Everything staff set on a dish (DishInput), checked against the branch's menu. */
function dishInput(body: unknown, menu: MenuData, now: number, branch: Branch) {
  if (!isObject(body)) return bad();
  const category = menu.categories.find((c) => c.id === body.categoryId) ?? bad();
  if (typeof body.veg !== 'boolean') bad();
  const variants = body.variants === undefined ? undefined : sizesOf(body.variants);
  if (!variants && !isPrice(body.price)) bad();
  const sizes = variants ?? [];
  const addOns = addOnsOf(body.addOns, sizes);
  const { maxAddOns, serves } = body;
  if (maxAddOns !== undefined && !isCount(maxAddOns, addOns.length)) bad();
  if (serves !== undefined && !isCount(serves, LIMITS.serves)) bad();
  const spice =
    body.spice === undefined ? undefined : (SPICE.find((s) => s === body.spice) ?? bad());
  const quick = list(body.quickInstructions, 10).map((q) => text(q, LIMITS.instruction));
  distinct(quick);
  const name = text(body.name, LIMITS.name);
  const image = imageOf(body.image, name);
  const optionGroups = choiceGroupsOf(body.optionGroups, sizes);
  const removables = removablesOf(body.removables);
  const combo = comboOf(body.combo);
  const longDescription = optionalText(body.longDescription, LIMITS.longDescription);
  const variantLabel = variants ? optionalText(body.variantLabel, LIMITS.label) : undefined;
  const prepTime = optionalText(body.prepTime, LIMITS.prepTime);
  return {
    name,
    description: text(body.description ?? '', LIMITS.description, false),
    categoryId: category.id,
    veg: body.veg === true,
    // With sizes, the dish price is the cheapest of them (the menu's "from" price).
    price: variants ? Math.min(...variants.map((s) => s.price)) : Number(body.price),
    tags: subset(body.tags, TAGS),
    allergens: subset(body.allergens, ALLERGENS),
    availability: availabilityOf(body.availability ?? { status: 'available' }, now, branch),
    // The optional parts only when set, so the dish reads like the JSON.
    ...(longDescription ? { longDescription } : {}),
    ...(variants ? { variants } : {}),
    ...(variantLabel ? { variantLabel } : {}),
    ...(optionGroups.length > 0 ? { optionGroups } : {}),
    ...(addOns.length > 0 ? { addOns } : {}),
    ...(isCount(maxAddOns, addOns.length) ? { maxAddOns } : {}),
    ...(removables.length > 0 ? { removables } : {}),
    ...(quick.length > 0 ? { quickInstructions: quick } : {}),
    ...(combo ? { combo } : {}),
    ...(spice ? { spice } : {}),
    ...(prepTime ? { prepTime } : {}),
    ...(isCount(serves, LIMITS.serves) ? { serves } : {}),
    ...(image ? { image, thumb: image } : {}),
  };
}

/* ---------- Keeping the changes ---------- */

/** The parts of a dish the editor sets; the rest (featured, card description…) is kept. */
const EDITED = new Set<string>([
  'longDescription',
  'variants',
  'variantLabel',
  'optionGroups',
  'addOns',
  'maxAddOns',
  'removables',
  'quickInstructions',
  'combo',
  'spice',
  'prepTime',
  'serves',
  'image',
  'thumb',
]);

/** A dish without the parts the editor sets, so a part it cleared doesn't come back. */
function withoutEdited(dish: Dish): Dish {
  const kept = { ...dish };
  for (const key of Object.keys(kept) as (keyof Dish)[]) {
    if (EDITED.has(key)) delete kept[key];
  }
  return kept;
}

/** After the last dish of a category (its "Recommended" order). */
const nextRank = (menu: MenuData, categoryId: string) =>
  Math.max(0, ...menu.dishes.filter((d) => d.categoryId === categoryId).map((d) => d.rank + 1));

/** Reads, changes and writes one branch's menu changes. */
function changeMenu(
  ctx: MockContext,
  branchId: string,
  change: (changes: BranchMenuChanges) => BranchMenuChanges,
) {
  const all = ctx.db.menuChanges.read();
  ctx.db.menuChanges.write({ ...all, [branchId]: change(all[branchId] ?? noMenuChanges()) });
}

const keepDishes = (dishes: readonly Dish[]) => (changes: BranchMenuChanges) => ({
  ...changes,
  dishes: { ...changes.dishes, ...Object.fromEntries(dishes.map((d) => [d.slug, d])) },
});

/** The branch (one the admin manages) and its menu as now. */
async function staffMenu(ctx: MockContext, headers: Record<string, string>, branchId: string) {
  const branch = await adminBranch(ctx, headers, branchId);
  return { branch, menu: await ctx.seed.menuData(branch.id) };
}

/** The dish in the path, or 404. */
const dishIn = (menu: MenuData, slug: string): Dish =>
  menu.dishes.find((d) => d.slug === slug) ?? fail(404, 'not_found');

/* ---------- Handlers ---------- */

/** GET /branches: the branch data with the status staff set (paused, closed for the day). */
export const listBranches: Handler = async (ctx) => ok(await ctx.seed.branches());

/** GET /branches/:branchId/menu */
export const branchMenu: Handler = async (ctx, { params }) => {
  const branch = (await ctx.seed.branches()).find((b) => b.id === params.branchId);
  if (!branch) fail(404, 'not_found');
  return ok(await ctx.seed.menuData(branch.id));
};

/** PATCH /admin/branches/:branchId/menu/dishes/:slug/availability */
export const setDishAvailability: Handler = async (ctx, { params, body, headers }) => {
  const { branch, menu } = await staffMenu(ctx, headers, params.branchId);
  const dish = dishIn(menu, params.slug);
  if (!isObject(body)) return bad();
  const availability = availabilityOf(body.availability, ctx.now(), branch);
  // Sizes switched on or off: { half: true, full: false }.
  let { variants } = dish;
  if (body.variants !== undefined) {
    const sizes = body.variants;
    if (!isObject(sizes) || !variants) return bad();
    const known = variants;
    if (
      !Object.entries(sizes).every(
        ([id, on]) => known.some((v) => v.id === id) && typeof on === 'boolean',
      )
    ) {
      bad();
    }
    variants = known.map((v) => {
      if (!(v.id in sizes)) return v;
      const { available: _was, ...size } = v;
      return sizes[v.id] === false ? { ...size, available: false } : size;
    });
  }
  const saved: Dish = { ...dish, availability, ...(variants ? { variants } : {}) };
  changeMenu(ctx, branch.id, keepDishes([saved]));
  return ok(saved);
};

/** POST /admin/branches/:branchId/menu/dishes */
export const createDish: Handler = async (ctx, { params, body, headers }) => {
  const { branch, menu } = await staffMenu(ctx, headers, params.branchId);
  const input = dishInput(body, menu, ctx.now(), branch);
  // A removed dish's slug isn't used again (orders may still name it).
  const taken = new Set([
    ...menu.dishes.map((d) => d.slug),
    ...(ctx.db.menuChanges.read()[branch.id]?.removed ?? []),
  ]);
  const dish: Dish = {
    slug: unique(toSlug(input.name), taken),
    ...input,
    rank: nextRank(menu, input.categoryId),
  };
  changeMenu(ctx, branch.id, keepDishes([dish]));
  return ok(dish, 201);
};

/** PATCH /admin/branches/:branchId/menu/dishes/:slug */
export const updateDish: Handler = async (ctx, { params, body, headers }) => {
  const { branch, menu } = await staffMenu(ctx, headers, params.branchId);
  const dish = dishIn(menu, params.slug);
  const input = dishInput(body, menu, ctx.now(), branch);
  // The same picture as before keeps its own alt text and thumbnail.
  const samePicture = input.image !== undefined && input.image.src === dish.image?.src;
  // Availability left as it was stays as it was (its sold-out time or off day included).
  const { availability: before } = dish;
  const { availability: after } = input;
  const sameAvailability =
    after.status === before.status &&
    (after.status !== 'sold-out' || before.status !== 'sold-out' || after.backAt === before.backAt);
  const saved: Dish = {
    ...withoutEdited(dish),
    ...input,
    ...(samePicture && dish.image ? { image: dish.image, thumb: dish.thumb ?? dish.image } : {}),
    ...(sameAvailability ? { availability: before } : {}),
    // Moved to another category: last there, until it's reordered.
    rank: input.categoryId === dish.categoryId ? dish.rank : nextRank(menu, input.categoryId),
  };
  changeMenu(ctx, branch.id, keepDishes([saved]));
  return ok(saved);
};

/** DELETE /admin/branches/:branchId/menu/dishes/:slug */
export const removeDish: Handler = async (ctx, { params, headers }) => {
  const { branch, menu } = await staffMenu(ctx, headers, params.branchId);
  const { slug } = dishIn(menu, params.slug);
  changeMenu(ctx, branch.id, (changes) => {
    const { [slug]: _removed, ...dishes } = changes.dishes;
    return { ...changes, dishes, removed: [...changes.removed, slug] };
  });
  return ok(undefined, 204);
};

/** PATCH /admin/branches/:branchId/menu/categories/:categoryId/order */
export const reorderDishes: Handler = async (ctx, { params, body, headers }) => {
  const { branch, menu } = await staffMenu(ctx, headers, params.branchId);
  const inCategory = menu.dishes.filter((d) => d.categoryId === params.categoryId);
  if (inCategory.length === 0) fail(404, 'not_found');
  const slugs = isObject(body) ? list(body.slugs, 200) : bad();
  // Exactly the category's dishes, each once.
  if (slugs.length !== inCategory.length || new Set(slugs).size !== slugs.length) bad();
  const ranked = slugs.map((slug, rank) => ({
    ...(inCategory.find((d) => d.slug === slug) ?? bad()),
    rank,
  }));
  changeMenu(ctx, branch.id, keepDishes(ranked));
  return ok(await ctx.seed.menuData(branch.id));
};

/** PATCH /admin/branches/:branchId/menu/categories */
export const updateCategories: Handler = async (ctx, { params, body, headers }) => {
  const { branch, menu } = await staffMenu(ctx, headers, params.branchId);
  const raw = isObject(body) ? list(body.categories, 50) : bad();
  // The same categories, each once: adding or removing one needs the guest pages built again.
  if (raw.length !== menu.categories.length) bad();
  const seen = new Set<string>();
  const categories = raw.map((c): Category => {
    if (!isObject(c)) return bad();
    const known = menu.categories.find((k) => k.id === c.id && !seen.has(k.id)) ?? bad();
    seen.add(known.id);
    const shortName = optionalText(c.shortName, LIMITS.label);
    const { shortName: _was, ...rest } = known;
    return {
      ...rest,
      name: text(c.name, LIMITS.label),
      description: text(c.description ?? '', LIMITS.description, false),
      ...(shortName ? { shortName } : {}),
    };
  });
  distinct(categories.map((c) => c.name));
  changeMenu(ctx, branch.id, (changes) => ({ ...changes, categories }));
  return ok(await ctx.seed.menuData(branch.id));
};

/** POST /admin/branches/:branchId/menu/images */
export const uploadDishImage: Handler = async (ctx, { params, body, headers }) => {
  await adminBranch(ctx, headers, params.branchId);
  if (!isObject(body)) return bad();
  const { dataUrl, width, height } = body;
  if (
    typeof dataUrl !== 'string' ||
    !/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl) ||
    dataUrl.length > LIMITS.image ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    width < 1 ||
    height < 1
  ) {
    return bad();
  }
  // A backend stores the file and answers with its URL; the mock keeps the data URL.
  const response: ImageUploadResponse = { image: { src: dataUrl, alt: '', width, height } };
  return ok(response, 201);
};
