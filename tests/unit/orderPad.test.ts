import { describe, expect, it } from 'vitest';
import { defaultConfig, lineKey } from '@/lib/cartLine';
import {
  addLine,
  dishCount,
  emptyPhoneDraft,
  hasChoices,
  padRequest,
  padTotals,
  phoneDraftErrors,
  phoneRequest,
  pickupToSend,
  plainKey,
  setQuantity,
} from '@/lib/orderPad';
import type { MobileRules } from '@/types/branch';
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

describe('a phone order on the pad', () => {
  const NEPAL: MobileRules = {
    dialCode: '+977',
    length: 10,
    pattern: '^9[78]\\d{8}$',
    groups: [3, 7],
    separator: '-',
    showDialCode: true,
  };
  const areas = ['Thamel', 'Lazimpat'];
  const filled = {
    ...emptyPhoneDraft(),
    name: ' Sita Sharma ',
    phone: '9841234567',
    address: { line: ' 12 Lake Road ', area: 'Thamel', label: 'home' as const, landmark: ' ' },
  };

  it('needs a name, a mobile number of the branch’s country, and an address for delivery', () => {
    expect(phoneDraftErrors(emptyPhoneDraft(), 'delivery', NEPAL, areas, null)).toEqual({
      name: 'nameRequired',
      phone: 'phoneLength',
      line: 'lineRequired',
      area: 'areaRequired',
    });
    expect(
      phoneDraftErrors({ ...filled, phone: '9612345678' }, 'takeaway', NEPAL, areas, null),
    ).toEqual({ phone: 'phonePrefix' });
    expect(phoneDraftErrors(filled, 'delivery', NEPAL, areas, null)).toEqual({});
    // Takeaway with no pickup time left today.
    expect(phoneDraftErrors(filled, 'takeaway', NEPAL, areas, undefined)).toEqual({
      pickup: 'noPickup',
    });
  });

  it('sends as soon as possible, the slot chosen, or the first slot when ASAP is off', () => {
    const slots = [new Date('2026-10-15T14:15:00Z'), new Date('2026-10-15T14:30:00Z')];
    const asap = new Date('2026-10-15T14:05:00Z');
    expect(pickupToSend(null, { asap, slots })).toBeNull();
    expect(pickupToSend('2026-10-15T14:30:00.000Z', { asap, slots })).toBe(
      '2026-10-15T14:30:00.000Z',
    );
    // A slot gone since it was picked: as soon as possible instead.
    expect(pickupToSend('2026-10-15T13:00:00.000Z', { asap, slots })).toBeNull();
    expect(pickupToSend(null, { asap: null, slots })).toBe('2026-10-15T14:15:00.000Z');
    expect(pickupToSend(null, { asap: null, slots: [] })).toBeUndefined();
  });

  it('builds the request: the customer, how it reaches them, the lines', () => {
    const lines = addLine([], kebab, defaultConfig(kebab), 2);
    const extra = { idempotencyKey: 'pad-key-12345', pickupAt: null };
    expect(phoneRequest(filled, 'delivery', lines, extra)).toEqual({
      customer: { name: 'Sita Sharma', phone: '9841234567' },
      fulfilment: {
        mode: 'delivery',
        address: { line: '12 Lake Road', area: 'Thamel', label: 'home' },
      },
      lines: padRequest(lines),
      idempotencyKey: 'pad-key-12345',
    });
    expect(
      phoneRequest(filled, 'takeaway', lines, { ...extra, kitchenNote: 'Less spicy' }),
    ).toMatchObject({
      fulfilment: { mode: 'takeaway', pickupAt: null },
      kitchenNote: 'Less spicy',
    });
  });
});
