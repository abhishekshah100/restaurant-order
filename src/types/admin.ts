import type { CancellationReason, ReservationStatusCode } from '@/config/masters';
import type { BranchImage, BranchStatus, CountryCode, OpeningSchedule, OrderMode } from './branch';
import type { Price } from './menu';
import type { Order, OrderStatus, PaymentStatus } from './order';
import type { KitchenMessage, ServiceRequest } from './service';

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
  /** ISO: when a pause ends, or a branch closed for the day opens again (back to open by itself). */
  statusUntil?: string;
  /** The week's opening hours (24-hour local "HH:MM"); the card shows today's from it. */
  schedule: OpeningSchedule;
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
/** What the floor staff answer: a guest's call or bill request, or a message from the kitchen. */
export type AdminServiceRequest = ServiceRequest | KitchenMessage;

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
  /** Messages from the kitchen about an order, still to deal with (none from the mock). */
  kitchenMessages?: number;
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
  /**
   * The backend's flag: staff freed the table (the guests left), so it's available whatever its
   * earlier orders say. Set by POST /admin/branches/:branchId/tables/:table/free; cleared by the
   * next order or request at the table.
   */
  freed: boolean;
  /**
   * Out of service (Settings › Floor plan): kept on the plan with its number, seats and QR code,
   * but guests can't order there, waiters can't take orders and it can't be booked. Missing:
   * in service.
   */
  disabled?: boolean;
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
 * Where a table is now: free; reserved (a booking starts within the hour, or its guests are a
 * little late); seated (booked guests sat down, nothing ordered yet); taken and why it needs a
 * person most (a waiter call, then a bill request, then food on the way, then eating); or paid
 * and still seated (everything served and paid: paying isn't leaving, so it stays taken until
 * staff free it).
 */
export type FloorTableStatus =
  | 'available'
  | 'reserved'
  | 'seated'
  | Exclude<AdminTableStatus, 'closing'>
  | 'paidSeated'
  /** Out of service, with nothing going on at it. */
  | 'outOfService';

/** One table on the floor plan, with what's happening at it. */
export interface AdminFloorTable {
  table: number;
  seats: number;
  status: FloorTableStatus;
  /**
   * Staff freed it (see FloorTableLayout › freed): `status` is available and the counts below
   * leave out what came before. Earlier orders still unpaid stay on the Orders page.
   */
  freed: boolean;
  /** Out of service (see FloorTableLayout › disabled). */
  disabled: boolean;
  /** Today's open orders at the table: not cancelled, and not both served and paid. */
  orderCount: number;
  /** Still to pay across them. */
  due: Price;
  /** ISO: the first of those orders, or when booked guests were seated (how long they've sat). */
  seatedAt?: string;
  /**
   * The booking that matters now: the one it's reserved for, the seated guests', or (free) the
   * next one later today. Absent when the table has none.
   */
  booking?: ReservationBrief;
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
  /** Today's bookings at the table still to come or seated, by time. */
  reservations: Reservation[];
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
export type CancelReason = CancellationReason;

/* ---------- Table QR codes (GET /admin/branches/:branchId/tables/qr-codes) ---------- */

/** One table's QR code: where it is, and the link guests scan (signed, so it can't be edited). */
export interface TableQrCode {
  table: number;
  seats: number;
  floor: Pick<FloorLayout, 'id' | 'name'>;
  /** The guest app's path with the branch, table and signed token: "/?branch=…&table=5&qr=…". */
  path: string;
}

export interface AdminTableQrCodes {
  /** Every table on the floor plan, by area then table, as staff walk them. */
  codes: TableQrCode[];
}

/* ---------- Reservations (GET /admin/branches/:branchId/reservations) ---------- */

/**
 * Where a booking is: still to come, the guests sat down, called off, or the guests never came.
 */
export type ReservationStatus = ReservationStatusCode;

/** A table booked for a party at a time. */
export interface Reservation {
  /** Shown to staff: "R1004". */
  id: string;
  /** The main table: the first of `tables`. */
  table: number;
  /**
   * Every table the party has, the main one first (a party of 8 on two tables of 4: [4, 5]).
   * Read it with bookingTables (lib/reservations): servers before it send `table` alone.
   */
  tables?: number[];
  guestName: string;
  /** National mobile digits (the branch's mobile rules), when the guest gave one. */
  phone?: string;
  partySize: number;
  /** ISO: when the party is due. */
  at: string;
  /** How long the table is held from `at`. */
  minutes: number;
  /** Occasion, high chair, allergies… */
  note?: string;
  status: ReservationStatus;
  /** ISO. */
  createdAt: string;
  /** The staff member who took the booking. */
  createdBy: string;
  /** ISO: when the guests were seated. */
  seatedAt?: string;
  /** ISO and who: the last change of status (seated, cancelled, no-show, restored). */
  updatedAt?: string;
  updatedBy?: string;
}

/** What a table card shows of a booking. */
export type ReservationBrief = Pick<
  Reservation,
  'id' | 'guestName' | 'partySize' | 'at' | 'status'
>;

/** GET /admin/branches/:branchId/reservations: from the start of today on, by time. */
export interface AdminReservations {
  reservations: Reservation[];
  /** ISO: when the server read it. */
  generatedAt: string;
}
