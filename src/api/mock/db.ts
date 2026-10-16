import { isOrderMode } from '@/lib/fulfilment';
import { isPaymentMethodId } from '@/lib/payments';
import { WAITER_REASON_IDS } from '@/lib/service';
import { isGuestSession } from '@/lib/session';
import { readJSON, storageAvailable, writeJSON, type StorageKind } from '@/lib/storage';
import type { FloorPlanLayout, FloorTableLayout, Reservation } from '@/types/admin';
import type { BranchStatus } from '@/types/branch';
import type { BranchStatusChange } from './branchStatus';
import type { BranchMenuChanges } from './menuChanges';
import type { Order, OrderItem, OrderRound } from '@/types/order';
import type { ServiceRequest } from '@/types/service';
import type { GuestSession } from '@/types/session';
import type { Payment } from '../contracts';

/*
 * The mock server's database: one table per resource in Web Storage, namespaced under
 * `olive.`, validated on every read (a malformed row empties the table rather than being
 * trusted). Orders and service requests keep the keys the app used before the mock server,
 * so what a device already holds carries over. When storage is blocked a table lives in
 * memory for the tab.
 */

export const MOCK_KEYS = {
  sessions: 'olive.mock.sessions.v1',
  otp: 'olive.mock.otp.v1',
  orders: 'olive.orders.v1',
  payments: 'olive.mock.payments.v1',
  adminSessions: 'olive.mock.adminSessions.v1',
  /**
   * The status staff last set for each branch, by branch id (`{ status, until?, day? }`): paused
   * until a time, closed for a day, or open. GET /branches and GET /admin/branches report it.
   */
  branchStatus: 'olive.mock.branchStatus.v2',
  /**
   * Waiter and bill requests. In localStorage, so the staff pages in another tab of the same
   * browser see them (a guest still sees only their own session's).
   */
  serviceRequests: 'olive.service.v1',
  /** When staff last freed each table (ISO), by "branchId:table". The floors' `freed` flag. */
  tablesFreed: 'olive.mock.tablesFreed.v1',
  /**
   * Staff changes to each branch's menu, by branch id: the dishes they edited or added (in full,
   * by slug), the ones they removed, and the categories as they left them. GET
   * /branches/:id/menu is the dummy JSON with these on top.
   */
  menuChanges: 'olive.mock.menu.v2',
  /**
   * Bookings, by branch id. A branch with no entry yet is seeded with sample bookings under
   * `npm run dev` (api/mock/demoReservations).
   */
  reservations: 'olive.mock.reservations.v1',
  /** The floor plan staff set up for each branch (Settings › Floor plan), by branch id. */
  floorLayouts: 'olive.mock.floorLayouts.v1',
} as const;

export interface Table<T> {
  read(): T;
  write(value: T): void;
}

function table<T>(
  key: string,
  kind: StorageKind,
  isValid: (v: unknown) => v is T,
  empty: () => T,
): Table<T> {
  let memory = empty();
  return {
    read: () => readJSON(key, isValid, kind) ?? (storageAvailable(kind) ? empty() : memory),
    write: (value) => {
      memory = value;
      writeJSON(key, value, kind);
    },
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isOptionalString = (v: unknown) => v === undefined || typeof v === 'string';
const listOf =
  <T>(isItem: (v: unknown) => v is T) =>
  (v: unknown): v is T[] =>
    Array.isArray(v) && v.every(isItem);

/* ---------- Orders ---------- */

function isOrderItem(v: unknown): v is OrderItem {
  return (
    isObject(v) &&
    typeof v.dishSlug === 'string' &&
    typeof v.name === 'string' &&
    typeof v.veg === 'boolean' &&
    typeof v.quantity === 'number' &&
    typeof v.unitPrice === 'number' &&
    Array.isArray(v.details) &&
    v.details.every((d) => typeof d === 'string') &&
    isOptionalString(v.variant) &&
    isOptionalString(v.note) &&
    (v.config === undefined || (isObject(v.config) && typeof v.config.dishSlug === 'string'))
  );
}

const isTimeline = (v: unknown) =>
  Array.isArray(v) &&
  v.every((e) => isObject(e) && typeof e.status === 'string' && typeof e.time === 'string');

function isOrderRound(v: unknown): v is OrderRound {
  return (
    isObject(v) &&
    typeof v.number === 'number' &&
    typeof v.placedAt === 'string' &&
    typeof v.status === 'string' &&
    typeof v.changeableUntil === 'string' &&
    Array.isArray(v.items) &&
    v.items.every(isOrderItem) &&
    isTimeline(v.timeline) &&
    isOptionalString(v.kitchenNote) &&
    isOptionalString(v.servedAt)
  );
}

/**
 * An order as stored. One saved before branches has no `branchId` (it was at the default
 * branch); one saved before order modes has no `mode` (it was dine-in).
 */
export type StoredOrder = Omit<Order, 'branchId' | 'mode'> & {
  branchId?: string;
  mode?: Order['mode'];
};

const PAYMENT_SETTLEMENTS = new Set(['online', 'counter', 'pickup', 'cod']);

/** Runtime guard for a stored order. */
export function isStoredOrder(v: unknown): v is StoredOrder {
  if (!isObject(v)) return false;
  const { payment } = v;
  return (
    typeof v.id === 'string' &&
    isOptionalString(v.branchId) &&
    (v.mode === undefined || isOrderMode(v.mode)) &&
    // Dine-in orders are at a table; takeaway and delivery ones aren't.
    ((v.mode ?? 'dineIn') === 'dineIn' ? typeof v.table === 'number' : v.table === undefined) &&
    (v.pickup === undefined || isObject(v.pickup)) &&
    (v.delivery === undefined || isObject(v.delivery)) &&
    typeof v.customerName === 'string' &&
    isOptionalString(v.sessionId) &&
    typeof v.placedAt === 'string' &&
    typeof v.status === 'string' &&
    typeof v.itemTotal === 'number' &&
    typeof v.total === 'number' &&
    Array.isArray(v.items) &&
    v.items.every(isOrderItem) &&
    isTimeline(v.timeline) &&
    (v.rounds === undefined || (Array.isArray(v.rounds) && v.rounds.every(isOrderRound))) &&
    isObject(payment) &&
    typeof payment.method === 'string' &&
    PAYMENT_SETTLEMENTS.has(payment.method) &&
    typeof payment.status === 'string' &&
    (payment.paid === undefined || typeof payment.paid === 'number') &&
    isOptionalString(v.estimate) &&
    isOptionalString(v.kitchenNote) &&
    isOptionalString(v.servedAt) &&
    isOptionalString(v.promoCode) &&
    (v.discounts === undefined ||
      (Array.isArray(v.discounts) &&
        v.discounts.every((d) => isObject(d) && typeof d.amount === 'number')))
  );
}

/* ---------- OTP ---------- */

/** The code last sent in a session. */
export interface OtpRecord {
  phone: string;
  sentAt: number;
  attemptsLeft: number;
  verified: boolean;
}

const isOtpRecord = (v: unknown): v is OtpRecord =>
  isObject(v) &&
  typeof v.phone === 'string' &&
  typeof v.sentAt === 'number' &&
  typeof v.attemptsLeft === 'number' &&
  typeof v.verified === 'boolean';

const isOtpTable = (v: unknown): v is Record<string, OtpRecord> =>
  isObject(v) && Object.values(v).every(isOtpRecord);

/* ---------- Payments ---------- */

const PAYMENT_STATUSES = new Set(['pending', 'succeeded', 'failed', 'expired']);

const PAYMENT_PURPOSES = new Set(['order', 'bill', 'round', 'change']);

const isPayment = (v: unknown): v is Payment =>
  isObject(v) &&
  typeof v.id === 'string' &&
  typeof v.purpose === 'string' &&
  PAYMENT_PURPOSES.has(v.purpose) &&
  typeof v.sessionId === 'string' &&
  isPaymentMethodId(v.method) &&
  typeof v.amount === 'number' &&
  typeof v.status === 'string' &&
  PAYMENT_STATUSES.has(v.status) &&
  typeof v.createdAt === 'number' &&
  typeof v.expiresAt === 'number' &&
  Array.isArray(v.orderIds) &&
  v.orderIds.every((id) => typeof id === 'string') &&
  isOptionalString(v.orderId) &&
  isOptionalString(v.transactionRef);

/* ---------- Service requests ---------- */

export function isServiceRequest(v: unknown): v is ServiceRequest {
  if (
    !isObject(v) ||
    typeof v.id !== 'string' ||
    typeof v.table !== 'number' ||
    typeof v.sessionId !== 'string' ||
    typeof v.requestedAt !== 'string' ||
    Number.isNaN(Date.parse(v.requestedAt)) ||
    !isOptionalString(v.resolvedAt)
  ) {
    return false;
  }
  if (v.kind === 'waiter') {
    return (
      typeof v.reason === 'string' && WAITER_REASON_IDS.has(v.reason) && isOptionalString(v.note)
    );
  }
  return (
    v.kind === 'bill' &&
    (v.scope === 'mine' || v.scope === 'table') &&
    typeof v.balance === 'number'
  );
}

/* ---------- Admin sessions ---------- */

/** A staff sign-in the server issued: the bearer token, whose account it is, and when it ends. */
export interface AdminSessionRecord {
  token: string;
  /** The account's email (its id in the mock). */
  email: string;
  expiresAt: number;
}

const isAdminSessionRecord = (v: unknown): v is AdminSessionRecord =>
  isObject(v) &&
  typeof v.token === 'string' &&
  typeof v.email === 'string' &&
  typeof v.expiresAt === 'number';

const BRANCH_STATUSES = new Set<unknown>(['open', 'closed', 'paused'] satisfies BranchStatus[]);

const isBranchStatusTable = (v: unknown): v is Record<string, BranchStatusChange> =>
  isObject(v) &&
  Object.values(v).every(
    (c) =>
      isObject(c) &&
      BRANCH_STATUSES.has(c.status) &&
      isOptionalString(c.until) &&
      isOptionalString(c.day),
  );

const isFreedTable = (v: unknown): v is Record<string, string> =>
  isObject(v) &&
  Object.values(v).every((at) => typeof at === 'string' && !Number.isNaN(Date.parse(at)));

const isBranchMenuChanges = (v: unknown): v is BranchMenuChanges =>
  isObject(v) &&
  isObject(v.dishes) &&
  Object.values(v.dishes).every(
    (d) => isObject(d) && typeof d.slug === 'string' && typeof d.name === 'string',
  ) &&
  Array.isArray(v.removed) &&
  v.removed.every((slug) => typeof slug === 'string') &&
  (v.categories === undefined ||
    (Array.isArray(v.categories) &&
      v.categories.every(
        (c) => isObject(c) && typeof c.id === 'string' && typeof c.name === 'string',
      )));

const isMenuChanges = (v: unknown): v is Record<string, BranchMenuChanges> =>
  isObject(v) && Object.values(v).every(isBranchMenuChanges);

const RESERVATION_STATUSES = new Set<unknown>(['booked', 'seated', 'cancelled', 'noShow']);

const isReservation = (v: unknown): v is Reservation =>
  isObject(v) &&
  typeof v.id === 'string' &&
  typeof v.table === 'number' &&
  typeof v.guestName === 'string' &&
  isOptionalString(v.phone) &&
  typeof v.partySize === 'number' &&
  typeof v.at === 'string' &&
  !Number.isNaN(Date.parse(v.at)) &&
  typeof v.minutes === 'number' &&
  isOptionalString(v.note) &&
  RESERVATION_STATUSES.has(v.status) &&
  typeof v.createdAt === 'string' &&
  typeof v.createdBy === 'string' &&
  isOptionalString(v.seatedAt) &&
  isOptionalString(v.updatedAt) &&
  isOptionalString(v.updatedBy);

const isReservationTable = (v: unknown): v is Record<string, Reservation[]> =>
  isObject(v) && Object.values(v).every(listOf(isReservation));

const isFloorTable = (v: unknown): v is FloorTableLayout =>
  isObject(v) &&
  typeof v.number === 'number' &&
  typeof v.seats === 'number' &&
  typeof v.freed === 'boolean' &&
  (v.disabled === undefined || typeof v.disabled === 'boolean');

const isFloorLayout = (v: unknown): v is FloorPlanLayout =>
  isObject(v) &&
  Array.isArray(v.floors) &&
  v.floors.every(
    (f: unknown) =>
      isObject(f) &&
      typeof f.id === 'string' &&
      typeof f.name === 'string' &&
      Array.isArray(f.tables) &&
      f.tables.every(isFloorTable),
  );

const isFloorLayoutTable = (v: unknown): v is Record<string, FloorPlanLayout> =>
  isObject(v) && Object.values(v).every(isFloorLayout);

/** The mock server's tables. */
export interface MockDb {
  sessions: Table<GuestSession[]>;
  /** By guest session id. */
  otp: Table<Record<string, OtpRecord>>;
  /** Orders placed on this device, newest first. */
  orders: Table<StoredOrder[]>;
  payments: Table<Payment[]>;
  serviceRequests: Table<ServiceRequest[]>;
  adminSessions: Table<AdminSessionRecord[]>;
  /** The status staff last set for each branch, by branch id. */
  branchStatus: Table<Record<string, BranchStatusChange>>;
  /** When staff last freed each table (ISO), by "branchId:table". */
  tablesFreed: Table<Record<string, string>>;
  /** Staff changes to each branch's menu, by branch id. */
  menuChanges: Table<Record<string, BranchMenuChanges>>;
  /** Bookings, by branch id. */
  reservations: Table<Record<string, Reservation[]>>;
  /** The floor plan staff saved, by branch id (else the branch's floors.json). */
  floorLayouts: Table<Record<string, FloorPlanLayout>>;
}

export function createStorageDb(): MockDb {
  return {
    sessions: table(MOCK_KEYS.sessions, 'local', listOf(isGuestSession), () => []),
    otp: table(MOCK_KEYS.otp, 'local', isOtpTable, () => ({})),
    orders: table(MOCK_KEYS.orders, 'local', listOf(isStoredOrder), () => []),
    payments: table(MOCK_KEYS.payments, 'local', listOf(isPayment), () => []),
    serviceRequests: table(MOCK_KEYS.serviceRequests, 'local', listOf(isServiceRequest), () => []),
    adminSessions: table(MOCK_KEYS.adminSessions, 'local', listOf(isAdminSessionRecord), () => []),
    branchStatus: table(MOCK_KEYS.branchStatus, 'local', isBranchStatusTable, () => ({})),
    tablesFreed: table(MOCK_KEYS.tablesFreed, 'local', isFreedTable, () => ({})),
    menuChanges: table(MOCK_KEYS.menuChanges, 'local', isMenuChanges, () => ({})),
    reservations: table(MOCK_KEYS.reservations, 'local', isReservationTable, () => ({})),
    floorLayouts: table(MOCK_KEYS.floorLayouts, 'local', isFloorLayoutTable, () => ({})),
  };
}
