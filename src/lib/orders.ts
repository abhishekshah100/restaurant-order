import { mockOrders, NEW_ORDER_IDS } from '@/data/orders';
import type { CartLine } from '@/types/cart';
import type { Order, OrderItem, PaymentMethod } from '@/types/order';
import { describeInstructions, describeOptions, selectedVariant } from './cartLine';
import { getDish } from './menu';
import { calculateBill } from './pricing';
import { formatTime } from './format';

/** First unused id from the pre-rendered pool, or null when the pool is exhausted. */
export function nextOrderId(placed: readonly Order[]): string | null {
  const used = new Set(placed.map((o) => o.id));
  return NEW_ORDER_IDS.find((id) => !used.has(id)) ?? null;
}

export function toOrderItems(lines: readonly CartLine[]): OrderItem[] {
  return lines.flatMap((line) => {
    const dish = getDish(line.dishSlug);
    if (!dish) return [];
    const options = describeOptions(dish, line);
    const instructions = describeInstructions(line);
    return [
      {
        dishSlug: dish.slug,
        name: dish.name,
        veg: dish.veg,
        quantity: line.quantity,
        variant: selectedVariant(dish, line)?.name.split(' · ')[0],
        details: options ? [options] : [],
        note: instructions?.replace(/^“|”$/g, ''),
        unitPrice: line.unitPrice,
        status: 'queued',
      },
    ];
  });
}

export interface PlaceOrderInput {
  id: string;
  lines: readonly CartLine[];
  table: number;
  customerName: string;
  method: PaymentMethod;
  kitchenNote: string;
  now?: Date;
}

export function buildOrder(input: PlaceOrderInput): Order {
  const now = input.now ?? new Date();
  const bill = calculateBill(input.lines);
  const time = formatTime(now);
  return {
    id: input.id,
    table: input.table,
    customerName: input.customerName,
    placedBy: 'you',
    placedAt: now.toISOString(),
    status: 'received',
    items: toOrderItems(input.lines),
    itemTotal: bill.itemTotal,
    total: bill.total,
    payment:
      input.method === 'online'
        ? { method: 'online', status: 'paid', detail: 'UPI', transactionRef: '•••• 4821' }
        : { method: 'counter', status: 'unpaid' },
    timeline: [
      {
        status: 'received',
        time,
        note: input.method === 'online' ? 'Paid online' : 'Pay at counter',
      },
    ],
    estimate: '18–22 min',
    kitchenNote: input.kitchenNote || undefined,
  };
}

export function findOrder(id: string, placed: readonly Order[]): Order | undefined {
  return placed.find((o) => o.id === id) ?? mockOrders.find((o) => o.id === id);
}

export function isOrder(v: unknown): v is Order {
  if (!v || typeof v !== 'object') return false;
  const o = v as Order;
  return typeof o.id === 'string' && Array.isArray(o.items) && typeof o.total === 'number';
}
