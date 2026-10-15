import type { BranchImage, BranchStatus, CountryCode, OrderMode } from './branch';
import type { Price } from './menu';
import type { Order, OrderStatus, PaymentStatus } from './order';
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
  /** Open waiter calls and bill requests (some with someone on the way), oldest first. */
  requests: AdminServiceRequest[];
  /** Requests dealt with in the last 30 minutes, newest first, with who dealt with them. */
  doneRequests: AdminServiceRequest[];
  /** Today's orders still active or not paid in full, newest first. */
  orders: AdminOrderSummary[];
  /** By table number. */
  tables: AdminTableState[];
  counts: AdminServiceCounts;
  /** ISO: when the server read it. */
  generatedAt: string;
}

/* ---------- Floor plan (GET /admin/branches/:branchId/tables) ---------- */

/** A table as the branch has laid it out: its number and how many it seats. */
export interface FloorTableLayout {
  number: number;
  seats: number;
}

/** One area of the branch: "Ground floor", "First floor", "Outdoor". */
export interface FloorLayout {
  id: string;
  name: string;
  tables: FloorTableLayout[];
}

/**
 * GET /branches/:id/floors: the branch's areas and tables, in the order staff walk them. The
 * mock server's seed for the floor plan (the dummy JSON at branches/<id>/floors.json).
 */
export interface FloorPlanLayout {
  floors: FloorLayout[];
}

/**
 * Where a table is now: free, or taken and why it needs a person most (a waiter call, then a
 * bill request, then food on the way, then eating). A table is free again once every order at
 * it today is served and paid.
 */
export type FloorTableStatus = 'available' | Exclude<AdminTableStatus, 'closing'>;

/** One table on the floor plan, with what's happening at it. */
export interface AdminFloorTable {
  table: number;
  seats: number;
  status: FloorTableStatus;
  /** Today's open orders at the table: not cancelled, and not both served and paid. */
  orderCount: number;
  /** Still to pay across them. */
  due: Price;
  /** ISO: the first of those orders (how long the guests have been seated). */
  seatedAt?: string;
}

export interface AdminFloor {
  id: string;
  name: string;
  tables: AdminFloorTable[];
}

/** GET /admin/branches/:branchId/tables: every area with its tables, as now. */
export interface AdminFloorPlan {
  floors: AdminFloor[];
  /** ISO: when the server read it. */
  generatedAt: string;
}

/** GET /admin/branches/:branchId/tables/:table: one table, its open orders and requests. */
export interface AdminTableDetail extends AdminFloorTable {
  floor: Pick<AdminFloor, 'id' | 'name'>;
  /** The open orders in full (items, payment, timeline), newest first. */
  orders: Order[];
  /** Open waiter calls and bill requests at the table, oldest first. */
  requests: AdminServiceRequest[];
  /** ISO: when the server read it. */
  generatedAt: string;
}

/* ---------- Orders (GET /admin/branches/:branchId/orders) ---------- */

/** Today's orders at a branch (its time zone) in full, every mode and state, newest first. */
export interface AdminOrders {
  orders: Order[];
  /** ISO: when the server read it. */
  generatedAt: string;
}

/** Why the restaurant cancelled an order. */
export type CancelReason = 'outOfStock' | 'guestLeft' | 'kitchenIssue' | 'duplicate' | 'other';
