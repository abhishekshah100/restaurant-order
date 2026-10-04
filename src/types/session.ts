import type { OrderMode } from './branch';

/**
 * One guest's visit to a branch: each QR scan on a new device (or table, or branch) starts one,
 * and so does choosing an outlet for takeaway or delivery.
 */
export interface GuestSession {
  id: string;
  /** The branch the guest orders from (GET /branches). */
  branchId: string;
  /** How they get their food. Changing it keeps the session (and the cart). */
  mode: OrderMode;
  /** The table the QR code was scanned at; only a session with a table can order dine-in. */
  table?: number;
  /** Delivery: the area (from the branch's zones) the guest is ordering to. */
  deliveryArea?: string;
  /** Epoch ms. */
  startedAt: number;
  /** Epoch ms; after this the device starts a new session. */
  expiresAt: number;
  /** Signed table token from the QR link (`&qr=`), passed on to the backend. */
  qrToken?: string;
}

/** What a QR scan carries: `/?branch=ktm-thamel&table=12&qr=<token>`. */
export interface TableScan {
  branchId: string;
  table: number;
  qrToken?: string;
}

/** What a new session is opened with: a table scan (dine-in), or an outlet and a mode. */
export type SessionStart =
  | (TableScan & { mode: 'dineIn' })
  | { branchId: string; mode: 'takeaway' | 'delivery'; deliveryArea?: string };

/** A visit without a session yet: the start screen, with what the link already chose. */
export interface StartChoice {
  branchId?: string;
  mode?: Exclude<OrderMode, 'dineIn'>;
}
