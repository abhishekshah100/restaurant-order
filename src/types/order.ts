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
  /** Who placed it, relative to the current guest. */
  placedBy: 'you' | 'other';
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
  cancelReason?: string;
  kitchenNote?: string;
}
