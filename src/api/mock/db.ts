import { isOrderMode } from '@/lib/fulfilment';
import { isPaymentMethodId } from '@/lib/payments';
import { WAITER_REASON_IDS } from '@/lib/service';
import { isGuestSession } from '@/lib/session';
import { readJSON, storageAvailable, writeJSON, type StorageKind } from '@/lib/storage';
import type { Order, OrderItem } from '@/types/order';
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
  /** Per browser session, as before: a request lapses with the tab. */
  serviceRequests: 'olive.service.v1',
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
    isOptionalString(v.note)
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
    Array.isArray(v.timeline) &&
    v.timeline.every(
      (e) => isObject(e) && typeof e.status === 'string' && typeof e.time === 'string',
    ) &&
    isObject(payment) &&
    typeof payment.method === 'string' &&
    PAYMENT_SETTLEMENTS.has(payment.method) &&
    typeof payment.status === 'string' &&
    isOptionalString(v.estimate) &&
    isOptionalString(v.kitchenNote)
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

const isPayment = (v: unknown): v is Payment =>
  isObject(v) &&
  typeof v.id === 'string' &&
  (v.purpose === 'order' || v.purpose === 'bill') &&
  typeof v.sessionId === 'string' &&
  isPaymentMethodId(v.method) &&
  typeof v.amount === 'number' &&
  typeof v.status === 'string' &&
  PAYMENT_STATUSES.has(v.status) &&
  typeof v.createdAt === 'number' &&
  typeof v.expiresAt === 'number' &&
  Array.isArray(v.orderIds) &&
  v.orderIds.every((id) => typeof id === 'string') &&
  isOptionalString(v.transactionRef);

/* ---------- Service requests ---------- */

export function isServiceRequest(v: unknown): v is ServiceRequest {
  if (
    !isObject(v) ||
    typeof v.id !== 'string' ||
    typeof v.table !== 'number' ||
    typeof v.sessionId !== 'string' ||
    typeof v.requestedAt !== 'string' ||
    Number.isNaN(Date.parse(v.requestedAt))
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

/** The mock server's tables. */
export interface MockDb {
  sessions: Table<GuestSession[]>;
  /** By guest session id. */
  otp: Table<Record<string, OtpRecord>>;
  /** Orders placed on this device, newest first. */
  orders: Table<StoredOrder[]>;
  payments: Table<Payment[]>;
  serviceRequests: Table<ServiceRequest[]>;
}

export function createStorageDb(): MockDb {
  return {
    sessions: table(MOCK_KEYS.sessions, 'local', listOf(isGuestSession), () => []),
    otp: table(MOCK_KEYS.otp, 'local', isOtpTable, () => ({})),
    orders: table(MOCK_KEYS.orders, 'local', listOf(isStoredOrder), () => []),
    payments: table(MOCK_KEYS.payments, 'local', listOf(isPayment), () => []),
    serviceRequests: table(
      MOCK_KEYS.serviceRequests,
      'session',
      listOf(isServiceRequest),
      () => [],
    ),
  };
}
