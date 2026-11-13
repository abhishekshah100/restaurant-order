import { describe, expect, it } from 'vitest';
import { RECIPE_TEMPLATES } from '@/components/admin/inventory/recipeTemplateList';
import { applyTemplate, findTemplate, sizeFactor } from '@/lib/recipeTemplates';

/* Recipe templates: matched by the dish's name, in the restaurant's own ingredients. */

describe('recipe templates', () => {
  it('finds a dish by the longest name inside it', () => {
    expect(findTemplate('Old Delhi Butter Chicken', RECIPE_TEMPLATES)?.dishes[0]).toBe(
      'Butter Chicken',
    );
    // "Butter Naan", not "Naan"; "Chicken Dum Biryani", not "Chicken Curry".
    expect(findTemplate('Butter Naan', RECIPE_TEMPLATES)?.dishes[0]).toBe('Butter Naan');
    expect(findTemplate('Chicken Dum Biryani', RECIPE_TEMPLATES)?.dishes[0]).toBe(
      'Chicken Biryani',
    );
    expect(findTemplate('Wild Mushroom Risotto', RECIPE_TEMPLATES)).toBeUndefined();
  });

  it("fills in the restaurant's ingredients by their names (or others they go by), scaled", () => {
    const template = findTemplate('Paneer Tikka', RECIPE_TEMPLATES);
    if (!template) throw new Error('no template');
    const ingredients = [
      { id: 'p', name: 'Paneer', unit: 'kg' as const },
      { id: 'c', name: 'curd', unit: 'kg' as const },
      { id: 'o', name: 'Sunflower oil', unit: 'l' as const },
      { id: 'x', name: 'Capsicum', unit: 'pc' as const },
    ];
    const half = applyTemplate(template, ingredients, 0.5);
    expect(half.lines).toEqual([
      { ingredientId: 'p', quantity: 100, unit: 'g' },
      { ingredientId: 'c', quantity: 20, unit: 'g' },
      { ingredientId: 'o', quantity: 7.5, unit: 'ml' },
    ]);
    // Capsicum is counted in pieces here: not weighed, so left for staff to add.
    expect(half.missing).toEqual([
      'Capsicum',
      'Onion',
      'Ginger-garlic paste',
      'Red chilli powder',
      'Garam masala',
    ]);
  });

  it('scales a size from another by their names, else by price', () => {
    expect(
      sizeFactor({ name: 'Half · 6 pcs', price: 329 }, { name: 'Full · 10 pcs', price: 549 }),
    ).toBe(0.5);
    expect(sizeFactor({ name: 'Quarter', price: 0 }, { name: 'Half', price: 0 })).toBe(0.5);
    expect(sizeFactor({ name: 'Regular', price: 200 }, { name: 'Large', price: 300 })).toBe(0.667);
    expect(sizeFactor({ name: '6 pcs', price: 300 }, { name: '10 pcs', price: 500 })).toBe(0.6);
    expect(sizeFactor({ name: 'A', price: 0 }, { name: 'B', price: 0 })).toBe(1);
  });
});
