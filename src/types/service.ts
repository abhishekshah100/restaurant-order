export type ServiceKind = 'waiter' | 'bill';

export type WaiterReason = 'waiter' | 'water' | 'cutlery' | 'other';

/** Which orders the guest wants on the bill. */
export type BillScope = 'mine' | 'table';

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
