import { describe, expect, it } from 'vitest';
import {
  defaultConfig,
  describeInMenu,
  describeInstructions,
  describeOptions,
  describeOptionsShort,
  isValidConfig,
  lineKey,
  summaryName,
  unitPrice,
} from '@/lib/cartLine';
import { getDish } from '@/lib/menu';
import type { CartLine, LineConfig } from '@/types/cart';
import type { Dish } from '@/types/menu';

const dish = (slug: string) => getDish(slug) as Dish;
const asLine = (config: LineConfig, quantity = 1): CartLine => ({
  ...config,
  key: lineKey(config),
  quantity,
  unitPrice: 0,
});

const paneer: LineConfig = {
  ...defaultConfig(dish('paneer-tikka')),
  variantId: 'full',
  options: { spice: 'Medium' },
  addOnIds: ['mint-chutney'],
};
const pasta: LineConfig = {
  ...defaultConfig(dish('truffle-mushroom-pasta')),
  addOnIds: ['parmesan'],
  instructions: ['Less cheese'],
};
const latte: LineConfig = {
  ...defaultConfig(dish('iced-hazelnut-latte')),
  options: { milk: 'Oat milk' },
};

describe('unitPrice', () => {
  it('uses the variant price plus add-ons', () => {
    expect(unitPrice(dish('paneer-tikka'), paneer)).toBe(549);
    expect(unitPrice(dish('truffle-mushroom-pasta'), pasta)).toBe(409);
    expect(
      unitPrice(dish('truffle-mushroom-pasta'), {
        variantId: 'large',
        addOnIds: ['parmesan', 'garlic-bread'],
      }),
    ).toBe(589);
    expect(unitPrice(dish('iced-hazelnut-latte'), latte)).toBe(199);
  });
});

describe('isValidConfig', () => {
  it('requires a variant and respects the add-on limit', () => {
    const d = dish('truffle-mushroom-pasta');
    expect(isValidConfig(d, pasta)).toBe(true);
    expect(isValidConfig(d, { ...pasta, variantId: undefined })).toBe(false);
    expect(
      isValidConfig(d, {
        ...pasta,
        addOnIds: ['parmesan', 'grilled-mushrooms', 'garlic-bread', 'chilli-flakes'],
      }),
    ).toBe(false);
    expect(isValidConfig(d, { ...pasta, addOnIds: ['unknown'] })).toBe(false);
  });
});

describe('descriptions match the design copy', () => {
  it('cart lines (08)', () => {
    expect(describeOptions(dish('paneer-tikka'), paneer)).toBe(
      'Full · 10 pcs, Medium spicy, Extra mint chutney',
    );
    expect(describeOptions(dish('truffle-mushroom-pasta'), pasta)).toBe(
      'Regular · Extra parmesan (+₹40)',
    );
    expect(describeOptions(dish('iced-hazelnut-latte'), latte)).toBe('Regular · Oat milk');
    expect(describeInstructions(pasta)).toBe('“Less cheese”');
  });
  it('desktop cart panel (w02)', () => {
    expect(describeOptionsShort(dish('paneer-tikka'), paneer)).toBe(
      'Full · Medium spicy · Extra mint chutney',
    );
  });
  it('menu row notes (02 / 03)', () => {
    expect(describeInMenu(dish('paneer-tikka'), [asLine(paneer)])).toBe('Full · Customised');
    expect(
      describeInMenu(dish('truffle-mushroom-pasta'), [asLine({ ...pasta, instructions: [] })]),
    ).toBe('Regular · +1 add-on');
  });
  it('order summary names (w09)', () => {
    expect(summaryName(dish('paneer-tikka'), paneer)).toBe('Paneer Tikka (Full)');
    expect(summaryName(dish('truffle-mushroom-pasta'), pasta)).toBe('Truffle Mushroom Pasta');
  });
});
