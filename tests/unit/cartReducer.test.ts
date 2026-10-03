import { describe, expect, it } from 'vitest';
import { EMPTY_CART, cartReducer, parseCart } from '@/lib/cartReducer';
import { lineKey } from '@/lib/cartLine';
import type { CartState, LineConfig } from '@/types/cart';

const pasta = (over: Partial<LineConfig> = {}): LineConfig => ({
  dishSlug: 'truffle-mushroom-pasta',
  variantId: 'regular',
  addOnIds: ['parmesan'],
  options: {},
  instructions: ['Less cheese'],
  note: '',
  removals: [],
  ...over,
});

const add = (state: CartState, config: LineConfig, quantity = 1, unitPrice = 409) =>
  cartReducer(state, { type: 'add', config, unitPrice, quantity });

describe('lineKey', () => {
  it('is the same regardless of add-on, option or instruction order', () => {
    const a = lineKey(
      pasta({ addOnIds: ['parmesan', 'garlic-bread'], instructions: ['Jain', 'Less cheese'] }),
    );
    const b = lineKey(
      pasta({ addOnIds: ['garlic-bread', 'parmesan'], instructions: ['Less cheese', 'Jain'] }),
    );
    expect(a).toBe(b);
  });
  it('normalises the free-text note', () => {
    expect(lineKey(pasta({ note: '  Sauce  on the side ' }))).toBe(
      lineKey(pasta({ note: 'sauce on the side' })),
    );
  });
  it('differs when the variant, add-ons or instructions differ', () => {
    const base = lineKey(pasta());
    expect(lineKey(pasta({ variantId: 'large' }))).not.toBe(base);
    expect(lineKey(pasta({ addOnIds: [] }))).not.toBe(base);
    expect(lineKey(pasta({ instructions: [] }))).not.toBe(base);
    expect(lineKey(pasta({ options: { spice: 'Hot' } }))).not.toBe(base);
  });
});

describe('cartReducer', () => {
  it('adds a new line', () => {
    const s = add(EMPTY_CART, pasta());
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toMatchObject({ quantity: 1, unitPrice: 409, key: lineKey(pasta()) });
  });

  it('adding the same configuration again increases the quantity', () => {
    let s = add(EMPTY_CART, pasta());
    s = add(s, pasta({ addOnIds: ['parmesan'] }), 2);
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].quantity).toBe(3);
  });

  it('a different configuration is a separate line', () => {
    let s = add(EMPTY_CART, pasta());
    s = add(s, pasta({ variantId: 'large' }), 1, 509);
    expect(s.lines).toHaveLength(2);
  });

  it('caps quantity at 20 and ignores zero adds', () => {
    let s = add(EMPTY_CART, pasta(), 25);
    expect(s.lines[0].quantity).toBe(20);
    s = add(EMPTY_CART, pasta(), 0);
    expect(s.lines).toHaveLength(0);
  });

  it('updates quantity; 0 removes the line', () => {
    let s = add(EMPTY_CART, pasta());
    const key = s.lines[0].key;
    s = cartReducer(s, { type: 'setQuantity', key, quantity: 4 });
    expect(s.lines[0].quantity).toBe(4);
    s = cartReducer(s, { type: 'setQuantity', key, quantity: 0 });
    expect(s.lines).toHaveLength(0);
  });

  it('removes and restores a line at its old position (Undo)', () => {
    let s = add(EMPTY_CART, pasta());
    s = add(
      s,
      pasta({ dishSlug: 'dahi-kebab', variantId: undefined, addOnIds: [], instructions: [] }),
      1,
      289,
    );
    const [first] = s.lines;
    s = cartReducer(s, { type: 'remove', key: first.key });
    expect(s.lines.map((l) => l.dishSlug)).toEqual(['dahi-kebab']);
    s = cartReducer(s, { type: 'restore', line: first, index: 0 });
    expect(s.lines.map((l) => l.dishSlug)).toEqual(['truffle-mushroom-pasta', 'dahi-kebab']);
  });

  it('edits options in place and re-keys the line', () => {
    let s = add(EMPTY_CART, pasta());
    const key = s.lines[0].key;
    const edited = pasta({ variantId: 'large', addOnIds: [] });
    s = cartReducer(s, { type: 'edit', key, config: edited, unitPrice: 469, quantity: 2 });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toMatchObject({
      key: lineKey(edited),
      unitPrice: 469,
      quantity: 2,
      variantId: 'large',
    });
  });

  it('merges an edited line into an identical existing line', () => {
    let s = add(EMPTY_CART, pasta());
    s = add(s, pasta({ variantId: 'large' }), 1, 509);
    const largeKey = s.lines[1].key;
    s = cartReducer(s, {
      type: 'edit',
      key: largeKey,
      config: pasta(),
      unitPrice: 409,
      quantity: 2,
    });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].quantity).toBe(3);
  });

  it('sets the kitchen note (max 120 chars) and clears the cart', () => {
    let s = add(EMPTY_CART, pasta());
    s = cartReducer(s, { type: 'setKitchenNote', note: 'x'.repeat(200) });
    expect(s.kitchenNote).toHaveLength(120);
    s = cartReducer(s, { type: 'clear' });
    expect(s).toEqual(EMPTY_CART);
  });

  it('hydrates from a saved state', () => {
    const saved = add(EMPTY_CART, pasta());
    expect(cartReducer(EMPTY_CART, { type: 'hydrate', state: saved })).toEqual(saved);
  });
});

describe('parseCart', () => {
  const saved = () => add(EMPTY_CART, pasta());

  it('accepts a valid cart and rejects junk', () => {
    expect(parseCart(saved())).toEqual(saved());
    expect(parseCart(null)).toBeNull();
    expect(parseCart({ lines: 'x', kitchenNote: '' })).toBeNull();
    expect(parseCart({ lines: [], kitchenNote: 3 })).toBeNull();
  });

  it('drops malformed lines and keeps the rest', () => {
    const [good] = saved().lines;
    const bad = [
      { key: 1 },
      null,
      'line',
      { ...good, options: null },
      { ...good, options: ['x'] },
      { ...good, removals: 'onion' },
      { ...good, addOnIds: [1] },
      { ...good, quantity: Number.NaN },
      { ...good, quantity: -1 },
      { ...good, quantity: 0 },
      { ...good, quantity: 1.5 },
      { ...good, quantity: 999 },
    ];
    const parsed = parseCart({ kitchenNote: '', lines: [...bad, good] });
    expect(parsed?.lines).toEqual([good]);
  });
});
