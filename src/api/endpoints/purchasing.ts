import type {
  OrderInput,
  PriceChangesResponse,
  PurchaseOrder,
  PurchaseOrdersResponse,
  PurchaseReturn,
  PurchasingSettings,
  Receipt,
  ReceiptInput,
  ReceiptsResponse,
  ReturnInput,
  ReturnsResponse,
  Supplier,
  SupplierInput,
  SupplierItemInput,
  SuppliersResponse,
} from '@/types/purchasing';
import { apiDelete, apiGet, apiPatch, apiPost, backendBlob } from '../client';
import type { PaymentProofRequest, PaymentProofResponse } from '../contracts';
import { bearer, purchasing, searchOf, seg } from './shared';

/** Purchasing: suppliers, orders, deliveries, returns. */
export const purchasingApi = {
  suppliers: (token: string, branchId: string) =>
    apiGet<SuppliersResponse>(`${purchasing(branchId)}/suppliers`, bearer(token)),
  createSupplier: (token: string, branchId: string, body: SupplierInput) =>
    apiPost<Supplier>(`${purchasing(branchId)}/suppliers`, body, bearer(token)),
  updateSupplier: (token: string, branchId: string, id: string, body: Partial<SupplierInput>) =>
    apiPatch<Supplier>(`${purchasing(branchId)}/suppliers/${seg(id)}`, body, bearer(token)),
  archiveSupplier: (token: string, branchId: string, id: string) =>
    apiDelete(`${purchasing(branchId)}/suppliers/${seg(id)}`, bearer(token)),
  setSupplierItems: (token: string, branchId: string, id: string, items: SupplierItemInput[]) =>
    apiPatch<Supplier>(
      `${purchasing(branchId)}/suppliers/${seg(id)}/items`,
      { items },
      bearer(token),
    ),
  purchaseOrders: (
    token: string,
    branchId: string,
    query: { status?: string; supplier?: string },
  ) =>
    apiGet<PurchaseOrdersResponse>(
      `${purchasing(branchId)}/orders${searchOf(query)}`,
      bearer(token),
    ),
  purchaseOrder: (token: string, branchId: string, id: string) =>
    apiGet<PurchaseOrder>(`${purchasing(branchId)}/orders/${seg(id)}`, bearer(token)),
  createPurchaseOrder: (token: string, branchId: string, body: OrderInput) =>
    apiPost<PurchaseOrder>(`${purchasing(branchId)}/orders`, body, bearer(token)),
  updatePurchaseOrder: (
    token: string,
    branchId: string,
    id: string,
    body: Omit<OrderInput, 'supplierId'>,
  ) => apiPatch<PurchaseOrder>(`${purchasing(branchId)}/orders/${seg(id)}`, body, bearer(token)),
  purchaseOrderStep: (
    token: string,
    branchId: string,
    id: string,
    step: 'approve' | 'send' | 'cancel' | 'close',
  ) =>
    apiPost<PurchaseOrder>(`${purchasing(branchId)}/orders/${seg(id)}/${step}`, {}, bearer(token)),
  setPurchasingSettings: (token: string, branchId: string, body: Partial<PurchasingSettings>) =>
    apiPatch<PurchasingSettings>(`${purchasing(branchId)}/settings`, body, bearer(token)),
  receipts: (token: string, branchId: string, range: { from?: string; to?: string }) =>
    apiGet<ReceiptsResponse>(`${purchasing(branchId)}/receipts${searchOf(range)}`, bearer(token)),
  receipt: (token: string, branchId: string, id: string) =>
    apiGet<Receipt>(`${purchasing(branchId)}/receipts/${seg(id)}`, bearer(token)),
  receive: (token: string, branchId: string, body: ReceiptInput) =>
    apiPost<Receipt>(`${purchasing(branchId)}/receipts`, body, bearer(token)),
  confirmPrices: (
    token: string,
    branchId: string,
    id: string,
    lines: { lineId: string; price: number }[],
  ) =>
    apiPost<Receipt>(
      `${purchasing(branchId)}/receipts/${seg(id)}/prices`,
      { lines },
      bearer(token),
    ),
  priceChanges: (token: string, branchId: string) =>
    apiGet<PriceChangesResponse>(`${purchasing(branchId)}/price-changes`, bearer(token)),
  purchaseReturns: (token: string, branchId: string, range: { from?: string; to?: string }) =>
    apiGet<ReturnsResponse>(`${purchasing(branchId)}/returns${searchOf(range)}`, bearer(token)),
  createPurchaseReturn: (token: string, branchId: string, body: ReturnInput) =>
    apiPost<PurchaseReturn>(`${purchasing(branchId)}/returns`, body, bearer(token)),
  uploadPurchaseProof: (token: string, branchId: string, body: PaymentProofRequest) =>
    apiPost<PaymentProofResponse>(`${purchasing(branchId)}/proofs`, body, bearer(token)),
  /** An invoice photo's bytes (private). Backend only. */
  purchaseProof: (token: string, branchId: string, key: string) =>
    backendBlob(`${purchasing(branchId)}/proofs/${seg(key)}`, bearer(token)),
};
