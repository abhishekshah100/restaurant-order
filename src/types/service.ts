export type ServiceKind = 'waiter' | 'bill';

export type WaiterReason = 'waiter' | 'water' | 'cutlery' | 'other';

/** Which orders the guest wants on the bill. */
export type BillScope = 'mine' | 'table';

interface BaseRequest {
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
  /** Balance due when the bill was requested, in rupees. */
  balance: number;
}

export type ServiceRequest = WaiterRequest | BillRequest;

/** How a guest pays their own outstanding bill in the app (/help/bill/pay). */
export type BillPaymentMethod = 'upi' | 'card';
