import { UNITS } from '@/lib/inventory';
import type { InventoryUnit } from '@/types/inventory';

/*
 * Recipe templates: typical amounts for one full plate of common dishes, matched to a dish by its
 * name and to the restaurant's own ingredients by theirs, as a starting point staff adjust. Also
 * how a size scales from another ("Half" is ½ of "Full"). Pure, so it's unit-tested.
 */

export interface TemplateLine {
  /** The ingredient's usual name, then other names it goes by ("Sunflower oil" for oil). */
  names: readonly string[];
  quantity: number;
  unit: InventoryUnit;
}

export interface RecipeTemplate {
  /** What the dish is called (matched inside its name: "Old Delhi Butter Chicken"). */
  dishes: readonly string[];
  /** One full plate. */
  lines: readonly TemplateLine[];
}

const normal = (s: string) =>
  s
    .toLocaleLowerCase()
    .replace(/[()·.,'’-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The template for a dish: the one whose name appears in it, the longest match first. */
export function findTemplate(
  dishName: string,
  templates: readonly RecipeTemplate[],
): RecipeTemplate | undefined {
  const name = ` ${normal(dishName)} `;
  let best: { template: RecipeTemplate; length: number } | undefined;
  for (const template of templates) {
    for (const dish of template.dishes) {
      const key = normal(dish);
      if (name.includes(` ${key} `) && (!best || key.length > best.length)) {
        best = { template, length: key.length };
      }
    }
  }
  return best?.template;
}

export interface TemplateResult {
  lines: { ingredientId: string; quantity: number; unit: InventoryUnit }[];
  /** Ingredients the template uses that the restaurant doesn't have (by their usual name). */
  missing: string[];
}

/**
 * A template in the restaurant's own ingredients, scaled (½ for a half plate): each line to the
 * ingredient with that name (or another it goes by), in the template's unit when the ingredient
 * is measured the same way; lines without one are left out and named.
 */
export function applyTemplate(
  template: RecipeTemplate,
  ingredients: readonly { id: string; name: string; unit: InventoryUnit }[],
  factor = 1,
): TemplateResult {
  const byName = new Map(ingredients.map((i) => [normal(i.name), i]));
  const lines: TemplateResult['lines'] = [];
  const missing: string[] = [];
  for (const line of template.lines) {
    const match = line.names.map((n) => byName.get(normal(n))).find((i) => i !== undefined);
    if (!match || UNITS[match.unit].measure !== UNITS[line.unit].measure) {
      missing.push(line.names[0] ?? '');
      continue;
    }
    if (lines.some((l) => l.ingredientId === match.id)) continue;
    lines.push({
      ingredientId: match.id,
      quantity: Math.round(line.quantity * factor * 1000) / 1000,
      unit: line.unit,
    });
  }
  return { lines, missing };
}

/** How big a size usually is, by its name. */
const SIZE_WORDS: readonly [RegExp, number][] = [
  [/\bquarter\b/, 0.25],
  [/\bhalf\b/, 0.5],
  [/\bsmall\b|\bmini\b/, 0.75],
  [/\bfull\b|\bregular\b|\bmedium\b/, 1],
  [/\blarge\b/, 1.5],
  [/\bdouble\b|\bfamily\b/, 2],
];
const sizeWord = (name: string) => SIZE_WORDS.find(([word]) => word.test(normal(name)))?.[1];

/**
 * How much of another size's recipe a size takes: by their names (Half from Full: ½), else by
 * their prices; 1 when neither says.
 */
export function sizeFactor(
  size: { name: string; price: number },
  from: { name: string; price: number },
): number {
  const a = sizeWord(size.name);
  const b = sizeWord(from.name);
  if (a !== undefined && b !== undefined) return Math.round((a / b) * 1000) / 1000;
  if (size.price > 0 && from.price > 0) return Math.round((size.price / from.price) * 100) / 100;
  return 1;
}
