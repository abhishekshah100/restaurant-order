import type { OrderLineRequest, PhoneOrderRequest } from '@/api/contracts';
import type { MobileRules } from '@/types/branch';
import type { CartLine, LineConfig } from '@/types/cart';
import type { DeliveryAddress } from '@/types/order';
import { cleanAddress, validateAddress, type AddressError } from './addresses';
import { mobileError, type PhoneError } from './phone';
import type { Dish, Price } from '@/types/menu';
import { defaultConfig, lineKey, orderLine, unitPrice } from './cartLine';
import { groupsFor } from './options';

/*
 * The waiter's order pad, pure: the lines a waiter builds at the table (each a dish with its
 * choices and a quantity), what they come to, and the request they become. Lines are keyed like
 * the cart's (lib/cartLine), so the same dish with the same choices adds up.
 */

export type PadLines = readonly CartLine[];

/** A dish the waiter has to make choices for (a size, a spice level…) before adding it. */
export const hasChoices = (dish: Dish) =>
  Boolean(dish.variants?.length) || groupsFor(dish, dish.variants?.[0]?.id).length > 0;

/** The lines with `quantity` more of this configuration (a new line if it's not there yet). */
export function addLine(lines: PadLines, dish: Dish, config: LineConfig, quantity = 1): CartLine[] {
  const key = lineKey(config);
  if (lines.some((l) => l.key === key)) {
    return lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + quantity } : l));
  }
  return [...lines, { ...config, key, quantity, unitPrice: unitPrice(dish, config) }];
}

/** The lines with this one at `quantity`; 0 takes it off. */
export function setQuantity(lines: PadLines, key: string, quantity: number): CartLine[] {
  return quantity > 0
    ? lines.map((l) => (l.key === key ? { ...l, quantity } : l))
    : lines.filter((l) => l.key !== key);
}

/** The line of a dish without choices, as the pad adds it (one per dish). */
export const plainKey = (dish: Dish) => lineKey(defaultConfig(dish));

/** How many of a dish are on the pad, whatever was chosen. */
export const dishCount = (lines: PadLines, slug: string) =>
  lines.filter((l) => l.dishSlug === slug).reduce((n, l) => n + l.quantity, 0);

/** Items and their total at menu prices (the server applies offers and taxes). */
export function padTotals(lines: PadLines): { items: number; total: Price } {
  return lines.reduce(
    (sum, l) => ({ items: sum.items + l.quantity, total: sum.total + l.unitPrice * l.quantity }),
    { items: 0, total: 0 },
  );
}

/** The lines as the server takes them. */
export const padRequest = (lines: PadLines): OrderLineRequest[] => lines.map(orderLine);

/* ---------- Phone orders ---------- */

/** How a phone order reaches the customer. */
export type PhoneMode = 'takeaway' | 'delivery';

/** A phone order's details as staff fill them in. */
export interface PhoneDraft {
  name: string;
  /** The mobile number's digits, without the country code. */
  phone: string;
  /** The pickup slot chosen (ISO), or null for as soon as possible. */
  pickupAt: string | null;
  address: DeliveryAddress;
  /** Paid now (the payment opens next), or at pickup / cash to the rider. */
  paidNow: boolean;
}

export const emptyPhoneDraft = (): PhoneDraft => ({
  name: '',
  phone: '',
  pickupAt: null,
  address: { line: '', area: '', label: 'home' },
  paidNow: false,
});

/** What's missing or wrong before a phone order can be sent (the words live in content). */
export interface PhoneDraftErrors {
  name?: 'nameRequired';
  phone?: PhoneError;
  line?: AddressError;
  area?: AddressError;
  /** Takeaway with no pickup time left today. */
  pickup?: 'noPickup';
}

/**
 * The draft's problems: a name, a mobile number of the branch's country, and for delivery an
 * address in an area the branch serves; for takeaway, a pickup time (`pickupAt` as it will be
 * sent: undefined when none is left today).
 */
export function phoneDraftErrors(
  draft: PhoneDraft,
  mode: PhoneMode,
  rules: MobileRules,
  areas: readonly string[],
  pickupAt: string | null | undefined,
): PhoneDraftErrors {
  const phone = mobileError(draft.phone, rules);
  return {
    ...(draft.name.trim() === '' ? { name: 'nameRequired' as const } : {}),
    ...(phone ? { phone } : {}),
    ...(mode === 'delivery' ? validateAddress(draft.address, areas) : {}),
    ...(mode === 'takeaway' && pickupAt === undefined ? { pickup: 'noPickup' as const } : {}),
  };
}

export const hasErrors = (errors: PhoneDraftErrors) => Object.keys(errors).length > 0;

/**
 * The pickup time to send: the slot chosen, or as soon as possible when it's on offer, else
 * the first slot left (undefined: none left today).
 */
export function pickupToSend(
  chosen: string | null,
  options: { asap: Date | null; slots: readonly Date[] },
): string | null | undefined {
  if (chosen !== null && options.slots.some((s) => s.toISOString() === chosen)) return chosen;
  if (options.asap) return null;
  return options.slots[0]?.toISOString();
}

/** POST …/orders/phone's body from the pad. */
export function phoneRequest(
  draft: PhoneDraft,
  mode: PhoneMode,
  lines: PadLines,
  extra: { kitchenNote?: string; idempotencyKey: string; pickupAt: string | null },
): PhoneOrderRequest {
  return {
    customer: { name: draft.name.trim(), phone: draft.phone },
    fulfilment:
      mode === 'delivery'
        ? { mode, address: cleanAddress(draft.address) }
        : { mode, pickupAt: extra.pickupAt },
    ...(extra.kitchenNote ? { kitchenNote: extra.kitchenNote } : {}),
    lines: padRequest(lines),
    idempotencyKey: extra.idempotencyKey,
  };
}
