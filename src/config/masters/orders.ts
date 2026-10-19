/*
 * Master values for orders: how the guest gets their food, where an order has got to, and why
 * one is cancelled, rejected by the kitchen or refunded. Codes are what the API and stored data
 * use; the words are in content (named on each list), never here.
 */

/**
 * Order type (also the service type): at a table, collected from the counter, or brought to the
 * guest. Words: common › modes.
 */
export const ORDER_TYPES = ['dineIn', 'takeaway', 'delivery'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

/** Service type is the order type: one list for both. */
export const SERVICE_TYPES = ORDER_TYPES;
export type ServiceType = OrderType;

/**
 * Order status. `received` is the new order waiting for the kitchen ("Pending"); takeaway ends
 * at `pickedUp` and delivery goes `outForDelivery` → `delivered` instead of `served`.
 * Words: common › orderStatus.
 */
export const ORDER_STATUSES = [
  'received',
  'preparing',
  'ready',
  'served',
  'pickedUp',
  'outForDelivery',
  'delivered',
  'cancelled',
] as const;
export type OrderStatusCode = (typeof ORDER_STATUSES)[number];

/** The steps an order goes through, by order type (cancelled can happen at any step). */
export const ORDER_FLOWS = {
  dineIn: ['received', 'preparing', 'ready', 'served'],
  takeaway: ['received', 'preparing', 'ready', 'pickedUp'],
  delivery: ['received', 'preparing', 'outForDelivery', 'delivered'],
} as const satisfies Record<OrderType, readonly OrderStatusCode[]>;

/** One dish on an order, in the kitchen. */
export const ITEM_STATUSES = ['queued', 'preparing', 'ready', 'served'] as const;
export type ItemStatusCode = (typeof ITEM_STATUSES)[number];

/**
 * Why the restaurant cancels an order, in the order staff are offered them. "Item unavailable"
 * is `outOfStock`; "Customer request" is `guestLeft`. Words: common › adminOrder.cancel.reasons
 * (staff) and orders › restaurantCancel (what the guest is told).
 */
export const CANCELLATION_REASONS = [
  'outOfStock',
  'guestLeft',
  'kitchenIssue',
  'duplicate',
  'other',
] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

/**
 * Why the kitchen can't make a dish on a ticket. Words: common › masters.rejectionReasons.
 */
export const REJECTION_REASONS = [
  'outOfStock',
  'ingredientUnavailable',
  'equipmentIssue',
  'other',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

/**
 * Why staff give money back on an order that stands, in the order they're offered.
 * Words: common › adminPayments.entry.reasons.
 */
export const REFUND_REASONS = [
  'complaint',
  'wrongItem',
  'overcharged',
  'goodwill',
  'other',
] as const;
export type RefundReasonCode = (typeof REFUND_REASONS)[number];
