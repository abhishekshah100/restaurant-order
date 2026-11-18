/* ---------- Tax invoices and credit notes (Payments › Invoices; the server's only) ---------- */

/** One row of GET /admin/branches/:branchId/invoices (money in major units). */
export interface InvoiceRow {
  id: string;
  kind: 'invoice' | 'creditNote';
  number: string;
  fiscalYear: string;
  issuedAt: string;
  date: { ad: string; bs?: string };
  order: string;
  buyer: { name: string; taxId?: string };
  taxable: number;
  tax: number;
  total: number;
  /** A credit note's invoice; an invoice's credit notes. */
  invoice?: string;
  creditNotes?: string[];
  /** An invoice not wholly credited back (credit notes: always). */
  active: boolean;
  /** How many times printed or downloaded (0: never). */
  prints: number;
  synced: boolean;
}

export interface InvoicesResponse {
  from: string;
  to: string;
  invoices: InvoiceRow[];
}

/** A bill line as issued: the service charge or a tax (with its CGST/SGST parts). */
export interface InvoiceChargeLine {
  id: string;
  labelKey: string;
  vars: { rate: string };
  amount: number;
  parts?: InvoiceChargeLine[];
}

/** The document as issued (major units): what a printed invoice or credit note says. */
export interface InvoiceDocument {
  kind: 'invoice' | 'creditNote';
  titleKey: string;
  number: string;
  fiscalYear: string;
  issuedAt: string;
  date: { ad: string; bs?: string };
  seller: {
    name: string;
    branch?: string;
    address: string;
    phone: string;
    taxId?: string;
    taxIdKey: 'gstin' | 'pan' | 'taxId';
    country: string;
    sacCode?: string;
    fssai?: string;
  };
  placeOfSupply?: { code: string; name: string };
  buyer: { name: string; taxId?: string; address?: string; business?: true };
  order: { code: string; mode: string; table?: number };
  currency: { code: string; minorUnit: number };
  lines?: { name: string; variant?: string; quantity: number; unitPrice: number; amount: number }[];
  itemTotal?: number;
  discounts?: { name?: string; labelKey?: string; amount: number }[];
  deliveryFee?: number;
  charges: { lines: InvoiceChargeLine[]; roundOff: number };
  waived?: number;
  refunded?: number;
  taxable: number;
  tax: number;
  total: number;
  creditNote?: { invoiceNumber: string; invoiceDate: string; reason: string };
}

/** GET /admin/branches/:branchId/invoices/:invoiceId: one in full, with its prints. */
export interface InvoiceDetail extends InvoiceRow {
  document: InvoiceDocument;
  printLog: { copy: number; at: string; by: string }[];
}
