import type { CancellationReason, ReservationStatusCode } from '@/config/masters';
import type { BranchImage, BranchStatus, CountryCode, OpeningSchedule, OrderMode } from './branch';
import type { Price } from './menu';
import type { Order, OrderStatus, PaymentStatus } from './order';
import type { KitchenMessage, ServiceRequest } from './service';

/** The signed-in staff member, as `POST /admin/sessions` returns them. */
export interface AdminProfile {
  /** Their staff id (sessions from before it was sent don't have it: their name stands in). */
  id?: string;
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
  /**
   * Signed in with a password an admin set (new, or reset): they choose their own before going
   * on (every other request answers 403 password_change_required until then).
   */
  mustChangePassword?: true;
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
  /** How many tables are on the branch's floor plan. */
  tableCount: number;
  /** The order modes the branch takes, always in this order: dineIn, takeaway, delivery. */
  modes: OrderMode[];
  /** ISO 4217, e.g. "INR", "NPR". */
  currencyCode: string;
  image?: BranchImage;
  /** What the signed-in staff member may do here (their roles' permissions at this branch). */
  permissions?: StaffPermission[];
  /** Optional modules the branch's restaurant has ("inventory"); none from the mock. */
  features?: string[];
}

/** GET …/features: what the restaurant has switched on, and whether this person may switch it. */
export interface FeaturesResponse {
  features: string[];
  /** ISO: when a feature was last switched. */
  changedAt?: string;
  /** A super admin: the platform switches features. */
  canChange: boolean;
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
  /** Who covers which table (table sections): covered tables only. None from the mock. */
  sections?: { table: number; waiter: TableWaiter }[];
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

/** A staff member's shift at a branch (Start shift / Clock out). Times ISO. */
export interface StaffShift {
  id: string;
  staff: TableWaiter;
  startedAt: string;
  /** None while they're on shift. */
  endedAt?: string;
  /** Left open: closed 30 minutes after the branch's closing time that day. */
  autoClosed?: true;
}

/** What the published rota planned for a shift. Times ISO; minutes from start to end. */
export interface PlannedTimes {
  startsAt: string;
  endsAt: string;
  minutes: number;
  breakMinutes: number;
}

/** Why attendance times were fixed by hand. */
export const SHIFT_FIX_REASONS = ['forgot_in', 'forgot_out', 'wrong_time', 'other'] as const;
export type ShiftFixReason = (typeof SHIFT_FIX_REASONS)[number];

/** A hand fix to a shift (no `before`: the shift was added by hand). Times ISO. */
export interface ShiftFix {
  at: string;
  by?: string;
  reason: ShiftFixReason;
  note?: string;
  before?: { startedAt: string; endedAt?: string; autoClosed?: true };
  after: { startedAt: string; endedAt?: string };
}

/** PATCH …/shifts/:id: a shift's times fixed by hand (no end: still on going). */
export interface FixShiftRequest {
  startedAt: string;
  endedAt?: string;
  reason: ShiftFixReason;
  note?: string;
}

/** POST …/shifts: a shift someone forgot, added by hand. */
export interface AddShiftRequest extends FixShiftRequest {
  staffId: string;
}

/** One shift in Team › Attendance, with what the person did during it. */
export interface ShiftRow extends StaffShift {
  /** The shift the published rota planned (absent: not on the rota). */
  planned?: PlannedTimes;
  /** Shifted in this long after the planned start. */
  lateMinutes?: number;
  /** Shifted out this long before the planned end. */
  leftEarlyMinutes?: number;
  /** Worked this much longer than planned. */
  extraMinutes?: number;
  minutes: number;
  ordersTaken: number;
  payments: number;
  collected: number;
  tips: number;
  /** Fixed by hand, oldest first. */
  fixes?: ShiftFix[];
}

/** GET …/shifts?from=&to=: the shifts started on those days, newest first. */
export interface ShiftListResponse {
  from: string;
  to: string;
  shifts: ShiftRow[];
  /** Planned on the published rota, nobody shifted in: newest first. */
  missed?: MissedShift[];
  /** Planned, not started yet (or under 30 minutes since): soonest first. */
  expected?: MissedShift[];
  /** Everyone working at the branch (to add a forgotten shift). */
  people?: { id: string; name: string; role: string }[];
}

/** A planned shift nobody came for. */
export interface MissedShift {
  id: string;
  staff: TableWaiter;
  planned: PlannedTimes;
}

/* ---------- Rota (planned shifts) ---------- */

/** The colours a shift type can have. */
export const SHIFT_COLORS = ['olive', 'amber', 'sky', 'rose', 'violet', 'slate'] as const;
export type ShiftColor = (typeof SHIFT_COLORS)[number];

/** A branch's usual shift. Times "HH:MM" (ending at or before it starts: the next day). */
export interface ShiftType {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  color: ShiftColor;
}

/** One planned shift: a person, the day it starts, from and to, an unpaid break. */
export interface RotaShift {
  id: string;
  staffId: string;
  day: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  /** Paid minutes (the break aside). */
  minutes: number;
  /** Planned as this shift type (absent: custom hours). */
  typeId?: string;
  note?: string;
  /** Changed since the week was published (staff already see it). */
  changed?: true;
  /** Moved to this person by an approved swap: from whom. */
  swappedFrom?: string;
}

/** Someone who can be put on the rota. */
export interface RotaPerson {
  id: string;
  name: string;
  role: string;
  /** International form; on the planner's week only (WhatsApp). */
  phone?: string;
}

/** GET …/rota?week=: a week, Monday to Sunday. */
export interface RotaWeekResponse {
  week: string;
  days: string[];
  /** ISO; absent while it's a draft. */
  publishedAt?: string;
  publishedBy?: string;
  staff: RotaPerson[];
  shifts: RotaShift[];
  types: ShiftType[];
  /** Above this many planned hours a week, a warning (null: no limit). */
  weekHoursLimit: number | null;
  /** Time off asked for or approved on these days. */
  timeOff: TimeOffView[];
}

export type TimeOffStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

/** Days off someone asked for. Days "YYYY-MM-DD", inclusive. */
export interface TimeOffView {
  id: string;
  staff: TableWaiter;
  from: string;
  to: string;
  reason: string;
  status: TimeOffStatus;
  createdAt: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

export type SwapStatus =
  'awaitingColleague' | 'awaitingManager' | 'approved' | 'declined' | 'cancelled';

/** Someone asking a colleague to take one of their shifts. */
export interface SwapView {
  id: string;
  shift: { id: string; day: string; startsAt: string; endsAt: string };
  from: TableWaiter;
  to: TableWaiter;
  status: SwapStatus;
  note?: string;
  createdAt: string;
  colleagueAt?: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

/** GET …/rota/requests: what waits for a planner, and the last 30 days decided. */
export interface RotaRequestsResponse {
  timeOff: TimeOffView[];
  swaps: SwapView[];
  waiting: number;
}

/** GET …/rota/mine: my published shifts, yesterday to 6 days on. */
export interface MyRotaResponse {
  shifts: RotaShift[];
  /** My time off: pending, approved from today, recently declined. */
  timeOff: TimeOffView[];
  /** Swaps I asked for, and those asked of me (open). */
  swaps: SwapView[];
}

/** POST …/rota/shifts: someone's shift on a day (a shift type, or hours of its own). */
export interface SaveRotaShiftRequest {
  staffId: string;
  day: string;
  typeId?: string;
  startsAt?: string;
  endsAt?: string;
  breakMinutes?: number;
  note?: string;
}

/** POST/PATCH …/rota/types: a shift type. */
export interface ShiftTypeRequest {
  name: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  color: ShiftColor;
}

/** The quick tags a table's note can carry. */
export const NOTE_TAGS = ['vip', 'allergy', 'birthday', 'regular', 'highChair'] as const;
export type NoteTag = (typeof NOTE_TAGS)[number];

/** The guests' note at a table for the visit: a line, quick tags, when and by whom. */
export interface TableNote {
  text?: string;
  tags: NoteTag[];
  at?: string;
  by?: string;
}

/** A staff member covering tables (table sections). */
export interface TableWaiter {
  id: string;
  name: string;
}

/** GET …/tables/waiters: who can cover tables, and the tables each covers now. */
export interface SectionWaiter extends TableWaiter {
  tables: number[];
}

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
  /** The waiter covering it (table sections); none when nobody is. */
  waiter?: TableWaiter;
  /** The guests' note for this visit (cleared when the table is freed). */
  note?: TableNote;
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
  /** A no-show the server set: not seated within the branch's grace period. */
  autoNoShow?: true;
  /** The advance the guest paid, if any. */
  deposit?: ReservationDeposit;
  /** Staff reminded the guest (WhatsApp or SMS): when, and who. */
  reminded?: { at: string; by?: string };
}

/**
 * A booking's advance: how much and how, who took it, its proof photos (keys), and what became
 * of it: held, applied to a bill (`order`), refunded, or kept by the restaurant.
 */
export interface ReservationDeposit {
  amount: Price;
  method: string;
  at: string;
  by?: string;
  proofs?: string[];
  status: 'held' | 'applied' | 'refunded' | 'kept';
  settledAt?: string;
  order?: string;
}

/**
 * A branch's booking rules: a no-show this many minutes after the time (0: staff mark them);
 * a deposit of `depositPerPerson` a head for parties of `depositPartySize` or more (0: never)
 * or after `depositAfterNoShows` no-shows in six months (0: never), refunded when cancelled
 * `depositCancelHours` or more ahead, kept when later or for a no-show.
 */
export interface ReservationRules {
  noShowAfterMinutes: number;
  depositPartySize: number;
  depositPerPerson: Price;
  depositCancelHours: number;
  depositAfterNoShows: number;
}

/** How a guest's bookings at the branch ended in the last six months (by their number). */
export interface GuestHistory {
  bookings: number;
  seated: number;
  noShows: number;
  cancelled: number;
  lastNoShowAt?: string;
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
  /** The branch's no-show and deposit rules (the server's; the mock has none). */
  rules?: ReservationRules;
}

/* ---------- Staff roles (Settings › Roles & permissions) ---------- */

/** What a role can let staff do (the server's catalog: routes check these). */
export type StaffPermission =
  | 'branch.status.update'
  | 'branch.settings.manage'
  | 'branches.manage'
  | 'staff.manage'
  | 'rota.plan'
  | 'attendance.fix'
  | 'menu.manage'
  | 'menu.availability.update'
  | 'tables.manage'
  | 'tables.assign'
  | 'orders.view'
  | 'orders.take'
  | 'orders.cancel'
  | 'refunds.give'
  | 'payments.collect'
  | 'cash.manage'
  | 'cash.review'
  | 'service.respond'
  | 'kitchen.update'
  | 'reservations.manage'
  | 'reports.view'
  | 'inventory.view'
  | 'inventory.manage'
  | 'inventory.adjust'
  | 'inventory.wastage'
  | 'inventory.count'
  | 'purchase.view'
  | 'purchase.manage'
  | 'purchase.approve'
  | 'purchase.receive';

/** A role staff can be given: built in (read-only) or the restaurant's own. */
export interface AdminRole {
  id: string;
  /** "waiter"; a restaurant's own role gets one from its name. */
  key: string;
  name: string;
  description: string;
  /** Built in: every restaurant has it; duplicate it to change it. */
  system: boolean;
  permissions: StaffPermission[];
  /** How many staff hold it at the restaurant. */
  staff: number;
}

/* ---------- Staff (Settings › Staff) ---------- */

/** Where someone's role applies: the whole restaurant (an admin), or this branch. */
export type StaffScope = 'restaurant' | 'branch';

/** Someone on the staff here. */
export interface AdminStaffMember {
  id: string;
  name: string;
  email: string;
  /** International form: "+919876543210". */
  phone: string;
  role: { id: string; name: string };
  scope: StaffScope;
  /** Off: they can't sign in. */
  active: boolean;
  /** ISO; absent until their first sign-in. */
  lastSignInAt?: string;
  /** Sign-in off: why, when (ISO) and by whom. */
  off?: { reason: string; at: string; by?: string };
  /** Still to choose their own password. */
  mustChangePassword: boolean;
  /** The one looking: their own role and status can't be changed. */
  you: boolean;
}

/** Someone removed from the team here (their history stays), to add back. */
export interface RemovedStaffMember {
  id: string;
  name: string;
  email: string;
  /** International form: "+919876543210". */
  phone: string;
  /** The role they had (`id` null when that role has since been deleted). */
  role: { id: string | null; name: string };
  scope: StaffScope;
  /** ISO. */
  removedAt: string;
  /** Who removed them. */
  removedBy?: string;
  /** Why they were removed. */
  reason?: string;
}
