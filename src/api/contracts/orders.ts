import type { LineConfig } from '@/types/cart';
import type { DeliveryAddress } from '@/types/order';

/* ---------- Orders ---------- */

/** One cart line as ordered: what was chosen and how many. The server prices it from its menu. */
export type OrderLineRequest = LineConfig & { quantity: number };

/**
 * How the order reaches the guest; its mode must be the session's. Takeaway: a pickup slot
 * (ISO), or null for as soon as possible. Delivery: the address (its area picks the zone).
 */
export type FulfilmentRequest =
  | { mode: 'dineIn' }
  | { mode: 'takeaway'; pickupAt: string | null }
  | { mode: 'delivery'; address: DeliveryAddress };
