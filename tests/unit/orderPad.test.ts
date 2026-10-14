import { describe, expect, it } from 'vitest';
import { defaultConfig, lineKey } from '@/lib/cartLine';
import {
  addLine,
  dishCount,
  hasChoices,
  padRequest,
  padTotals,
  plainKey,
  setQuantity,
} from '@/lib/orderPad';
import type { Dish } from '@/types/menu';
import { testMenu } from '../apiState';

/* The waiter's order pad: which dishes need choices, lines adding up, totals, the request. */

const menu = testMenu('blr-indiranagar');
const kebab = menu.getDish('dahi-kebab') as Dish;
const tikka = menu.getDish('paneer-tikka') as Dish;

describe('order pad', () => {
  it('asks for choices only for dishes with sizes or choice groups', () => {
    expect(hasChoices(kebab)).toBe(false);
    expect(hasChoices(tikka)).toBe(true);
  });

  it('adds the same dish and choices to one line, other choices to another', () => {
    let lines = addLine([], kebab, defaultConfig(kebab));
    lines = addLine(lines, kebab, defaultConfig(kebab));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ key: plainKey(kebab), quantity: 2, unitPrice: kebab.price });

    const half = defaultConfig(tikka);
    const full = { ...half, variantId: tikka.variants?.[1]?.id };
    lines = addLine(addLine(lines, tikka, half, 2), tikka, full);
    expect(lines).toHaveLength(3);
    expect(dishCount(lines, tikka.slug)).toBe(3);
    expect(lines[2].unitPrice).toBe(tikka.variants?.[1]?.price);
  });

  it('changes a quantity and takes a line off at 0', () => {
    const lines = addLine([], kebab, defaultConfig(kebab));
    expect(setQuantity(lines, plainKey(kebab), 3)[0].quantity).toBe(3);
    expect(setQuantity(lines, plainKey(kebab), 0)).toEqual([]);
  });

  it('totals items and menu prices, and sends what was chosen', () => {
    const half = defaultConfig(tikka);
    const lines = addLine(addLine([], kebab, defaultConfig(kebab), 2), tikka, {
      ...half,
      note: 'No onion',
    });
    expect(padTotals(lines)).toEqual({
      items: 3,
      total: kebab.price * 2 + (tikka.variants?.[0]?.price ?? 0),
    });
    const request = padRequest(lines);
    expect(request[1]).toMatchObject({ dishSlug: 'paneer-tikka', quantity: 1, note: 'No onion' });
    expect(request[1]).not.toHaveProperty('key');
    expect(request[1]).not.toHaveProperty('unitPrice');
    expect(lineKey(request[1])).toBe(lines[1].key);
  });
});
