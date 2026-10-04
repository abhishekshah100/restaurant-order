import type { OrderMode } from './branch';
import type { Price } from './menu';

/**
 * Where an order has got to. Dine-in: received → preparing → ready → served. Takeaway: …
 * ready (for pickup) → picked up. Delivery: received → preparing → out for delivery → delivered.
 */
export type OrderStatus =
  | 'received'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'pickedUp'
  | 'outForDelivery'
  | 'delivered'
  | 'cancelled';

export type ItemStatus = 'queued' | 'preparing' | 'ready' | 'served';

/** How an order is settled: online, or in person (at the counter, at pickup, cash on delivery). */
export type PaymentMethod = 'online' | 'counter' | 'pickup' | 'cod';

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
  unitPrice: Price;
  status?: ItemStatus;
}

export interface OrderEvent {
  status: OrderStatus;
  /** Display time, e.g. "7:42 PM". */
  time: string;
  note?: string;
}

/** What a delivery address is saved as. */
export type AddressLabel = 'home' | 'work' | 'other';

/** Where a delivery goes. The guest's name and number are the order's. */
export interface DeliveryAddress {
  /** House, street: "12 Lake Road, Flat 3B". */
  line: string;
  /** One of the branch's delivery areas: "Lazimpat". */
  area: string;
  landmark?: string;
  /** For the rider: "Ring the bell twice". */
  instructions?: string;
  label: AddressLabel;
}

/** A takeaway order's collection time. */
export interface PickupDetails {
  /** Chosen "as soon as possible" rather than a slot. */
  asap: boolean;
  /** ISO: when it's ready to collect. */
  at: string;
}

/** The rider bringing a delivery (once it's out). */
export interface Rider {
  name: string;
  /** Masked for privacy, as shown: "98••• ••321". */
  phone: string;
  /** A tel: link to a masked relay number. */
  callHref: string;
}

/** A delivery order's address, zone, fee and timing. */
export interface DeliveryDetails {
  address: DeliveryAddress;
  zoneId: string;
  zoneName: string;
  /** The fee charged (0 when free above the zone's threshold). */
  fee: Price;
  /** ISO: when it's expected at the door. */
  expectedAt: string;
  rider?: Rider;
}

export interface Order {
  id: string;
  /** The branch it was placed at (GET /branches). */
  branchId: string;
  /** Dine-in, takeaway or delivery. */
  mode: OrderMode;
  /** Dine-in only: the table it's served at. */
  table?: number;
  /** Takeaway only. */
  pickup?: PickupDetails;
  /** Delivery only. */
  delivery?: DeliveryDetails;
  customerName: string;
  /** Drawn history only: "you" marks this device's past visits on My orders. Ownership on bills uses `sessionId` (lib/orders › isOwnOrder). */
  placedBy: 'you' | 'other';
  /** The guest session that placed it; missing on orders from before sessions. */
  sessionId?: string;
  /** ISO timestamp. */
  placedAt: string;
  status: OrderStatus;
  items: OrderItem[];
  itemTotal: Price;
  /** Final rounded amount. */
  total: Price;
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    /** How it was paid, e.g. "UPI", "eSewa". */
    detail?: string;
    transactionRef?: string;
    refundAmount?: Price;
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
  /** Set by the server on a read: true while the kitchen is still updating the order (poll it). */
  live?: boolean;
}

/** A time on a day relative to today in the branch's local time, for mock data only. */
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
type ApiOrderFields = Omit<Order, 'mode' | 'placedAt'> & {
  /** Orders from before order modes have none: they were dine-in. */
  mode?: OrderMode;
};
export type ApiOrder =
  | (ApiOrderFields & { placedAt: string; placedRelative?: undefined })
  | (ApiOrderFields & { placedAt: null; placedRelative: RelativeTime });

/** GET /orders. */
export interface OrdersResponse {
  /** Orders already on the restaurant's books for this guest and table. */
  history: ApiOrder[];
  /**
   * IDs handed to orders placed in this browser. A static export can only serve
   * pre-rendered order pages, so new orders draw from this pre-generated pool.
   */
  newOrderIds: string[];
  /**
   * Riders by branch id, who take delivery orders (the mock server assigns one; a real backend
   * dispatches them). Their numbers are masked, and calls go through a relay line.
   */
  riders: Record<string, Rider[]>;
}

/** GET /orders after the adapter: every order has a real `placedAt`. */
export interface OrderHistory {
  history: Order[];
  newOrderIds: string[];
}
