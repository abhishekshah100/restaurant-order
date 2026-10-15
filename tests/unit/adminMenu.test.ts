import { describe, expect, it } from 'vitest';
import {
  backAtTimes,
  dishForm,
  dishFormErrors,
  dishInputOf,
  menuCounts,
  menuSections,
  menuStatus,
  sizesOff,
  withAvailability,
} from '@/lib/adminMenu';
import type { Dish, MenuData } from '@/types/menu';
import { readApiJson, testMenu } from '../apiState';

/* The staff Menu page's logic: states and counts, filters, times, the editor's form. */

const menu = testMenu('blr-indiranagar');
const tikka = menu.getDish('paneer-tikka') as Dish;
const kebab = menu.getDish('dahi-kebab') as Dish;

describe('menu page', () => {
  it('groups each dish by state and counts them', () => {
    expect(menuStatus(tikka)).toBe('available');
    expect(menuStatus({ availability: { status: 'sold-out', backAt: '8 PM' } })).toBe('soldOut');
    expect(menuStatus({ availability: { status: 'unavailable-today' } })).toBe('offToday');
    const counts = menuCounts(menu.dishes);
    expect(counts.all).toBe(menu.dishes.length);
    expect(counts.available + counts.soldOut + counts.offToday).toBe(counts.all);
    expect(counts.soldOut).toBeGreaterThan(0);
  });

  it('lists by category, filtered by state, or every search match in one group', () => {
    const soldOut = menuSections(menu, { status: 'soldOut', category: 'all', query: '' });
    expect(soldOut.flatMap((s) => s.dishes).every((d) => menuStatus(d) === 'soldOut')).toBe(true);
    const starters = menuSections(menu, { status: 'all', category: 'starters', query: '' });
    expect(starters.map((s) => s.id)).toEqual(['starters']);
    const found = menuSections(menu, { status: 'all', category: 'mains', query: 'kebab' });
    expect(found).toHaveLength(1);
    expect(found[0].dishes.map((d) => d.slug)).toContain('dahi-kebab');
  });

  it('offers sold-out-until times on the half hour, at least 15 minutes away', () => {
    const times = backAtTimes(new Date('2026-10-15T14:10:00Z'), 3);
    expect(times.map((t) => t.toISOString())).toEqual([
      '2026-10-15T14:30:00.000Z',
      '2026-10-15T15:00:00.000Z',
      '2026-10-15T15:30:00.000Z',
    ]);
    expect(backAtTimes(new Date('2026-10-15T14:20:00Z'), 1)[0].toISOString()).toBe(
      '2026-10-15T15:00:00.000Z',
    );
  });

  it('shows a change at once: the dish sold out, a size off', () => {
    const data = readApiJson<MenuData>('branches/blr-indiranagar/menu');
    const next = withAvailability(data, 'paneer-tikka', {
      availability: { status: 'sold-out', backAt: '8:30 PM' },
      variants: { full: false },
    });
    const dish = next.dishes.find((d) => d.slug === 'paneer-tikka') as Dish;
    expect(dish.availability).toEqual({ status: 'sold-out', backAt: '8:30 PM' });
    expect(sizesOff(dish).map((v) => v.id)).toEqual(['full']);
    expect(next.dishes.find((d) => d.slug === 'dahi-kebab')).toBe(
      data.dishes.find((d) => d.slug === 'dahi-kebab'),
    );
  });
});

describe('dish editor', () => {
  it('starts from the dish (or a blank one) and checks what is missing', () => {
    const form = dishForm(tikka, 'starters');
    expect(form).toMatchObject({ name: 'Paneer Tikka', pricing: 'sizes', sizeLabel: 'Portion' });
    expect(form.sizes.map((s) => [s.id, s.price])).toEqual([
      ['half', '329'],
      ['full', '549'],
    ]);
    expect(dishFormErrors(form)).toEqual([]);

    const blank = dishForm(undefined, 'mains');
    expect(blank).toMatchObject({ categoryId: 'mains', pricing: 'single', status: 'available' });
    expect(dishFormErrors(blank)).toEqual(['name', 'price']);
    expect(dishFormErrors({ ...blank, name: 'Dal', pricing: 'sizes' })).toEqual(['sizes']);
    const twice = {
      ...blank,
      name: 'Dal',
      pricing: 'sizes' as const,
      sizes: blank.sizes.map((s) => ({ ...s, name: 'Bowl', price: '100' })),
    };
    expect(dishFormErrors(twice)).toEqual(['sizeNames']);
  });

  it('becomes the request, keeping a sold-out time already set', () => {
    const single = dishInputOf({ ...dishForm(kebab, 'starters'), price: ' 299 ' });
    expect(single).toMatchObject({ name: 'Dahi Kebab', price: 299, veg: true });
    expect(single).not.toHaveProperty('variants');

    const sized = dishInputOf(
      { ...dishForm(tikka, 'starters'), status: 'sold-out' },
      { status: 'sold-out', backAt: '8 PM' },
    );
    expect(sized.availability).toEqual({ status: 'sold-out', backAt: '8 PM' });
    expect(sized.variants?.map((v) => [v.id, v.price, v.available])).toEqual([
      ['half', 329, true],
      ['full', 549, true],
    ]);
  });
});
