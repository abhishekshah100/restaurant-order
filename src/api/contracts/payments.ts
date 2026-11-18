import type { PaymentPurposeCode, PaymentRequestStatus } from '@/config/masters';
import type { PaymentMethodId } from '@/types/branch';
import type { Price } from '@/types/menu';
import type { Order } from '@/types/order';
import type { FulfilmentRequest, OrderLineRequest } from './orders';

/* ---------- Payments ---------- */

/** A new order, the guest's bill, a round on a running order, or the difference after a change. */
export type PaymentPurpose = PaymentPurposeCode;

export type PaymentStatus = PaymentRequestStatus;

/**
 * `POST /payments` — open an online payment request with the payment partner. The server
 * works out the amount itself: for an order, from the lines and fulfilment (as POST /orders
 * would price them, delivery fee included); for a bill, from what is still due on the listed
 * orders that are this session's and unpaid; for a round (`perRound` branches), the round's
 * share of the re-priced tab; for a change, the new total less what was paid. 201 → the pending
 * payment, open until `expiresAt`. Errors: 404 session_not_found / not_found, 409
 * nothing_to_pay, 409 mode_unavailable, 409 window_closed, 422 empty_order, 422 below_minimum,
 * 422 area_not_served, 422 pickup_unavailable, and a `promoCode`'s errors (POST /promos/validate).
 * Rounds and changes are priced with the order's own code and the offers on now.
 */
export type CreatePaymentRequest =
  | {
      purpose: 'order';
      sessionId: string;
      method: PaymentMethodId;
      lines: OrderLineRequest[];
      fulfilment: FulfilmentRequest;
      /** As on POST /orders: the amount includes its discount. */
      promoCode?: string;
    }
  | { purpose: 'bill'; sessionId: string; method: PaymentMethodId; orderIds: string[] }
  | {
      purpose: 'round';
      sessionId: string;
      method: PaymentMethodId;
      orderId: string;
      lines: OrderLineRequest[];
    }
  | {
      purpose: 'change';
      sessionId: string;
      method: PaymentMethodId;
      orderId: string;
      round: number;
      lines: OrderLineRequest[];
    };

export interface Payment {
  id: string;
  purpose: PaymentPurpose;
  sessionId: string;
  method: PaymentMethodId;
  amount: Price;
  status: PaymentStatus;
  createdAt: number;
  expiresAt: number;
  /** Bill: the orders it pays. Order, round, change: the order it went on, once used. */
  orderIds: string[];
  /** Round, change: the order it's for. */
  orderId?: string;
  /** The partner's reference, once succeeded. */
  transactionRef?: string;
}

/**
 * `POST /payments/:id/simulate` — MOCK ONLY: stands in for the payment partner's result (the
 * prototype's "success" / "failure" links). With a real backend the partner's webhook settles
 * the payment and the app polls `GET /payments/:id` instead. A succeeded bill payment marks
 * its orders paid (only those still unpaid) and settles the session's pending "Just my
 * orders" bill request. 200 → the payment and the orders it paid. Errors: 404 not_found,
 * 409 payment_conflict (not pending, or expired).
 */
export interface SimulatePaymentRequest {
  outcome: 'succeeded' | 'failed';
}

export interface SettledPaymentResponse {
  payment: Payment;
  /** Bill payments: the orders now marked paid (empty if all were paid meanwhile). */
  orders: Order[];
}
