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
