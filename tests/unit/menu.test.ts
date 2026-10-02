import { describe, expect, it } from 'vitest';
import { categories } from '@/data/menu';
import {
  DEFAULT_FILTERS,
  applyFilters,
  dishesIn,
  featuredDishes,
  filterSummary,
  highlight,
  searchDishes,
  sortDishes,
} from '@/lib/menu';

describe('menu data', () => {
  it('matches the category counts in the designs', () => {
    const counts = Object.fromEntries(categories.map((c) => [c.id, dishesIn(c.id).length]));
    expect(counts).toEqual({
      starters: 8,
      mains: 12,
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
    expect(filterSummary({ ...DEFAULT_FILTERS, diet: 'veg' }, veg.length, 12)).toBe(
      'Showing 7 vegetarian dishes',
    );
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
