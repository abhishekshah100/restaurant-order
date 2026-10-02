import type { CartLine, LineConfig } from '@/types/cart';
import type { Dish, Rupees, Variant } from '@/types/menu';
import { formatINR } from './format';

/**
 * A cart line's identity is dish + variant + add-ons + options + instructions.
 * Adding the same configuration again increases that line's quantity.
 */
export function lineKey(config: LineConfig): string {
  const addOns = [...config.addOnIds].sort().join(',');
  const options = Object.keys(config.options)
    .sort()
    .map((k) => `${k}=${config.options[k]}`)
    .join(',');
  const instructions = [...config.instructions].sort().join(',');
  const note = config.note.trim().toLowerCase().replace(/\s+/g, ' ');
  return [config.dishSlug, config.variantId ?? '', addOns, options, instructions, note].join('|');
}

/** Default configuration: first variant, first choice per option group, nothing else. */
export function defaultConfig(dish: Dish): LineConfig {
  return {
    dishSlug: dish.slug,
    variantId: dish.variants?.[0]?.id,
    addOnIds: [],
    options: Object.fromEntries((dish.optionGroups ?? []).map((g) => [g.id, g.choices[0]])),
    instructions: [],
    note: '',
  };
}

export function selectedVariant(
  dish: Dish,
  config: Pick<LineConfig, 'variantId'>,
): Variant | undefined {
  return dish.variants?.find((v) => v.id === config.variantId);
}

/** Price of one unit with this configuration. */
export function unitPrice(dish: Dish, config: Pick<LineConfig, 'variantId' | 'addOnIds'>): Rupees {
  const base = selectedVariant(dish, config)?.price ?? dish.price;
  const addOns = (dish.addOns ?? [])
    .filter((a) => config.addOnIds.includes(a.id))
    .reduce((sum, a) => sum + a.price, 0);
  return base + addOns;
}

/** Validates a configuration against the dish (required variant, add-on limit, known ids). */
export function isValidConfig(dish: Dish, config: LineConfig): boolean {
  if (dish.variants?.length && !selectedVariant(dish, config)) return false;
  const known = new Set((dish.addOns ?? []).map((a) => a.id));
  if (!config.addOnIds.every((id) => known.has(id))) return false;
  if (dish.maxAddOns !== undefined && config.addOnIds.length > dish.maxAddOns) return false;
  return true;
}

const shortVariant = (variant: Variant | undefined) => variant?.name.split(' · ')[0];

/** Non-default option choices as display text, e.g. "Medium spicy", "Oat milk". */
function optionLabels(dish: Dish, config: LineConfig): string[] {
  return (dish.optionGroups ?? [])
    .filter((g) => config.options[g.id] && config.options[g.id] !== g.choices[0])
    .map((g) => {
      const choice = config.options[g.id];
      return g.id === 'spice' && choice === 'Medium' ? 'Medium spicy' : choice;
    });
}

function addOnLabels(dish: Dish, config: LineConfig, withPrice: boolean): string[] {
  return (dish.addOns ?? [])
    .filter((a) => config.addOnIds.includes(a.id))
    .map((a) => (withPrice && a.price > 0 ? `${a.name} (+${formatINR(a.price)})` : a.name));
}

/**
 * Full options line for cart rows:
 * "Full · 10 pcs, Medium spicy, Extra mint chutney" · "Regular · Extra parmesan (+₹40)".
 */
export function describeOptions(dish: Dish, config: LineConfig): string {
  const variant = selectedVariant(dish, config)?.name;
  const rest = [...optionLabels(dish, config), ...addOnLabels(dish, config, true)];
  if (!variant) return rest.join(', ');
  if (rest.length === 0) return variant;
  return variant.includes(' · ')
    ? [variant, ...rest].join(', ')
    : `${variant} · ${rest.join(', ')}`;
}

/** Compact options for the desktop cart panel: "Full · Medium spicy · Extra mint chutney". */
export function describeOptionsShort(dish: Dish, config: LineConfig): string {
  return [
    shortVariant(selectedVariant(dish, config)),
    ...optionLabels(dish, config),
    ...addOnLabels(dish, config, false),
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
export function describeInMenu(dish: Dish, lines: readonly CartLine[]): string | undefined {
  if (lines.length === 0) return undefined;
  if (lines.length > 1) return `${lines.length} versions`;
  const [line] = lines;
  const variant = shortVariant(selectedVariant(dish, line));
  const options = optionLabels(dish, line).length;
  const addOns = line.addOnIds.length;
  const instructions = line.instructions.length + (line.note.trim() ? 1 : 0);
  let extra: string | undefined;
  if (options || instructions || (addOns && variant === undefined)) extra = 'Customised';
  else if (addOns) extra = `+${addOns} add-on${addOns === 1 ? '' : 's'}`;
  if (!variant) return extra;
  return extra ? `${variant} · ${extra}` : variant;
}

/** Order-summary label: "Paneer Tikka (Full)" — the variant shows only when it isn't the first. */
export function summaryName(dish: Dish, config: LineConfig): string {
  const variant = selectedVariant(dish, config);
  if (!variant || variant.id === dish.variants?.[0]?.id) return dish.name;
  return `${dish.name} (${shortVariant(variant)})`;
}
