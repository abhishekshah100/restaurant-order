import type { BillScopeCode, ServiceRequestKind, WaiterRequestReason } from '@/config/masters';
import type { OrderMode } from './branch';

export type ServiceKind = ServiceRequestKind;

export type WaiterReason = WaiterRequestReason;

/** Which orders the guest wants on the bill. */
export type BillScope = BillScopeCode;

interface BaseRequest {
  id: string;
  table: number;
  /** The guest session that made it; other guests at the table don't see it. */
  sessionId: string;
  /** ISO timestamp. */
  requestedAt: string;
  /** ISO: when a member of staff said they're on their way (POST …/acknowledge). Still pending. */
  acknowledgedAt?: string;
  /** Who's on their way: the staff member's name. */
  acknowledgedBy?: string;
  /** ISO: when staff dealt with it (POST /admin/service-requests/:id/resolve); it's no longer pending. */
  resolvedAt?: string;
  /** Who dealt with it: the staff member's name. */
  resolvedBy?: string;
}

export interface WaiterRequest extends BaseRequest {
  kind: 'waiter';
  reason: WaiterReason;
  note?: string;
}

export interface BillRequest extends BaseRequest {
  kind: 'bill';
  scope: BillScope;
  /** Balance due when the bill was requested (worked out by the server), in major units. */
  balance: number;
}

export type ServiceRequest = WaiterRequest | BillRequest;

/** Why the kitchen messages the waiters about an order. */
export type KitchenReason = 'runningLate' | 'unavailable' | 'question';

/**
 * The kitchen telling the waiters about an order (POST /admin/branches/:branchId/orders/:id/
 * messages): staff only, dealt with like a guest's call (On my way, Done).
 */
export interface KitchenMessage extends Omit<BaseRequest, 'table' | 'sessionId'> {
  kind: 'kitchen';
  reason: KitchenReason;
  /** The order it's about ("UDY-012"), and how it's served (where to find it). */
  orderId: string;
  mode: OrderMode;
  /** The order's table; none for takeaway and delivery. */
  table?: number;
  note?: string;
  /** Who in the kitchen sent it. */
  sentBy?: string;
}
