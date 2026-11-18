import type { AdminServiceRequest, CancelReason } from '@/types/admin';
import type { OrderMode } from '@/types/branch';
import type { OrderStatus, PaymentStatus as OrderPaymentStatus } from '@/types/order';

/* ---------- Order, payment and request history ---------- */

/** One payment or refund in Payments › History. */
export interface HistoryTransaction {
  /** "UDY-030-T2". */
  id: string;
  /** The order's code. */
  orderId: string;
  mode: OrderMode;
  table?: number;
  customerName: string;
  kind: 'payment' | 'refund';
  method: string;
  channel: 'online' | 'inPerson';
  amount: number;
  tip?: number;
  waived?: number;
  waiveReason?: string;
  by?: string;
  transactionRef?: string;
  reason?: string;
  /** What staff wrote with it ("Cold naan"). */
  note?: string;
  status?: 'started' | 'done';
  /** ISO. */
  at: string;
}

/**
 * `GET /admin/branches/:branchId/payments/history?from=&to=&kind=&channel=&method=&q=&cursor=&limit=`
 * (`payments.collect` or `reports.view`) — Payments › History: the days' sums (up to a year at a
 * time, back two years; the last 7 days without any; each payment on the day it was taken),
 * worked out on the server, and a page of the transactions (newest first; `next` for more).
 */
export interface PaymentHistoryResponse {
  from: string;
  to: string;
  summary: {
    collected: number;
    refunds: number;
    refundsPending: number;
    net: number;
    tips: number;
    waived: number;
    payments: number;
    refundCount: number;
    online: number;
    inPerson: number;
    /** Cash taken (with tips) less cash refunds (not the drawer: no float, no paid in or out). */
    cashTaken: number;
    byMethod: {
      method: string;
      channel: 'online' | 'inPerson';
      count: number;
      amount: number;
      refunds: number;
      tips: number;
    }[];
  };
  transactions: HistoryTransaction[];
  matching: number;
  next?: string;
}

export interface PaymentHistoryQuery {
  from: string;
  to: string;
  kind?: 'all' | 'payments' | 'refunds';
  channel?: 'all' | 'online' | 'inPerson';
  method?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

/** One order in Orders › History: what its row shows (opening it reads the whole order). */
export interface HistoryOrder {
  /** The order's code ("BLR-031"). */
  id: string;
  /** The day's token ("#12"), when it has one. */
  token?: number;
  mode: OrderMode;
  table?: number;
  customerName: string;
  status: OrderStatus;
  cancelReason?: CancelReason;
  cancelledBy?: 'guest' | 'restaurant';
  /** Items made (rounds taken back and items the kitchen couldn't make left out). */
  items: number;
  total: number;
  paymentStatus: OrderPaymentStatus;
  /** Still to pay (0 once paid or cancelled). */
  due: number;
  /** The payment method the guest chose. */
  method: string;
  /** The staff member who took it at the table; none when the guest ordered on their phone. */
  takenBy?: string;
  /** ISO. */
  placedAt: string;
}

export type OrderHistoryStatus = 'all' | 'completed' | 'unpaid' | 'cancelled';

/**
 * `GET /admin/branches/:branchId/orders/history?from=&to=&status=&mode=&q=&cursor=&limit=`
 * (READERS.orders) — Orders › History: the days' sums (up to a year at a time, back two years;
 * the last 7 days without any; each order on the day it was placed), worked out on the server,
 * and a page of the orders (newest first, 30 at a time; `next` for more). The filters narrow the
 * list, never the sums.
 */
export interface OrderHistoryResponse {
  from: string;
  to: string;
  summary: {
    orders: number;
    completed: number;
    cancelled: number;
    /** Not handed over and not cancelled. */
    inProgress: number;
    /** Billed on the orders not cancelled. */
    sales: number;
    averageBill: number;
    unpaidOrders: number;
    /** Still to collect on those days' orders. */
    unpaid: number;
    byMode: { mode: OrderMode; orders: number; sales: number }[];
  };
  orders: HistoryOrder[];
  matching: number;
  next?: string;
}

export interface OrderHistoryQuery {
  from: string;
  to: string;
  status?: OrderHistoryStatus;
  mode?: 'all' | OrderMode;
  q?: string;
  cursor?: string;
  limit?: number;
}

/** What became of a request: dealt with, never answered (it lapsed after 30 minutes), or open. */
export type RequestOutcome = 'resolved' | 'lapsed' | 'open';

export type HistoryServiceRequest = AdminServiceRequest & {
  outcome: RequestOutcome;
  /** Minutes from the request to the first answer (on the way, or done); none unanswered. */
  answeredInMinutes?: number;
};

/**
 * `GET /admin/branches/:branchId/service-requests/history?from=&to=&kind=` (whoever sees the
 * service board) — Requests › History: the requests made on those days (the branch's calendar
 * days, up to 31 at a time, back a year; today without any), newest first, with who answered and
 * how fast, and a summary. One a guest took back isn't kept. Mock: every request this device
 * kept, by day.
 */
export interface RequestHistoryResponse {
  from: string;
  to: string;
  requests: HistoryServiceRequest[];
  summary: {
    total: number;
    resolved: number;
    lapsed: number;
    /** Average minutes to the first answer; null when none was answered. */
    averageAnswerMinutes: number | null;
  };
}
