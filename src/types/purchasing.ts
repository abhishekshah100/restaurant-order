import type { InventoryUnit } from './inventory';

/*
 * Purchasing (backend only; restaurant-backend › src/modules/purchasing/purchasing.types.ts).
 * Numbers are numbers (the app writes PO-0001), money in major units before tax, quantities in
 * packs. Prices only for staff who buy, approve, manage stock or see reports.
 */

export type PoStatus =
  'draft' | 'approved' | 'sent' | 'partly_received' | 'received' | 'cancelled' | 'closed';
export type ReturnReason = 'damaged' | 'wrong_item' | 'expired' | 'excess' | 'other';

export interface PackView {
  name: string;
  size: number;
  unit: InventoryUnit;
}

export interface SupplierItemView {
  ingredientId: string;
  name: string;
  pack: PackView;
  price?: number;
  supplierCode?: string;
  preferred: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  paymentTermsDays?: number;
  notes?: string;
  items: SupplierItemView[];
  openOrders: number;
}

export interface SuppliersResponse {
  suppliers: Supplier[];
}

export interface OrderLineView {
  id: string;
  ingredientId: string;
  name: string;
  pack: PackView;
  quantity: number;
  received: number;
  price?: number;
  taxRate: number;
  total?: number;
}

export interface PurchaseOrder {
  id: string;
  number: number;
  supplier: { id: string; name: string; phone?: string; email?: string };
  status: PoStatus;
  expectedOn?: string;
  note?: string;
  createdAt: string;
  createdBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  sentAt?: string;
  endedAt?: string;
  total?: number;
  tax?: number;
  needsApproval: boolean;
  lines: OrderLineView[];
}

export interface PurchasingSettings {
  approvalLimit?: number;
  priceAlert: number;
}

export interface PurchaseOrdersResponse extends PurchasingSettings {
  orders: PurchaseOrder[];
}

export interface ReceiptLineView {
  id: string;
  orderLineId?: string;
  ingredientId: string;
  name: string;
  pack: PackView;
  quantity: number;
  rejected: number;
  rejectReason?: string;
  returned: number;
  price?: number;
  expectedPrice?: number;
  taxRate: number;
  flagged?: boolean;
  pricePending: boolean;
  /** Items that track expiry: the batch's last good day and the supplier's code. */
  expiresOn?: string;
  lot?: string;
}

export interface Receipt {
  id: string;
  number: number;
  supplier: { id: string; name: string };
  order?: { id: string; number: number };
  invoiceNumber?: string;
  invoiceDate?: string;
  proofKey?: string;
  note?: string;
  receivedAt: string;
  receivedBy?: string;
  total?: number;
  tax?: number;
  lines: ReceiptLineView[];
}

export interface ReceiptsResponse {
  receipts: Receipt[];
}

export interface PurchaseReturn {
  id: string;
  number: number;
  supplier: { id: string; name: string };
  receipt: { id: string; number: number };
  note?: string;
  at: string;
  by?: string;
  total?: number;
  tax?: number;
  lines: {
    receiptLineId: string;
    name: string;
    pack: PackView;
    quantity: number;
    reason: ReturnReason;
    value?: number;
  }[];
}

export interface ReturnsResponse {
  returns: PurchaseReturn[];
}

export interface PriceChange {
  receiptId: string;
  receiptNumber: number;
  receivedAt: string;
  supplier: string;
  lineId: string;
  name: string;
  pack: PackView;
  price: number;
  expectedPrice?: number;
  flagged: boolean;
  pricePending: boolean;
}

export interface PriceChangesResponse {
  changes: PriceChange[];
}

/* ---------- Requests ---------- */

/** How a line counts: one of the ingredient's packs, or a unit of its measure. */
interface PackInputs {
  packId?: string;
  unit?: InventoryUnit;
}

export interface SupplierInput {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  paymentTermsDays?: number;
  notes?: string;
}

export interface SupplierItemInput extends PackInputs {
  ingredientId: string;
  price: number;
  supplierCode?: string;
  preferred?: boolean;
}

export interface OrderLineInput extends PackInputs {
  ingredientId: string;
  quantity: number;
  price?: number;
  taxRate?: number;
}

export interface OrderInput {
  supplierId: string;
  expectedOn?: string;
  note?: string;
  lines: OrderLineInput[];
}

export interface ReceiptLineInput extends PackInputs {
  orderLineId?: string;
  ingredientId?: string;
  quantity: number;
  /** Items that track expiry: the batch's last good day, and the supplier's code. */
  expiresOn?: string;
  lot?: string;
  rejected?: number;
  rejectReason?: string;
  price?: number;
  taxRate?: number;
}

export interface ReceiptInput {
  entryId: string;
  supplierId: string;
  orderId?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  proofKey?: string;
  note?: string;
  lines: ReceiptLineInput[];
}

export interface ReturnInput {
  entryId: string;
  receiptId: string;
  note?: string;
  lines: { receiptLineId: string; quantity: number; reason: ReturnReason }[];
}
