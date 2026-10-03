import { describe, expect, it } from 'vitest';
import {
  defaultConfig,
  describeInMenu,
  describeOptions,
  isValidConfig,
  lineKey,
  unitPrice,
} from '@/lib/cartLine';
import { isCustomisable } from '@/lib/menu';
import { addOnsFor, choicesFor, groupsFor, normaliseConfig } from '@/lib/options';
import type { LineConfig } from '@/types/cart';
import type { Dish } from '@/types/menu';
import { testMenu, testLineLabels } from '../apiState';

const lineLabels = testLineLabels();

const menu = testMenu();
const dish = (slug: string) => menu.getDish(slug) as Dish;
const asLine = (c: LineConfig) => ({ ...c, key: lineKey(c), quantity: 1, unitPrice: 0 });

describe('priced single choices', () => {
  it('adds the choice price and lists the protein in the summary', () => {
    const curry = dish('chettinad-curry');
    const base = defaultConfig(curry);
    expect(base.options.protein).toBe('Chicken');
    expect(unitPrice(curry, base)).toBe(429);
    const lamb = { ...base, options: { protein: 'Lamb' } };
    expect(unitPrice(curry, lamb)).toBe(519);
    expect(describeOptions(curry, base, lineLabels)).toBe('Chicken');
    expect(describeOptions(curry, lamb, lineLabels)).toBe('Lamb (+₹90)');
  });

  it('a priced milk choice changes the latte price', () => {
    const latte = dish('iced-hazelnut-latte');
    expect(unitPrice(latte, { ...defaultConfig(latte), options: { milk: 'Almond milk' } })).toBe(
      229,
    );
  });
});

describe('options that depend on the size', () => {
  it('offers the extra shot only on Medium and Large', () => {
    const latte = dish('iced-hazelnut-latte');
    expect(addOnsFor(latte, 'regular').map((a) => a.id)).toEqual(['whipped-cream']);
    expect(addOnsFor(latte, 'large').map((a) => a.id)).toEqual(['extra-shot', 'whipped-cream']);
  });

  it('prices add-ons by size', () => {
    const pizza = dish('wood-fired-margherita');
    expect(addOnsFor(pizza, 'regular').find((a) => a.id === 'burrata')?.price).toBe(120);
    expect(addOnsFor(pizza, 'large').find((a) => a.id === 'burrata')?.price).toBe(160);
    const large = { ...defaultConfig(pizza), variantId: 'large', addOnIds: ['burrata'] };
    expect(unitPrice(pizza, large)).toBe(399 + 160);
  });

  it('offers the gluten-free base only on the 10"', () => {
    const pizza = dish('wood-fired-margherita');
    const crust = groupsFor(pizza, 'regular')[0];
    expect(choicesFor(crust, 'regular').map((c) => c.name)).toContain('Gluten-free');
    expect(choicesFor(crust, 'large').map((c) => c.name)).not.toContain('Gluten-free');
  });

  it('drops choices and add-ons the new size does not offer', () => {
    const pizza = dish('wood-fired-margherita');
    const latte = dish('iced-hazelnut-latte');
    const gf = { ...defaultConfig(pizza), options: { crust: 'Gluten-free' } };
    expect(normaliseConfig(pizza, { ...gf, variantId: 'large' }).options.crust).toBe(
      'Classic sourdough',
    );
    const shot = { ...defaultConfig(latte), variantId: 'large', addOnIds: ['extra-shot'] };
    expect(normaliseConfig(latte, { ...shot, variantId: 'regular' }).addOnIds).toEqual([]);
    expect(isValidConfig(latte, { ...shot, variantId: 'regular' })).toBe(false);
  });
});

describe('leave-out options', () => {
  it('are part of the line identity and description', () => {
    const chicken = dish('old-delhi-butter-chicken');
    const plain = defaultConfig(chicken);
    const noOnion = { ...plain, removals: ['onion', 'garlic'] };
    expect(lineKey(plain)).not.toBe(lineKey(noOnion));
    expect(lineKey(noOnion)).toBe(lineKey({ ...plain, removals: ['garlic', 'onion'] }));
    expect(describeOptions(chicken, noOnion, lineLabels)).toBe('No onion, No garlic');
    expect(describeInMenu(chicken, [asLine(noOnion)], lineLabels)).toBe('Customised');
    expect(unitPrice(chicken, noOnion)).toBe(449);
  });

  it('make a dish customisable on their own', () => {
    expect(isCustomisable(dish('old-delhi-butter-chicken'))).toBe(true);
  });

  it('reject unknown ingredients', () => {
    const chicken = dish('old-delhi-butter-chicken');
    expect(isValidConfig(chicken, { ...defaultConfig(chicken), removals: ['peanut'] })).toBe(false);
  });
});

describe('meals / combos', () => {
  it('defaults every slot, lists every part and adds upgrades', () => {
    const thali = dish('veg-thali');
    const base = defaultConfig(thali);
    expect(base.options).toEqual({
      curry: 'Dal Makhani',
      bread: 'Butter Naan',
      rice: 'Jeera Rice',
      dessert: 'Gulab Jamun',
      drink: 'Masala Chai',
    });
    expect(describeOptions(thali, base, lineLabels)).toBe(
      'Dal Makhani, Butter Naan, Jeera Rice, Gulab Jamun, Masala Chai',
    );
    const upgraded = {
      ...base,
      options: { ...base.options, curry: 'Paneer Lababdar', drink: 'Mango Lassi' },
    };
    expect(unitPrice(thali, upgraded)).toBe(449 + 40 + 40);
    expect(describeInMenu(thali, [asLine(base)], lineLabels)).toBe('Meal');
  });
});
