import { apiDelete, apiGet, apiPatch, apiPost, backendBlob } from '../client';
import type {
  PaymentProofRequest,
  PaymentProofResponse,
  PaymentHistoryResponse,
  PaymentHistoryQuery,
  OrderResponse,
  DiscountRequest,
  InvoiceDetail,
  InvoicesResponse,
} from '../contracts';
import { bearer, searchOf, seg } from './shared';

/** Bills and invoices: buyers, discounts, prints, the sales register, payment proofs and history. */
export const billingApi = {
  /** PATCH …/orders/:id/buyer: a business customer's details for the order's invoice (backend only). */
  setOrderBuyer: (
    token: string,
    branchId: string,
    orderId: string,
    body: { name: string; taxId?: string; address?: string },
  ) =>
    apiPatch<{ buyer: { name: string; taxId?: string; address?: string } }>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/buyer`,
      body,
      bearer(token),
    ),
  clearOrderBuyer: (token: string, branchId: string, orderId: string) =>
    apiDelete(`admin/branches/${seg(branchId)}/orders/${seg(orderId)}/buyer`, bearer(token)),
  /** POST …/orders/:id/discounts: money off the bill or an item by hand (backend only). */
  giveDiscount: (token: string, branchId: string, orderId: string, body: DiscountRequest) =>
    apiPost<OrderResponse>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/discounts`,
      body,
      bearer(token),
    ),
  /** DELETE …/orders/:id/discounts/:discountId: a manual discount taken off. */
  removeDiscount: (token: string, branchId: string, orderId: string, discountId: string) =>
    apiDelete(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/discounts/${seg(discountId)}`,
      bearer(token),
    ),
  /** POST …/invoices/:id/prints: printed or downloaded now; which copy it is (0: the original). */
  invoicePrinted: (
    token: string,
    branchId: string,
    invoiceId: string,
    channel: 'print' | 'download',
  ) =>
    apiPost<{ copy: number }>(
      `admin/branches/${seg(branchId)}/invoices/${seg(invoiceId)}/prints`,
      { channel },
      bearer(token),
    ),
  /** GET …/invoices: the invoices and credit notes issued on these days (backend only). */
  invoices: (
    token: string,
    branchId: string,
    query: { from: string; to: string; kind?: 'invoice' | 'creditNote' },
  ) =>
    apiGet<InvoicesResponse>(
      `admin/branches/${seg(branchId)}/invoices${searchOf(query)}`,
      bearer(token),
    ),
  /** GET …/invoices/:id: one in full, as issued. */
  invoice: (token: string, branchId: string, invoiceId: string) =>
    apiGet<InvoiceDetail>(
      `admin/branches/${seg(branchId)}/invoices/${seg(invoiceId)}`,
      bearer(token),
    ),
  /** The sales register (every invoice and credit note) as CSV bytes (backend only). */
  salesRegister: (token: string, branchId: string, range: { from: string; to: string }) =>
    backendBlob(
      `admin/branches/${seg(branchId)}/invoices/register.csv${searchOf(range)}`,
      bearer(token),
    ),
  refundReceived: (token: string, branchId: string, orderId: string, seq: number) =>
    apiPost<OrderResponse>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/refunds/${seq}/received`,
      {},
      bearer(token),
    ),
  uploadPaymentProof: (token: string, branchId: string, body: PaymentProofRequest) =>
    apiPost<PaymentProofResponse>(
      `admin/branches/${seg(branchId)}/payment-proofs`,
      body,
      bearer(token),
    ),
  /** A proof photo's bytes (private: the admin's token). Backend only. */
  paymentProof: (token: string, branchId: string, key: string) =>
    backendBlob(`admin/branches/${seg(branchId)}/payment-proofs/${seg(key)}`, bearer(token)),
  paymentHistory: (token: string, branchId: string, query: PaymentHistoryQuery) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '' && value !== 'all') search.set(key, String(value));
    }
    return apiGet<PaymentHistoryResponse>(
      `admin/branches/${seg(branchId)}/payments/history?${search.toString()}`,
      bearer(token),
    );
  },
};
