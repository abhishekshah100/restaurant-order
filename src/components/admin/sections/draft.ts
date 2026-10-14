import type { ChoiceSpec, Dish } from '@/types/menu';

/*
 * The menu section's unsent draft: what a staff member picked for a dish (size, add-ons,
 * choices) and its price. Local only: nothing is sent to the kitchen.
 */

export interface DraftLine {
  dish: Dish;
  variant?: string;
  addOns: string[];
  choices: string[];
  total: number;
}

export interface DraftSelection {
  variantId: string;
  addOnIds: string[];
  /** Chosen choice name by option group id. */
  choices: Record<string, string>;
}

export const choiceName = (choice: string | ChoiceSpec) =>
  typeof choice === 'string' ? choice : choice.name;

export const choicePrice = (choice: string | ChoiceSpec | undefined) =>
  typeof choice === 'string' || !choice ? 0 : (choice.price ?? 0);

const offeredFor = (variantId: string) => (item: string | { availableFor?: string[] }) =>
  typeof item === 'string' || !item.availableFor || item.availableFor.includes(variantId);

/** The option groups offered with this size, each with the choices offered with it. */
export function groupsFor(dish: Dish, variantId: string) {
  return (dish.optionGroups ?? [])
    .filter(offeredFor(variantId))
    .map((group) => ({ group, choices: group.choices.filter(offeredFor(variantId)) }))
    .filter(({ choices }) => choices.length > 0);
}

/** The add-ons offered with this size. */
export const addOnsFor = (dish: Dish, variantId: string) =>
  (dish.addOns ?? []).filter(offeredFor(variantId));

/** What the dialog starts with: the first size on offer and each group's first choice. */
export function initialSelection(dish: Dish): DraftSelection {
  const variantId = dish.variants?.find((variant) => variant.available !== false)?.id ?? '';
  return { variantId, addOnIds: [], choices: choicesFor(dish, variantId, {}) };
}

/** Each group's choice after a size change: kept when still offered, else its first one. */
export function choicesFor(dish: Dish, variantId: string, current: Record<string, string>) {
  return Object.fromEntries(
    groupsFor(dish, variantId).map(({ group, choices }) => [
      group.id,
      choices.some((choice) => choiceName(choice) === current[group.id])
        ? current[group.id]
        : choiceName(choices[0]),
    ]),
  );
}

/** The selection after picking another size (add-ons it doesn't offer are dropped). */
export function withVariant(dish: Dish, selection: DraftSelection, variantId: string) {
  const offered = new Set(addOnsFor(dish, variantId).map((addOn) => addOn.id));
  return {
    variantId,
    addOnIds: selection.addOnIds.filter((id) => offered.has(id)),
    choices: choicesFor(dish, variantId, selection.choices),
  };
}

/** The draft line for this selection, priced. */
export function draftLine(dish: Dish, { variantId, addOnIds, choices }: DraftSelection): DraftLine {
  const variant = dish.variants?.find((item) => item.id === variantId);
  const addOns = addOnsFor(dish, variantId).filter((addOn) => addOnIds.includes(addOn.id));
  const chosen = groupsFor(dish, variantId).flatMap(({ group, choices: offered }) =>
    offered.filter((choice) => choiceName(choice) === choices[group.id]),
  );
  return {
    dish,
    variant: variant?.name,
    addOns: addOns.map((addOn) => addOn.name),
    choices: chosen.map(choiceName),
    total:
      (variant?.price ?? dish.price) +
      addOns.reduce((sum, addOn) => sum + (addOn.priceByVariant?.[variantId] ?? addOn.price), 0) +
      chosen.reduce((sum, choice) => sum + choicePrice(choice), 0),
  };
}
