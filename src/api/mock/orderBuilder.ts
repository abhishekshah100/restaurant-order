import {
  describeInstructions,
  describeOptions,
  lineConfig,
  shortVariant,
  unitPrice,
  type CartLineLabels,
} from '@/lib/cartLine';
import { createClock } from '@/lib/clock';
import type { MenuCatalog } from '@/lib/menu';
import { PAYMENT_METHODS } from '@/lib/payments';
import type { Bill } from '@/lib/pricing';
import { toOrderDiscounts } from '@/lib/promotions';
import type { Branch, PaymentMethodId } from '@/types/branch';
import type { Price } from '@/types/menu';
import type { Order, OrderEvent, OrderItem, PaymentMethod, Rider } from '@/types/order';
import type { AppliedOffer } from '@/types/promotion';
import type { OrderLineRequest } from '../contracts';
import type { Fulfilment } from './handlers/orderPricing';
import { MINUTE_MS } from './rules';

/** An ordered line with the price the server charges for one, and the automatic offer on it. */
export type PricedLine = OrderLineRequest & { unitPrice: Price; offer?: AppliedOffer };

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

const ORDER_ID = /^A(\d+)$/;

/**
 * The next order number after the highest one already known (A104 → A105, A999 → A1000), so an id
 * is never reused and there's no limit. Numbers have at least three digits, like the drawn history.
 */
export function nextOrderId(known: readonly { id: string }[]): string {
  const highest = Math.max(0, ...known.map((o) => Number(ORDER_ID.exec(o.id)?.[1] ?? 0)));
  return `A${String(highest + 1).padStart(3, '0')}`;
}

/** Priced lines as order items, with the words they're shown with and what was chosen. */
export function toOrderItems(
  lines: readonly PricedLine[],
  menu: MenuCatalog,
  lineLabels: CartLineLabels,
): OrderItem[] {
  return lines.flatMap((line) => {
    const { quantity, unitPrice, offer } = line;
    const config = lineConfig(line);
    const dish = menu.getDish(config.dishSlug);
    if (!dish) return [];
    const options = describeOptions(dish, config, lineLabels);
    const instructions = describeInstructions(config);
    return [
      {
        dishSlug: dish.slug,
        name: dish.name,
        veg: dish.veg,
        quantity,
        variant: shortVariant(dish, config),
        details: options ? [options] : [],
        note: instructions?.replace(/^“|”$/g, ''),
        unitPrice,
        status: 'queued',
        config,
        ...(offer ? { offer } : {}),
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
  /** Timeline note of a round that goes on the bill, paid at the end of the meal: "On your bill". */
  onBill: string;
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
  /** Its discounts included. */
  bill: Bill;
  /** The promo code it uses (checked). */
  promoCode?: string;
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
function fulfilmentFields({
  fulfilment,
  rider,
  now,
}: NewOrder): Pick<Order, 'mode' | 'table' | 'pickup' | 'delivery'> {
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
  const timeline: OrderEvent[] = [
    {
      status: 'received',
      time,
      note: settlement === 'online' ? labels.paidOnline : labels.payInPerson[settlement],
    },
  ];
  const kitchenNote = input.kitchenNote || undefined;
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
    ...(input.promoCode ? { promoCode: input.promoCode } : {}),
    ...(bill.discounts.length > 0
      ? { discounts: toOrderDiscounts(bill.discounts, branch.currency.minorUnit) }
      : {}),
    payment:
      settlement === 'online'
        ? {
            method: 'online',
            status: 'paid',
            detail: labels.methodName(input.method),
            transactionRef: input.transactionRef,
          }
        : { method: settlement, status: 'unpaid' },
    timeline,
    rounds: [
      {
        number: 1,
        placedAt: input.now.toISOString(),
        status: 'received',
        items,
        timeline,
        kitchenNote,
        changeableUntil: changeableUntil(input.now, branch),
      },
    ],
    ...(mode.mode === 'dineIn' ? { estimate: labels.estimate } : {}),
    kitchenNote,
  };
}

/** ISO: until when an order or round placed at `now` can be changed or cancelled (GET /branches › ordering). */
export const changeableUntil = (now: Date, branch: Pick<Branch, 'ordering'>) =>
  new Date(now.getTime() + branch.ordering.cancelWindowSeconds * 1000).toISOString();
