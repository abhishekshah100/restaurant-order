import type { AddOn, ChoiceSpec, Dish, OptionGroup, Rupees } from '@/types/menu';
import type { LineConfig } from '@/types/cart';

/**
 * Option rules shared by pricing, validation, the options form and cart descriptions:
 * which add-ons, groups and choices apply to the chosen size, and what they cost.
 */

const forVariant = (availableFor: string[] | undefined, variantId: string | undefined) =>
  !availableFor || (variantId !== undefined && availableFor.includes(variantId));

const toChoice = (c: string | ChoiceSpec): ChoiceSpec => (typeof c === 'string' ? { name: c } : c);

/** Option groups offered with this size. */
export function groupsFor(dish: Dish, variantId: string | undefined): OptionGroup[] {
  return (dish.optionGroups ?? []).filter((g) => forVariant(g.availableFor, variantId));
}

/** Choices of a group offered with this size. */
export function choicesFor(group: OptionGroup, variantId: string | undefined): ChoiceSpec[] {
  return group.choices.map(toChoice).filter((c) => forVariant(c.availableFor, variantId));
}

/** Add-ons offered with this size, with their size-specific price. */
export function addOnsFor(dish: Dish, variantId: string | undefined): AddOn[] {
  return (dish.addOns ?? [])
    .filter((a) => forVariant(a.availableFor, variantId))
    .map((a) => ({ ...a, price: addOnPrice(a, variantId) }));
}

function addOnPrice(addOn: AddOn, variantId: string | undefined): Rupees {
  const sized = variantId !== undefined ? addOn.priceByVariant?.[variantId] : undefined;
  return sized ?? addOn.price;
}

/** Any price on any choice of the group? Priced groups render as rows with prices. */
export const isPricedGroup = (group: OptionGroup) =>
  group.choices.some((c) => typeof c !== 'string' && (c.price ?? 0) > 0);

/** Extra cost of the selected choices across groups. */
export function optionsPrice(
  dish: Dish,
  config: Pick<LineConfig, 'variantId' | 'options'>,
): Rupees {
  return groupsFor(dish, config.variantId).reduce((sum, g) => {
    const picked = choicesFor(g, config.variantId).find((c) => c.name === config.options[g.id]);
    return sum + (picked?.price ?? 0);
  }, 0);
}

/**
 * Makes a configuration consistent with its size: drops add-ons and choices the
 * size doesn't offer, defaults any group whose choice is missing, keeps removals valid.
 */
export function normaliseConfig(dish: Dish, config: LineConfig): LineConfig {
  const addOnIds = new Set(addOnsFor(dish, config.variantId).map((a) => a.id));
  const removable = new Set((dish.removables ?? []).map((r) => r.id));
  const options: Record<string, string> = {};
  for (const group of groupsFor(dish, config.variantId)) {
    const choices = choicesFor(group, config.variantId);
    const current = config.options[group.id];
    options[group.id] = choices.some((c) => c.name === current)
      ? current
      : (choices[0]?.name ?? '');
  }
  return {
    ...config,
    addOnIds: config.addOnIds.filter((id) => addOnIds.has(id)),
    options,
    removals: config.removals.filter((id) => removable.has(id)),
  };
}
