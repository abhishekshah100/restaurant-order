import type { Order } from '@/types/order';

/* ---------- Kitchen ---------- */

/**
 * `PATCH /admin/branches/:branchId/orders/:id/rounds/:round/status` — the kitchen moved a round
 * (round 1 for an order of one round) on: `preparing` (started cooking) or `ready` (ready to serve
 * or collect; for delivery, handed to the rider). `ready` may skip `preparing`. Recorded on the
 * round's `kitchen` (`started` / `ready`: when and who); the guest's tracking and the floor follow.
 * Idempotent: a round already there (or further along in the kitchen) answers the same.
 * 200 → the order (`Order`, as GET /orders/:id). Errors: 400 invalid_request (another status),
 * 401 unauthorized, 403 forbidden, 404 not_found (no such order at the branch, or round), 409
 * order_closed (cancelled, or the round already served, picked up or out for delivery).
 */
export interface SetKitchenStatusRequest {
  status: KitchenStep;
  /**
   * An undo or a recall: the round goes back to New (`received`) or to Cooking (`preparing`)
   * from further along (a round already there or behind answers the same). Without it a step
   * only goes forward.
   */
  back?: boolean;
}

/** What the kitchen can mark a round as (`received` only going back). */
export type KitchenStep = 'received' | 'preparing' | 'ready';

/**
 * `POST /admin/branches/:branchId/orders/:id/rounds/:round/dismiss` — the kitchen saw a cancelled
 * ticket and put it away: the round gets `dismissedAt`, and every kitchen screen drops it (a live
 * change). No body. Needs `kitchen.update`. Idempotent. 200 → the order (as the plated tick).
 * Errors: 401, 403, 404 not_found (no such order or round), 409 conflict (not cancelled).
 */

/**
 * `PATCH /admin/branches/:branchId/orders/:id/rounds/:round/items/:position/plated` — the kitchen
 * ticks an item off as plated (or unticks it), so every kitchen screen shows it. `position` is
 * the item's index in the round (0 first). Needs `kitchen.update`. 200 → the order. Errors: 404
 * not_found (no such item), 409 order_closed (cancelled, or the round handed over).
 */
export interface SetPlatedRequest {
  plated: boolean;
}

/**
 * `POST /admin/branches/:branchId/orders/:id/messages` — the kitchen tells the waiters about an
 * order: a request of the `kitchen` kind on their board, dealt with like a guest's call. Needs
 * `kitchen.update`. 201 → `{ request }`. Errors: 400 invalid_request, 404 not_found.
 */
export interface KitchenMessageRequest {
  reason: 'runningLate' | 'unavailable' | 'question';
  /** Up to 80 characters. */
  note?: string;
}

/**
 * `GET /admin/branches/:branchId/events` — Server-Sent Events: what changes at the branch, for as
 * long as the screen keeps it open (`orders.view`, `kitchen.update` or `inventory.view`). `event:`
 * orders | service | menu | inventory | resync,
 * `data:` this; the screen reads again through the usual endpoints. A heartbeat comment every
 * 25 s; closed when the session ends. 429 rate_limited past six streams for one sign-in.
 */
export interface BranchEvent {
  kind: 'orders' | 'service' | 'menu' | 'inventory' | 'resync';
  orderId?: string;
  at: string;
}

export type SetKitchenStatusResponse = Order;
