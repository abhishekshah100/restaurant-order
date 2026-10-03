import type { Rupees } from './menu';

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'served' | 'cancelled';

export type ItemStatus = 'queued' | 'preparing' | 'ready' | 'served';

export type PaymentMethod = 'online' | 'counter';

export type PaymentStatus = 'paid' | 'unpaid' | 'refunded' | 'refund-started';

export interface OrderItem {
  dishSlug: string;
  name: string;
  veg: boolean;
  quantity: number;
  /** Variant label, e.g. "Full". */
  variant?: string;
  /** Detail lines, e.g. ["Full · 10 pcs · Medium spicy", "+ Extra mint chutney (free)"]. */
  details: string[];
  note?: string;
  unitPrice: Rupees;
  status?: ItemStatus;
}

export interface OrderEvent {
  status: OrderStatus;
  /** Display time, e.g. "7:42 PM". */
  time: string;
  note?: string;
}

export interface Order {
  id: string;
  table: number;
  customerName: string;
  /** Who placed it, relative to this device's guest (see lib/orders › isOwnOrder). */
  placedBy: 'you' | 'other';
  /** The guest session that placed it; missing on orders from before sessions. */
  sessionId?: string;
  /** ISO timestamp. */
  placedAt: string;
  status: OrderStatus;
  items: OrderItem[];
  itemTotal: Rupees;
  /** Final rounded amount. */
  total: Rupees;
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    /** e.g. "UPI · ananya@[bank]". */
    detail?: string;
    transactionRef?: string;
    refundAmount?: Rupees;
  };
  timeline: OrderEvent[];
  /** e.g. "18–22 min". */
  estimate?: string;
  /** Minutes until the food is ready, while it's being made. */
  etaMinutes?: number;
  /** Expected ready time, e.g. "7:58 PM". */
  readyBy?: string;
  cancelReason?: string;
  kitchenNote?: string;
}

/** A time on a day relative to today in restaurant time (IST), for mock data only. */
export interface RelativeTime {
  /** 0 = today, 1 = yesterday… */
  daysAgo: number;
  /** 24-hour "HH:MM", e.g. "19:42". */
  time: string;
}

/**
 * An order as GET /orders sends it. A real backend sends `placedAt`. The dummy JSON can't
 * date its drawn "today" orders, so those send `placedAt: null` and `placedRelative`
 * instead; src/api/adapters turns either into an `Order`.
 */
export type ApiOrder =
  | (Order & { placedRelative?: undefined })
  | (Omit<Order, 'placedAt'> & { placedAt: null; placedRelative: RelativeTime });

/** GET /orders. */
export interface OrdersResponse {
  /** Orders already on the restaurant's books for this guest and table. */
  history: ApiOrder[];
  /**
   * IDs handed to orders placed in this browser. A static export can only serve
   * pre-rendered order pages, so new orders draw from this pre-generated pool.
   */
  newOrderIds: string[];
}

/** GET /orders after the adapter: every order has a real `placedAt`. */
export interface OrderHistory {
  history: Order[];
  newOrderIds: string[];
}
