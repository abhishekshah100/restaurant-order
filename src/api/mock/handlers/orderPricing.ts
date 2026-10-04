import {
  findZone,
  isPickupSlot,
  minimumOrder,
  pickupOptions,
  quoteDelivery,
  type DeliveryQuote,
} from '@/lib/fulfilment';
import { calculateBill, itemTotal, type Bill } from '@/lib/pricing';
import type { Branch } from '@/types/branch';
import type { AddressLabel, DeliveryAddress, PickupDetails } from '@/types/order';
import type { GuestSession } from '@/types/session';
import type {
  DeliveryQuoteResponse,
  FulfilmentRequest,
  OrderLineRequest,
} from '../../contracts';
import { fail, isObject, objectBody, ok, stringField, type Handler } from '../context';
import { priceLines, type PricedLine } from '../orderBuilder';

/*
 * Pricing an order as the server does (POST /orders, POST /payments): its lines from the menu,
 * and how it reaches the guest, with the server's checks for each mode and its delivery quote.
 */

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === 'string');

function isOrderLine(v: unknown): v is OrderLineRequest {
  return (
    isObject(v) &&
    typeof v.dishSlug === 'string' &&
    (v.variantId === undefined || typeof v.variantId === 'string') &&
    isStringArray(v.addOnIds) &&
    isObject(v.options) &&
    Object.values(v.options).every((o) => typeof o === 'string') &&
    isStringArray(v.removals) &&
    isStringArray(v.instructions) &&
    typeof v.note === 'string' &&
    typeof v.quantity === 'number' &&
    Number.isInteger(v.quantity) &&
    v.quantity > 0
  );
}

/** The ordered lines of a body, or 400. */
export function orderLines(body: Record<string, unknown>): OrderLineRequest[] {
  const { lines } = body;
  if (!Array.isArray(lines) || !lines.every(isOrderLine)) fail(400, 'invalid_request');
  return lines;
}

const LABELS = new Set<AddressLabel>(['home', 'work', 'other']);
/** Longest free-text field on an address. */
const ADDRESS_FIELD_MAX = 160;

const optionalText = (v: unknown) =>
  v === undefined || (typeof v === 'string' && v.length <= ADDRESS_FIELD_MAX);

function isAddress(v: unknown): v is DeliveryAddress {
  return (
    isObject(v) &&
    typeof v.line === 'string' &&
    v.line.trim() !== '' &&
    v.line.length <= ADDRESS_FIELD_MAX &&
    typeof v.area === 'string' &&
    optionalText(v.landmark) &&
    optionalText(v.instructions) &&
    typeof v.label === 'string' &&
    LABELS.has(v.label as AddressLabel)
  );
}

/** The body's `fulfilment`, or 400. */
export function fulfilmentBody(body: Record<string, unknown>): FulfilmentRequest {
  const { fulfilment: f } = body;
  if (isObject(f)) {
    if (f.mode === 'dineIn') return { mode: 'dineIn' };
    if (f.mode === 'takeaway' && (f.pickupAt === null || typeof f.pickupAt === 'string')) {
      return { mode: 'takeaway', pickupAt: f.pickupAt };
    }
    if (f.mode === 'delivery' && isAddress(f.address)) {
      const { line, area, landmark, instructions, label } = f.address;
      return {
        mode: 'delivery',
        address: {
          line: line.trim(),
          area,
          label,
          ...(landmark?.trim() ? { landmark: landmark.trim() } : {}),
          ...(instructions?.trim() ? { instructions: instructions.trim() } : {}),
        },
      };
    }
  }
  fail(400, 'invalid_request');
}

/** The checked fulfilment of an order, with what the server worked out for it. */
export type Fulfilment =
  | { mode: 'dineIn'; table: number }
  | { mode: 'takeaway'; pickup: PickupDetails }
  | { mode: 'delivery'; address: DeliveryAddress; quote: DeliveryQuote };

/** A delivery quote for an area, or 422 area_not_served. */
function quoteFor(branch: Branch, area: string, total: number): DeliveryQuote {
  const zone = findZone(branch.modes.delivery.zones, area);
  if (!zone) fail(422, 'area_not_served');
  return quoteDelivery(zone, area, total);
}

/**
 * Checks a fulfilment against the session and the branch's rules: the session's mode (and
 * table, for dine-in), the minimum order, a pickup slot still on offer, a delivery area served.
 */
function resolveFulfilment(
  request: FulfilmentRequest,
  session: GuestSession,
  branch: Branch,
  total: number,
  now: Date,
): Fulfilment {
  if (request.mode !== session.mode || !branch.modes[request.mode].enabled) {
    fail(409, 'mode_unavailable');
  }
  if (request.mode === 'dineIn') {
    if (session.table === undefined) fail(409, 'mode_unavailable');
    return { mode: 'dineIn', table: session.table };
  }
  const quote = request.mode === 'delivery' ? quoteFor(branch, request.address.area, total) : undefined;
  const short = minimumOrder(branch, request.mode, total, quote);
  if (short && short.shortBy > 0) fail(422, 'below_minimum', { shortBy: short.shortBy });
  if (request.mode === 'delivery' && quote) {
    return { mode: 'delivery', address: request.address, quote };
  }
  if (request.mode === 'takeaway') {
    if (request.pickupAt === null) {
      const { asap } = pickupOptions(branch, now);
      if (!asap) fail(422, 'pickup_unavailable');
      return { mode: 'takeaway', pickup: { asap: true, at: asap.toISOString() } };
    }
    if (!isPickupSlot(branch, now, request.pickupAt)) fail(422, 'pickup_unavailable');
    return {
      mode: 'takeaway',
      pickup: { asap: false, at: new Date(request.pickupAt).toISOString() },
    };
  }
  fail(400, 'invalid_request');
}

/** An order as the server prices it: its lines from the menu, its fulfilment and its bill. */
export interface PricedOrder {
  lines: PricedLine[];
  fulfilment: Fulfilment;
  bill: Bill;
}

/** Prices a body's lines and fulfilment for the session (POST /orders and POST /payments). */
export function priceOrder(
  body: Record<string, unknown>,
  session: GuestSession,
  branch: Branch,
  menu: Parameters<typeof priceLines>[1],
  now: Date,
): PricedOrder {
  const lines = priceLines(orderLines(body), menu);
  if (lines.length === 0) fail(422, 'empty_order');
  const fulfilment = resolveFulfilment(
    fulfilmentBody(body),
    session,
    branch,
    itemTotal(lines),
    now,
  );
  const delivery =
    fulfilment.mode === 'delivery'
      ? { fee: fulfilment.quote.fee, taxable: branch.modes.delivery.feeTaxable }
      : undefined;
  return { lines, fulfilment, bill: calculateBill(lines, branch, delivery) };
}

/** POST /delivery/quote */
export const deliveryQuote: Handler = async (ctx, { body: raw }) => {
  const body = objectBody(raw);
  const branchId = stringField(body, 'branchId');
  const area = stringField(body, 'area');
  const { itemTotal: total } = body;
  const branch = (await ctx.seed.branches()).find((b) => b.id === branchId);
  if (!branch?.modes.delivery.enabled || typeof total !== 'number' || total < 0) {
    fail(400, 'invalid_request');
  }
  const response: DeliveryQuoteResponse = quoteFor(branch, area, total);
  return ok(response);
};
