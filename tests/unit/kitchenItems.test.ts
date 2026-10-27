import { describe, expect, it } from 'vitest';
import { defaultConfig } from '@/lib/cartLine';
import { allergensIn, kitchenItem, stockIssue } from '@/lib/kitchenItems';
import type { LineConfig } from '@/types/cart';
import type { Dish } from '@/types/menu';
import type { OrderItem } from '@/types/order';
import { testMenu } from '../apiState';

/*
 * An order item as the kitchen reads it (lib/kitchenItems): a thali's picks one per line, other
 * choices with their group when they aren't the default, add-ons and leave-outs by name, no
 * prices; the order's own lines when the choices aren't known; and whether it's in stock.
 */

const menu = testMenu('blr-indiranagar');
const dish = (slug: string) => menu.getDish(slug) as Dish;

const itemOf = (slug: string, config?: Partial<LineConfig>, over: Partial<OrderItem> = {}) => {
  const d = dish(slug);
  return {
    dishSlug: slug,
    name: d.name,
    veg: d.veg,
    quantity: 1,
    details: ['Paneer Lababdar (+₹40), Garlic Naan'],
    unitPrice: d.price,
    config: config ? { ...defaultConfig(d), ...config } : undefined,
    ...over,
  } satisfies OrderItem;
};

describe('kitchenItem', () => {
  it('lists every pick of a thali on its own, without prices', () => {
    const item = itemOf('veg-thali', {
      options: {
        curry: 'Paneer Lababdar',
        bread: 'Garlic Naan',
        rice: 'Jeera Rice',
        dessert: 'Gulab Jamun',
        drink: 'Mango Lassi',
      },
    });
    expect(kitchenItem(item, dish('veg-thali')).choices).toEqual([
      { choice: 'Paneer Lababdar' },
      { choice: 'Garlic Naan' },
      { choice: 'Jeera Rice' },
      { choice: 'Gulab Jamun' },
      { choice: 'Mango Lassi' },
    ]);
  });

  it('names other choices by their group, and only when they are not the default', () => {
    const lababdar = dish('paneer-lababdar');
    expect(kitchenItem(itemOf('paneer-lababdar', {}), lababdar).choices).toEqual([]);
    const hot = itemOf('paneer-lababdar', { options: { spice: 'Hot' }, removals: ['onion'] });
    const view = kitchenItem(hot, lababdar);
    expect(view.choices).toEqual([{ group: 'Spice level', choice: 'Hot' }]);
    expect(view.removals).toEqual(['Onion']);
    expect(view.size).toBe(lababdar.variants?.[0].name);
  });

  it('names add-ons, and keeps the order’s own lines when the choices are not known', () => {
    const pasta = itemOf('truffle-mushroom-pasta', { addOnIds: ['parmesan'] });
    expect(kitchenItem(pasta, dish('truffle-mushroom-pasta')).addOns).toEqual([
      dish('truffle-mushroom-pasta').addOns?.find((a) => a.id === 'parmesan')?.name,
    ]);
    const old = itemOf('veg-thali');
    expect(kitchenItem(old, dish('veg-thali')).fallback).toEqual(old.details);
    expect(kitchenItem(old, undefined).fallback).toEqual(old.details);
  });
});

describe('stockIssue', () => {
  it('says when the dish or its size went off the menu', () => {
    const lababdar = dish('paneer-lababdar');
    const item = itemOf('paneer-lababdar', { variantId: lababdar.variants?.[1].id });
    expect(stockIssue(item, lababdar)).toBeNull();
    expect(stockIssue(item, { ...lababdar, availability: { status: 'sold-out' } })).toBe('soldOut');
    expect(stockIssue(item, { ...lababdar, availability: { status: 'unavailable-today' } })).toBe(
      'offToday',
    );
    const sizeOff = {
      ...lababdar,
      variants: lababdar.variants?.map((v, i) => (i === 1 ? { ...v, available: false } : v)),
    };
    expect(stockIssue(item, sizeOff)).toBe('sizeOff');
    expect(stockIssue(item, undefined)).toBeNull();
  });
});

describe('allergies in notes', () => {
  it('flags a note naming an allergen or an allergy, word by word', () => {
    expect(allergensIn(['Less spicy, allergy to peanuts'])).toEqual({
      flagged: true,
      allergens: ['peanut'],
    });
    expect(allergensIn(['No nuts or Gluten please', 'no eggs'])).toEqual({
      flagged: true,
      allergens: ['nut', 'gluten', 'egg'],
    });
    expect(allergensIn(['Guest is allergic', undefined])).toEqual({
      flagged: true,
      allergens: [],
    });
    // Part of a word, or nothing to flag.
    expect(allergensIn(['Extra nutmeg', 'Less spicy'])).toEqual({ flagged: false, allergens: [] });
  });
});
