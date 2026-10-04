import type { Branch, DeliveryZone, OrderMode } from '@/types/branch';
import type { Price } from '@/types/menu';
import { createClock } from './clock';

/*
 * Order modes: which a branch offers, takeaway pickup slots and delivery zones. Pure: the
 * branch's rules (GET /branches › modes) and the time come in as arguments, so the app and the
 * mock server work them out the same way.
 */

const MINUTE_MS = 60_000;

/** Every order mode, in the order the guest is offered them. */
export const ORDER_MODES: readonly OrderMode[] = ['dineIn', 'takeaway', 'delivery'];

export const isOrderMode = (v: unknown): v is OrderMode =>
  typeof v === 'string' && (ORDER_MODES as readonly string[]).includes(v);

/** The modes a branch takes orders in. */
export const branchModes = (branch: Pick<Branch, 'modes'>): OrderMode[] =>
  ORDER_MODES.filter((mode) => branch.modes[mode].enabled);

/** The checkout payment methods for a mode: dine-in's own list, or the mode's. */
export const modePayments = (branch: Pick<Branch, 'modes' | 'payments'>, mode: OrderMode) =>
  mode === 'dineIn' ? branch.payments.checkout : branch.modes[mode].payments;

/* ---------- Delivery ---------- */

/** Every area a branch delivers to, zone by zone. */
export const deliveryAreas = (zones: readonly DeliveryZone[]): string[] =>
  zones.flatMap((z) => z.areas);

/** The zone that covers an area, if any. */
export const findZone = (zones: readonly DeliveryZone[], area: string): DeliveryZone | undefined =>
  zones.find((z) => z.areas.includes(area));

/** What delivering an order to an area costs and needs (POST /delivery/quote). */
export interface DeliveryQuote {
  area: string;
  zoneId: string;
  zoneName: string;
  /** The fee for this order: 0 once the item total reaches `freeAbove`. */
  fee: Price;
  /** The zone's usual fee. */
  baseFee: Price;
  freeAbove?: Price;
  minOrder: Price;
  /** How much more must be added to reach the minimum (0 when it's reached). */
  shortBy: Price;
  /** Minutes from placing to the door. */
  etaMinutes: number;
}

/** The quote for an item total delivered to `area` in `zone`. */
export function quoteDelivery(zone: DeliveryZone, area: string, itemTotal: Price): DeliveryQuote {
  const free = zone.freeAbove !== undefined && itemTotal >= zone.freeAbove;
  return {
    area,
    zoneId: zone.id,
    zoneName: zone.name,
    fee: free ? 0 : zone.fee,
    baseFee: zone.fee,
    ...(zone.freeAbove !== undefined ? { freeAbove: zone.freeAbove } : {}),
    minOrder: zone.minOrder,
    shortBy: Math.max(0, zone.minOrder - itemTotal),
    etaMinutes: zone.etaMinutes,
  };
}

/** The cheapest fee, the lowest minimum and the ETA range over a branch's zones ("from ₹30"). */
export function deliverySummary(zones: readonly DeliveryZone[]) {
  const eta = zones.map((z) => z.etaMinutes);
  return {
    fee: Math.min(...zones.map((z) => z.fee)),
    minOrder: Math.min(...zones.map((z) => z.minOrder)),
    etaMin: Math.min(...eta),
    etaMax: Math.max(...eta),
  };
}

/**
 * Minutes until a takeaway is ready to collect, or a delivery is at the door (the quoted zone's
 * ETA; the quickest zone's before an area is chosen).
 */
export function etaMinutes(
  branch: Pick<Branch, 'modes'>,
  mode: Exclude<OrderMode, 'dineIn'>,
  quote?: Pick<DeliveryQuote, 'etaMinutes'>,
): number {
  if (mode === 'takeaway') return branch.modes.takeaway.prepMinutes;
  return quote?.etaMinutes ?? deliverySummary(branch.modes.delivery.zones).etaMin;
}

/* ---------- Minimum order ---------- */

/** A mode's minimum order and how far the cart is from it; null when there's none to meet. */
export function minimumOrder(
  branch: Pick<Branch, 'modes'>,
  mode: OrderMode,
  itemTotal: Price,
  quote?: Pick<DeliveryQuote, 'minOrder'>,
): { minimum: Price; shortBy: Price } | null {
  let minimum = 0;
  if (mode === 'takeaway') minimum = branch.modes.takeaway.minOrder;
  else if (mode === 'delivery') minimum = quote?.minOrder ?? 0;
  return minimum > 0 ? { minimum, shortBy: Math.max(0, minimum - itemTotal) } : null;
}

/* ---------- Takeaway ---------- */

export interface PickupOptions {
  /** When an order placed now would be ready; null when "as soon as possible" isn't on offer. */
  asap: Date | null;
  /** Later pickup times today, every `slotMinutes` from opening, up to closing time. */
  slots: Date[];
}

/**
 * Pickup times for an order placed at `now`, in the branch's time zone: as soon as possible
 * (`prepMinutes` from now, while open) and the slots after that until closing.
 */
export function pickupOptions(branch: Pick<Branch, 'hours' | 'modes' | 'locale' | 'timezone'>, now: Date): PickupOptions {
  const { prepMinutes, slotMinutes, asap } = branch.modes.takeaway;
  const clock = createClock(branch);
  const today = (time: string) => Date.parse(clock.localTimestamp(0, time, now));
  const opens = today(branch.hours.opens);
  const closes = today(branch.hours.closes);
  const prep = prepMinutes * MINUTE_MS;
  const ready = now.getTime() + prep;
  const earliest = Math.max(ready, opens + prep);
  const step = slotMinutes * MINUTE_MS;
  const slots: Date[] = [];
  for (let at = opens + Math.ceil((earliest - opens) / step) * step; at <= closes; at += step) {
    // A slot right on top of "as soon as possible" adds nothing.
    if (at > ready) slots.push(new Date(at));
  }
  const open = now.getTime() >= opens && ready <= closes;
  return { asap: asap && open ? new Date(ready) : null, slots };
}

/** Whether `at` (ISO) is one of the pickup slots offered at `now`. */
export function isPickupSlot(
  branch: Pick<Branch, 'hours' | 'modes' | 'locale' | 'timezone'>,
  now: Date,
  at: string,
): boolean {
  const wanted = Date.parse(at);
  return pickupOptions(branch, now).slots.some((slot) => slot.getTime() === wanted);
}
