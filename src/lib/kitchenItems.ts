import type { Dish } from '@/types/menu';
import type { OrderItem } from '@/types/order';
import { addOnsFor, choicesFor, groupsFor } from './options';

/*
 * An order item as the kitchen reads it, pure: from what the guest or waiter chose
 * (`OrderItem.config`) and the dish on the menu: each choice on its own line (a thali's curry,
 * bread, rice…), the add-ons, what to leave out, without prices; and whether the dish
 * can still be made (sold out, off today, its size off).
 */

/**
 * One choice. A meal's slots and a protein read on their own ("Paneer Lababdar", "Garlic Naan");
 * other choices keep their group, since "Hot" alone could mean anything ("Spice level", "Hot").
 */
export interface KitchenChoice {
  group?: string;
  choice: string;
}

export interface KitchenItemView {
  /** The size in full ("Full · 10 pcs"), for a dish with more than one. */
  size?: string;
  /** Meal slots and other choices that matter (every summary group, others when not the default). */
  choices: KitchenChoice[];
  /** Add-on names. */
  addOns: string[];
  /** Ingredients to leave out, as named on the menu ("Onion"). */
  removals: string[];
  /**
   * The order's own detail lines, when what was chosen isn't known (older orders, a dish no
   * longer on the menu): shown as they are.
   */
  fallback: string[];
}

export function kitchenItem(item: OrderItem, dish: Dish | undefined): KitchenItemView {
  const { config } = item;
  if (!config || !dish) {
    return { choices: [], addOns: [], removals: [], fallback: item.details };
  }
  const { variantId } = config;
  const size =
    (dish.variants?.length ?? 0) > 1
      ? dish.variants?.find((v) => v.id === variantId)?.name
      : undefined;
  const choices = groupsFor(dish, variantId).flatMap((group) => {
    const offered = choicesFor(group, variantId);
    const picked = offered.find((c) => c.name === config.options[group.id]);
    if (!picked) return [];
    // A default spice level or milk isn't worth a line; a meal's slots always are.
    if (!group.showInSummary && picked.name === offered[0]?.name) return [];
    return [
      group.showInSummary ? { choice: picked.name } : { group: group.name, choice: picked.name },
    ];
  });
  const addOns = addOnsFor(dish, variantId)
    .filter((a) => config.addOnIds.includes(a.id))
    .map((a) => a.name);
  const removals = (dish.removables ?? [])
    .filter((r) => config.removals.includes(r.id))
    .map((r) => r.name);
  return { ...(size ? { size } : {}), choices, addOns, removals, fallback: [] };
}

/** Why an item can't be made as ordered: the dish sold out, off today, or its size switched off. */
export type StockIssue = 'soldOut' | 'offToday' | 'sizeOff';

/** The item's stock problem now, by the menu; none for a dish no longer on it. */
export function stockIssue(item: OrderItem, dish: Dish | undefined): StockIssue | null {
  if (!dish) return null;
  if (dish.availability.status === 'sold-out') return 'soldOut';
  if (dish.availability.status === 'unavailable-today') return 'offToday';
  const variantId = item.config?.variantId;
  const size = variantId ? dish.variants?.find((v) => v.id === variantId) : undefined;
  return size?.available === false ? 'sizeOff' : null;
}

/*
 * Allergies in what the guest or waiter wrote. Notes are free text, so a word that names an
 * allergen (or "allergy" itself) flags the ticket: a cook can't miss "peanut" in a long note.
 * A word, not part of one ("nut", not "nutmeg"); English, as the notes are.
 */
const ALLERGEN_WORDS =
  /\b(allerg(?:y|ies|ic)|peanuts?|nuts?|cashews?|almonds?|walnuts?|pistachios?|gluten|coeliac|celiac|lactose|dairy|soya?|sesame|shellfish|mustard|eggs?)\b/gi;

/** "Allergy" or "allergic" says there is one without naming it. */
const GENERIC = /^allerg/i;

/**
 * The allergens named in these texts (lower case, singular, each once, in order), and whether
 * any text mentions an allergy at all (`flagged`, also true for "allergic" alone).
 */
export function allergensIn(texts: readonly (string | undefined)[]): {
  flagged: boolean;
  allergens: string[];
} {
  const found = new Set<string>();
  let flagged = false;
  for (const text of texts) {
    for (const [word] of (text ?? '').matchAll(ALLERGEN_WORDS)) {
      flagged = true;
      if (GENERIC.test(word)) continue;
      const lower = word.toLowerCase();
      found.add(lower === 'soya' ? 'soy' : lower.replace(/s$/, ''));
    }
  }
  return { flagged, allergens: [...found] };
}
