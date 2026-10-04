import {
  describeInstructions,
  describeOptions,
  shortVariant,
  unitPrice,
  type CartLineLabels,
} from '@/lib/cartLine';
import { createClock } from '@/lib/clock';
import type { MenuCatalog } from '@/lib/menu';
import { PAYMENT_METHODS } from '@/lib/payments';
import type { Bill } from '@/lib/pricing';
import type { Branch, PaymentMethodId } from '@/types/branch';
import type { Price } from '@/types/menu';
import type { Order, OrderItem, PaymentMethod, Rider } from '@/types/order';
import type { OrderLineRequest } from '../contracts';
import type { Fulfilment } from './handlers/orderPricing';
import { MINUTE_MS } from './rules';

/** An ordered line with the price the server charges for one. */
export type PricedLine = OrderLineRequest & { unitPrice: Price };

/**
 * Prices ordered lines from the branch menu (never trusting a client price); lines whose dish
 * isn't on the menu are dropped.
 */
export function priceLines(lines: readonly OrderLineRequest[], menu: MenuCatalog): PricedLine[] {
  return lines.flatMap((line) => {
    const dish = menu.getDish(line.dishSlug);
    return dish ? [{ ...line, unitPrice: unitPrice(dish, line) }] : [];
  });
}

/** The rider for a new delivery order: the branch's riders take turns by order id. */
export function assignRider(riders: readonly Rider[], orderId: string): Rider | undefined {
  if (riders.length === 0) return undefined;
  const n = [...orderId].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return riders[n % riders.length];
}

/** First unused id from the pre-rendered pool (GET /orders › newOrderIds), or null when it's used up. */
export function nextOrderId(
  placed: readonly { id: string }[],
  pool: readonly string[],
): string | null {
  const used = new Set(placed.map((o) => o.id));
  return pool.find((id) => !used.has(id)) ?? null;
}

function toOrderItems(
  lines: readonly PricedLine[],
  menu: MenuCatalog,
  lineLabels: CartLineLabels,
): OrderItem[] {
  return lines.flatMap((line) => {
    const dish = menu.getDish(line.dishSlug);
    if (!dish) return [];
    const options = describeOptions(dish, line, lineLabels);
    const instructions = describeInstructions(line);
    return [
      {
        dishSlug: dish.slug,
        name: dish.name,
        veg: dish.veg,
        quantity: line.quantity,
        variant: shortVariant(dish, line),
        details: options ? [options] : [],
        note: instructions?.replace(/^“|”$/g, ''),
        unitPrice: line.unitPrice,
        status: 'queued',
      },
    ];
  });
}

/** Words a new order is written with (from the orders, common and cart content). */
export interface OrderLabels {
  /** Timeline note when paid online, e.g. "Paid online". */
  paidOnline: string;
  /** Timeline note when it's paid in person: "Pay at counter", "Pay at pickup", "Cash on delivery". */
  payInPerson: Record<Exclude<PaymentMethod, 'online'>, string>;
  /** How an online payment is shown on the order: the method's name, e.g. "UPI", "eSewa". */
  methodName: (method: PaymentMethodId) => string;
  /** Words for the items' option lines (see lib/cartLine). */
  lineLabels: CartLineLabels;
  /** Kitchen estimate stored on a dine-in order: GET /branches › prepTime. */
  estimate: string;
}

export interface NewOrder {
  id: string;
  lines: readonly PricedLine[];
  /** How it reaches the guest, as the server checked it (orderPricing › priceOrder). */
  fulfilment: Fulfilment;
  /** Delivery: the rider assigned to it (shown to the guest once out for delivery). */
  rider?: Rider;
  bill: Bill;
  /** The guest session placing it. */
  sessionId: string;
  customerName: string;
  /** The payment method the guest chose (one of the branch's). */
  method: PaymentMethodId;
  kitchenNote: string;
  /** The payment partner's reference, for an online payment. */
  transactionRef?: string;
  now: Date;
}

/** The mode-specific part of a new order: its table, pickup time or delivery details. */
function fulfilmentFields(
  { fulfilment, rider, now }: NewOrder,
): Pick<Order, 'mode' | 'table' | 'pickup' | 'delivery'> {
  switch (fulfilment.mode) {
    case 'dineIn':
      return { mode: 'dineIn', table: fulfilment.table };
    case 'takeaway':
      return { mode: 'takeaway', pickup: fulfilment.pickup };
    case 'delivery': {
      const { address, quote } = fulfilment;
      return {
        mode: 'delivery',
        delivery: {
          address,
          zoneId: quote.zoneId,
          zoneName: quote.zoneName,
          fee: quote.fee,
          expectedAt: new Date(now.getTime() + quote.etaMinutes * MINUTE_MS).toISOString(),
          ...(rider ? { rider } : {}),
        },
      };
    }
  }
}

/** The order for priced lines at a branch (its clock), or null when there's nothing to order. */
export function buildOrder(
  input: NewOrder,
  menu: MenuCatalog,
  labels: OrderLabels,
  branch: Branch,
): Order | null {
  const items = toOrderItems(input.lines, menu, labels.lineLabels);
  if (items.length === 0) return null;
  const { bill } = input;
  const time = createClock(branch).time(input.now);
  const { settlement } = PAYMENT_METHODS[input.method];
  const mode = fulfilmentFields(input);
  return {
    id: input.id,
    branchId: branch.id,
    ...mode,
    customerName: input.customerName,
    placedBy: 'you',
    sessionId: input.sessionId,
    placedAt: input.now.toISOString(),
    status: 'received',
    items,
    itemTotal: bill.itemTotal,
    total: bill.total,
    payment:
      settlement === 'online'
        ? {
            method: 'online',
            status: 'paid',
            detail: labels.methodName(input.method),
            transactionRef: input.transactionRef,
          }
        : { method: settlement, status: 'unpaid' },
    timeline: [
      {
        status: 'received',
        time,
        note: settlement === 'online' ? labels.paidOnline : labels.payInPerson[settlement],
      },
    ],
    ...(mode.mode === 'dineIn' ? { estimate: labels.estimate } : {}),
    kitchenNote: input.kitchenNote || undefined,
  };
}
