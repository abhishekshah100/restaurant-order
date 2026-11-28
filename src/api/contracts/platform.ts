/*
 * The platform console (restaurant-backend › /v1/platform, ADR-051): the application owner's
 * packages and every client's package, limits, features, trial, term, price and contact. Every
 * request carries the platform key (`X-Platform-Key`), never a staff token; every change names
 * who made it (`by`).
 */

/**
 * The built-in features: the ones the code enforces (restaurant-backend › auth › features.ts). The
 * catalog (GET /platform/features) has these and any the platform adds (on-site training…).
 */
export type PlanFeature =
  | 'ordering'
  | 'takeaway'
  | 'reports'
  | 'delivery'
  | 'reservations'
  | 'offers'
  | 'inventory'
  | 'shifts'
  | 'activityLog';

/** What a package limits; null: unlimited. Floors, tables and dishes count per branch. */
export type PlanLimit = 'staff' | 'branches' | 'floors' | 'tables' | 'dishes' | 'reportDays';
export type PlanLimits = Record<PlanLimit, number | null>;

export type BillingCycle = 'yearly' | 'halfYearly';
export type PlanStatus = 'trial' | 'active' | 'grace' | 'expired' | 'suspended';

/** GET /platform/plans: a package (prices in whole rupees; null: on request). */
export interface PackagePlan {
  code: string;
  name: string;
  position: number;
  prices: { yearly: number | null; halfYearly: number | null; extraBranch: number | null };
  limits: PlanLimits;
  /** Keys of the feature catalog. */
  features: string[];
  /** Retired: not offered for new clients or picks; clients on it keep it. */
  hidden: boolean;
}

export type FeatureGroup = 'essentials' | 'advanced' | 'services';

/** GET /platform/features: the catalog, in the platform's order. */
export interface FeatureInfo {
  key: string;
  name: string;
  description: string;
  group: FeatureGroup;
  /** Enforced by the code: can be renamed, not removed. */
  builtIn: boolean;
  /** Packages, clients and add-ons that have it. */
  used: number;
}

/** GET /platform/addons: what a client can have on top of its package, priced per term. */
export interface AddonInfo {
  code: string;
  name: string;
  description: string;
  prices: { yearly: number | null; halfYearly: number | null };
  /** The limit it raises, by `amount` each. */
  limit: { key: PlanLimit; amount: number } | null;
  /** The feature it switches on. */
  feature: string | null;
  hidden: boolean;
}

/** An add-on a client has (ClientDetail › addons). */
export interface ClientAddon {
  id: string;
  code: string | null;
  name: string;
  quantity: number;
  prices: { yearly: number | null; halfYearly: number | null };
  limit: { key: PlanLimit; amount: number } | null;
  feature: string | null;
  by: string;
  at: string;
}

/** POST /platform/addons, PATCH /platform/addons/:code */
export interface AddonRequest {
  by: string;
  name?: string;
  description?: string;
  yearlyPrice?: number | null;
  halfYearlyPrice?: number | null;
  limit?: { key: PlanLimit; amount: number } | null;
  feature?: string | null;
  hidden?: boolean;
}

/** What a client has now: floors, tables and dishes at its fullest branch. */
export interface ClientUsage {
  staff: number;
  branches: number;
  floors: number;
  tables: number;
  dishes: number;
}

/** One of a client's branches, with what it has. */
export interface ClientBranch {
  id: string;
  /** Its own name ("Rooftop Cafe"), set in its Settings › Restaurant info. */
  name: string;
  city: string;
  /** When it was added (ISO). */
  createdAt: string;
  tables: number;
  /** Dishes on its menu (0: an empty menu, to load on the Dev setup tab). */
  dishes: number;
  /** Its own staff logins (the restaurant's owners count once, across its branches). */
  staff: number;
  /** Orders it has taken, ever. */
  orders: number;
}

/** GET /platform/clients: one client in the list. */
export interface ClientSummary {
  id: string;
  name: string;
  createdAt: string;
  /** Its live branches, oldest first. */
  branches: ClientBranch[];
  plan: { code: string; name: string };
  billingCycle: BillingCycle;
  status: PlanStatus;
  /** When the trial or paid term ends (null: no end). */
  endsAt: string | null;
  /** When management locks: the end plus grace. */
  lockAt: string | null;
  daysLeft: number | null;
  limits: PlanLimits;
  usage: ClientUsage;
  features: string[];
  /** What the client pays per term (their own price, or the package's). */
  price: number | null;
  listPrice: number | null;
  /** When the platform last sent a renewal reminder (null: never). */
  remindedAt: string | null;
  /** Whom to remind ('' where none is set). */
  contactName: string;
  contactPhone: string;
  /** Made on the Dev setup tab and not gone live: Dev setup can still reset or delete it. */
  demo: boolean;
}

/** One change in a client's history. */
export interface PlanHistoryEntry {
  at: string;
  by: string;
  /** 'plan.changed' | 'plan.suspended' | 'plan.resumed' */
  action: string;
  reason: string | null;
  changes: { field: string; from: unknown; to: unknown }[];
  /** A payment recorded or removed: how much and how. */
  payment?: { amount: number; method: string };
}

export type ClientPaymentMethod = 'esewa' | 'khalti' | 'fonepay' | 'bank' | 'cash' | 'other';

/** A payment the client made to the platform, recorded on the console. */
export interface ClientPayment {
  id: string;
  /** The receipt's number (RCPT-00012). */
  number: number;
  /** Whole rupees. */
  amount: number;
  method: ClientPaymentMethod;
  paidOn: string;
  /** The term it paid for, when it extended the plan. */
  period: { from: string; to: string } | null;
  note: string;
  by: string;
  hasReceipt: boolean;
}

/** POST /platform/clients/:id/payments */
export interface RecordPaymentRequest {
  by: string;
  amount: number;
  method: ClientPaymentMethod;
  paidOn: string;
  /** Extend the paid term by one billing cycle (from its end, or the day paid if it ended). */
  extend: boolean;
  note?: string;
  /** The receipt photo as a data URL (prepareImage 'proof'). */
  receipt?: string;
}

/** GET /platform/payments */
export interface PaymentsOverview {
  thisMonth: number;
  last12Months: number;
  recent: (ClientPayment & { client: { id: string; name: string } })[];
}

/** GET /platform/clients/:id */
export interface ClientDetail extends ClientSummary {
  trialEndsAt: string | null;
  startsAt: string | null;
  /** The paid term's end. */
  paidUntil: string | null;
  graceDays: number;
  suspendedAt: string | null;
  suspendReason: string | null;
  customPrice: number | null;
  priceNote: string;
  contact: { name: string; phone: string; email: string; taxNumber: string };
  notes: string;
  history: PlanHistoryEntry[];
  /** Newest first. */
  payments: ClientPayment[];
  /** What it has on top of its package, oldest first. */
  addons: ClientAddon[];
}

/**
 * PATCH /platform/clients/:id: only what changes. A new `plan` brings its limits and features
 * unless they're sent too. Dates are ISO with an offset; null clears them.
 */
export interface UpdateClientRequest {
  by: string;
  plan?: string;
  billingCycle?: BillingCycle;
  limits?: Partial<PlanLimits>;
  features?: string[];
  trialEndsAt?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  graceDays?: number;
  price?: number | null;
  priceNote?: string;
  contact?: Partial<ClientDetail['contact']>;
  notes?: string;
}

/** PATCH /platform/plans/:code: a package's defaults (clients on it keep their own). */
export interface UpdatePackageRequest {
  by: string;
  name?: string;
  yearlyPrice?: number | null;
  halfYearlyPrice?: number | null;
  extraBranchPrice?: number | null;
  limits?: Partial<PlanLimits>;
  features?: string[];
  hidden?: boolean;
}

/** GET / PATCH /platform/settings */
export interface PlatformSettings {
  trialDays: number;
  trialPlan: string;
  supportPhone: string;
  supportWhatsapp: string;
  supportEmail: string;
  /** Who receipts come from: the business, its address, its PAN / VAT number. */
  businessName: string;
  businessAddress: string;
  businessTaxId: string;
  /** The line at the foot of every receipt. */
  receiptNote: string;
}

/** POST /platform/clients: a new, live client with its first branch and owner. */
export interface NewClientRequest {
  by: string;
  name: string;
  branch: { city: string; address: string; country: 'NP' | 'IN'; phone?: string };
  owner: { name: string; phone: string; email?: string; password?: string };
  tables: number;
  plan: string;
  /** On the package's free trial, or paid for a year from today. */
  trial: boolean;
}

/** The client made, and its owner's sign-in (the password shown once). */
export interface NewClientResult {
  client: ClientDetail;
  branchId: string;
  owner: { name: string; email: string; phone: string; password: string };
}

export type UpdatePlatformSettingsRequest = { by: string } & Partial<PlatformSettings>;
