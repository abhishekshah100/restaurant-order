import type { CartLine, LineConfig } from '@/types/cart';
import type { Dish, Price, Variant } from '@/types/menu';
import { addOnsFor, choicesFor, groupsFor, normaliseConfig, optionsPrice } from './options';

/**
 * The words used in line descriptions. Components pass them from content (cart › lineLabels,
 * see useCartLineLabels); the defaults below are the same copy, for callers not yet migrated.
 */
export interface CartLineLabels {
  /** The "Medium" spice choice: "Medium spicy". */
  mediumSpicy: string;
  /** A removed ingredient: "No onion". */
  removal: (name: string) => string;
  /** Several lines of one dish: "2 versions". */
  versions: (count: number) => string;
  meal: string;
  customised: string;
  /** "+1 add-on", "+2 add-ons". */
  addOns: (count: number) => string;
  /** A price in the branch's currency: "₹90" (useRegion().money.format). */
  price: (amount: Price) => string;
}

/**
 * A cart line's identity is dish + variant + add-ons + options + removals + instructions.
 * Adding the same configuration again increases that line's quantity.
 */
export function lineKey(config: LineConfig): string {
  const addOns = [...config.addOnIds].sort().join(',');
  const options = Object.keys(config.options)
    .sort()
    .map((k) => `${k}=${config.options[k]}`)
    .join(',');
  const removals = [...config.removals].sort().join(',');
  const instructions = [...config.instructions].sort().join(',');
  const note = config.note.trim().toLowerCase().replace(/\s+/g, ' ');
  return [
    config.dishSlug,
    config.variantId ?? '',
    addOns,
    options,
    removals,
    instructions,
    note,
  ].join('|');
}

/** Default configuration: first variant, first offered choice per group, nothing else. */
export function defaultConfig(dish: Dish): LineConfig {
  return normaliseConfig(dish, {
    dishSlug: dish.slug,
    variantId: dish.variants?.[0]?.id,
    addOnIds: [],
    options: {},
    removals: [],
    instructions: [],
    note: '',
  });
}

function selectedVariant(dish: Dish, config: Pick<LineConfig, 'variantId'>): Variant | undefined {
  return dish.variants?.find((v) => v.id === config.variantId);
}

/** Price of one unit: size + priced choices + size-specific add-on prices. */
export function unitPrice(
  dish: Dish,
  config: Pick<LineConfig, 'variantId' | 'addOnIds'> & Partial<Pick<LineConfig, 'options'>>,
): Price {
  const base = selectedVariant(dish, config)?.price ?? dish.price;
  const addOns = addOnsFor(dish, config.variantId)
    .filter((a) => config.addOnIds.includes(a.id))
    .reduce((sum, a) => sum + a.price, 0);
  const options = optionsPrice(dish, {
    variantId: config.variantId,
    options: config.options ?? {},
  });
  return base + addOns + options;
}

/** Validates a configuration: required size, offered add-ons / choices for that size, limits. */
export function isValidConfig(dish: Dish, config: LineConfig): boolean {
  if (dish.variants?.length && !selectedVariant(dish, config)) return false;
  const offered = new Set(addOnsFor(dish, config.variantId).map((a) => a.id));
  if (!config.addOnIds.every((id) => offered.has(id))) return false;
  if (dish.maxAddOns !== undefined && config.addOnIds.length > dish.maxAddOns) return false;
  for (const group of groupsFor(dish, config.variantId)) {
    const picked = config.options[group.id];
    if (!choicesFor(group, config.variantId).some((c) => c.name === picked)) return false;
  }
  const removable = new Set((dish.removables ?? []).map((r) => r.id));
  return config.removals.every((id) => removable.has(id));
}

/** The selected size without its piece count: "Full · 10 pcs" → "Full". */
export function shortVariant(
  dish: Dish,
  config: Pick<LineConfig, 'variantId'>,
): string | undefined {
  return selectedVariant(dish, config)?.name.split(' · ')[0];
}

/**
 * Option choices as display text. Summary groups (combo slots, protein) always show;
 * others only when not the default, e.g. "Medium spicy", "Oat milk".
 */
function optionLabels(
  dish: Dish,
  config: LineConfig,
  labels: CartLineLabels,
  withPrice = false,
): string[] {
  return groupsFor(dish, config.variantId).flatMap((g) => {
    const choices = choicesFor(g, config.variantId);
    const picked = choices.find((c) => c.name === config.options[g.id]);
    if (!picked) return [];
    if (!g.showInSummary && picked.name === choices[0]?.name) return [];
    const text = g.id === 'spice' && picked.name === 'Medium' ? labels.mediumSpicy : picked.name;
    return [withPrice && picked.price ? `${text} (+${labels.price(picked.price)})` : text];
  });
}

function addOnLabels(
  dish: Dish,
  config: LineConfig,
  labels: CartLineLabels,
  withPrice: boolean,
): string[] {
  return addOnsFor(dish, config.variantId)
    .filter((a) => config.addOnIds.includes(a.id))
    .map((a) => (withPrice && a.price > 0 ? `${a.name} (+${labels.price(a.price)})` : a.name));
}

/** "No onion", "No garlic". */
function removalLabels(dish: Dish, config: LineConfig, labels: CartLineLabels): string[] {
  return (dish.removables ?? [])
    .filter((r) => config.removals.includes(r.id))
    .map((r) => labels.removal(r.name.toLowerCase()));
}

/**
 * Full options line for cart rows:
 * "Full · 10 pcs, Medium spicy, Extra mint chutney" · "Regular · Extra parmesan (+₹40)".
 */
export function describeOptions(dish: Dish, config: LineConfig, labels: CartLineLabels): string {
  const variant = selectedVariant(dish, config)?.name;
  const rest = [
    ...optionLabels(dish, config, labels, true),
    ...addOnLabels(dish, config, labels, true),
    ...removalLabels(dish, config, labels),
  ];
  if (!variant) return rest.join(', ');
  if (rest.length === 0) return variant;
  return variant.includes(' · ')
    ? [variant, ...rest].join(', ')
    : `${variant} · ${rest.join(', ')}`;
}

/** Compact options for the desktop cart panel: "Full · Medium spicy · Extra mint chutney". */
export function describeOptionsShort(
  dish: Dish,
  config: LineConfig,
  labels: CartLineLabels,
): string {
  return [
    shortVariant(dish, config),
    ...optionLabels(dish, config, labels),
    ...addOnLabels(dish, config, labels, false),
    ...removalLabels(dish, config, labels),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Quoted kitchen instructions for a line: “Less cheese, sauce on the side”. */
export function describeInstructions(config: LineConfig): string | undefined {
  const parts = [...config.instructions, config.note.trim()].filter(Boolean);
  return parts.length ? `“${parts.join(', ')}”` : undefined;
}

/** Note under a menu row's stepper: "Full · Customised", "Regular · +1 add-on". */
export function describeInMenu(
  dish: Dish,
  lines: readonly CartLine[],
  labels: CartLineLabels,
): string | undefined {
  if (lines.length === 0) return undefined;
  if (lines.length > 1) return labels.versions(lines.length);
  const [line] = lines;
  const variant = shortVariant(dish, line);
  const options = optionLabels(dish, line, labels).length + line.removals.length;
  const addOns = line.addOnIds.length;
  const instructions = line.instructions.length + (line.note.trim() ? 1 : 0);
  let extra: string | undefined;
  if (dish.combo) extra = labels.meal;
  else if (options || instructions || (addOns && variant === undefined)) extra = labels.customised;
  else if (addOns) extra = labels.addOns(addOns);
  if (!variant) return extra;
  return extra ? `${variant} · ${extra}` : variant;
}

/** A cart line as it's ordered (POST /orders, POST /payments): what was chosen and how many; the server prices it. */
export function orderLine({ key: _key, unitPrice: _price, ...line }: CartLine): LineConfig & {
  quantity: number;
} {
  return line;
}
