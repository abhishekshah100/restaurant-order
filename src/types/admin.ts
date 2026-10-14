import type { BranchImage, BranchStatus, CountryCode, OrderMode } from './branch';
import type { Price } from './menu';
import type { OrderStatus, PaymentStatus } from './order';
import type { ServiceRequest } from './service';

/** The signed-in staff member, as `POST /admin/sessions` returns them. */
export interface AdminProfile {
  name: string;
  email: string;
  /** International form, e.g. "+919876543210". */
  phone: string;
}

/** A staff sign-in: the bearer token for admin requests and when it stops working. */
export interface AdminSession {
  token: string;
  admin: AdminProfile;
  /** Epoch ms; after this the admin signs in again. */
  expiresAt: number;
}

/**
 * A branch this admin manages, as `GET /admin/branches` returns it: what the branch picker
 * shows, not the guest-facing region rules (those stay on `GET /branches`).
 */
export interface AdminBranch {
  id: string;
  name: string;
  /** "Indiranagar", "Thamel". */
  shortName: string;
  city: string;
  country: CountryCode;
  address: string;
  status: BranchStatus;
  /** Today's opening hours as shown, in the branch's local time: "11:00 AM – 10:00 PM". */
  hoursToday: string;
  /** IANA time zone, for the branch's current local time ("Now 7:45 PM"). */
  timezone: string;
  /** BCP 47 locale the branch writes times in. */
  locale: string;
  tables: { first: number; last: number };
  /** The order modes the branch takes, always in this order: dineIn, takeaway, delivery. */
  modes: OrderMode[];
  /** ISO 4217, e.g. "INR", "NPR". */
  currencyCode: string;
  image?: BranchImage;
}

/* ---------- Floor service (GET /admin/branches/:branchId/service) ---------- */

/** An open waiter call or bill request at one of the branch's tables, as staff see it. */
export type AdminServiceRequest = ServiceRequest;

/** A round of an order the kitchen has ready that nobody has served (or handed over) yet. */
export interface AdminReadyRound {
  /** The round's number (1 for an order of one round). */
  round: number;
  /** Items in the round, counted by quantity. */
  itemCount: number;
  /** ISO: when it was ready. */
  readyAt: string;
}

/** One of today's orders, as the floor staff need it. */
export interface AdminOrderSummary {
  id: string;
  mode: OrderMode;
  /** Dine-in only. Takeaway and delivery orders show as "Pickup" / "Delivery". */
  table?: number;
  customerName: string;
  /** ISO. */
  placedAt: string;
  status: OrderStatus;
  /** Items on the order (every round not cancelled), counted by quantity. */
  itemCount: number;
  total: Price;
  /** Still to pay: 0 once paid. */
  due: Price;
  paymentStatus: PaymentStatus;
  /** Rounds waiting to be served, oldest first (empty when none). */
  readyRounds: AdminReadyRound[];
}

/**
 * Where a table is in its visit, most urgent first: a guest called a waiter, asked for the
 * bill, is waiting for food (ordering), is eating (everything served, bill open), or has paid
 * and is about to leave (closing).
 */
export type AdminTableStatus = 'needsWaiter' | 'wantsBill' | 'ordering' | 'eating' | 'closing';

/** A table with activity today (an order or an open request). */
export interface AdminTableState {
  table: number;
  status: AdminTableStatus;
  /** Today's orders at the table, not cancelled. */
  orderCount: number;
  /** Still to pay across them. */
  due: Price;
  /** ISO: the latest order or request. */
  lastActivityAt: string;
}

/** What needs doing on the floor, counted. */
export interface AdminServiceCounts {
  /** Open waiter calls. */
  waiterCalls: number;
  /** Open bill requests. */
  billRequests: number;
  /** Rounds ready to serve or hand over. */
  readyToServe: number;
  /** Today's orders not yet paid in full. */
  unpaid: number;
}

/** What needs doing on a branch's floor now (GET /admin/branches/:branchId/service). */
export interface AdminBranchService {
  /** Open waiter calls and bill requests, oldest first. */
  requests: AdminServiceRequest[];
  /** Today's orders still active or not paid in full, newest first. */
  orders: AdminOrderSummary[];
  /** By table number. */
  tables: AdminTableState[];
  counts: AdminServiceCounts;
  /** ISO: when the server read it. */
  generatedAt: string;
}
