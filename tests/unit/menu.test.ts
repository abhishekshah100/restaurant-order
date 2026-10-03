import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  applyFilters,
  createMenuCatalog,
  filterSummaryKind,
  highlight,
  sortDishes,
} from '@/lib/menu';
import type { MenuData } from '@/types/menu';
import { readApiJson, testMenu } from '../apiState';

const menu = testMenu();
const { categories, dishesIn, featuredDishes, searchDishes } = menu;

describe('menu data', () => {
  it('matches the category counts in the designs (plus the Meals demo category)', () => {
    const counts = Object.fromEntries(categories.map((c) => [c.id, dishesIn(c.id).length]));
    expect(counts).toEqual({
      starters: 8,
      mains: 12,
      meals: 2,
      pizza: 6,
      'breads-rice': 9,
      desserts: 5,
      beverages: 14,
    });
  });
  it('has the three chef’s picks in the drawn order', () => {
    expect(featuredDishes().map((d) => d.name)).toEqual([
      'Truffle Mushroom Pasta',
      'Chilli Garlic Prawns',
      'Wood-fired Margherita',
    ]);
  });
});

describe('filters', () => {
  it('Mains · veg shows 7 dishes (03)', () => {
    const veg = applyFilters(dishesIn('mains'), { ...DEFAULT_FILTERS, diet: 'veg' });
    expect(veg).toHaveLength(7);
    expect(filterSummaryKind({ ...DEFAULT_FILTERS, diet: 'veg' })).toBe('veg');
    expect(filterSummaryKind({ ...DEFAULT_FILTERS, diet: 'veg', spicy: true })).toBe('mixed');
  });
  it('under ₹400 and sorting keep sold-out dishes last', () => {
    const list = sortDishes(
      applyFilters(dishesIn('starters'), { ...DEFAULT_FILTERS, under400: true }),
      'price-asc',
    );
    expect(list.every((d) => d.price < 400)).toBe(true);
    expect(list[list.length - 1].availability.status).not.toBe('available');
  });
});

describe('search', () => {
  it('"paneer" finds the 4 dishes from the design, in order', () => {
    expect(searchDishes('paneer').map((d) => d.name)).toEqual([
      'Paneer Tikka',
      'Paneer Lababdar',
      'Palak Paneer',
      'Paneer Kulcha',
    ]);
  });
  it('matches multi-word and plural queries', () => {
    expect(searchDishes('butter chicken').map((d) => d.name)).toContain('Old Delhi Butter Chicken');
    expect(searchDishes('Mocktails').length).toBeGreaterThan(0);
    expect(searchDishes('sushi')).toEqual([]);
  });
  it('highlights the query', () => {
    expect(highlight('Palak Paneer', 'paneer')).toEqual([
      { text: 'Palak ', match: false },
      { text: 'Paneer', match: true },
    ]);
  });
});

describe('createMenuCatalog', () => {
  const data = readApiJson<MenuData>('menu');

  it('returns the same catalog for the same response, and a new one for a new response', () => {
    expect(createMenuCatalog(data)).toBe(createMenuCatalog(data));
    expect(createMenuCatalog({ ...data })).not.toBe(createMenuCatalog(data));
  });

  it('keeps the response fields and looks dishes and categories up', () => {
    const catalog = createMenuCatalog(data);
    expect(catalog.dishes).toBe(data.dishes);
    expect(catalog.getDish('paneer-tikka')?.name).toBe('Paneer Tikka');
    expect(catalog.getDish('nope')).toBeUndefined();
    expect(catalog.getCategory('beverages')?.name).toBe('Beverages');
    expect(catalog.categoryCountLabel(catalog.getCategory('beverages')!)).toBe('14 drinks');
    expect(catalog.categoryCount('starters')).toBe(8);
  });

  it('works over any menu, not just the dummy data', () => {
    const [dish] = data.dishes;
    const tiny = createMenuCatalog({
      ...data,
      dishes: [{ ...dish, slug: 'only', name: 'Only Dish', categoryId: 'desserts' }],
      chefsPicks: ['only', 'missing'],
    });
    expect(tiny.dishesIn('desserts').map((d) => d.slug)).toEqual(['only']);
    expect(tiny.dishesIn('starters')).toEqual([]);
    expect(tiny.featuredDishes().map((d) => d.slug)).toEqual(['only']);
    expect(tiny.searchDishes('dessert').map((d) => d.slug)).toEqual(['only']);
    expect(tiny.getDish(dish.slug)).toBeUndefined();
  });
});
