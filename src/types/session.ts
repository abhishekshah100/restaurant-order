/** One guest's visit at a table: each QR scan on a new device (or table) starts one. */
export interface GuestSession {
  id: string;
  table: number;
  /** Epoch ms. */
  startedAt: number;
  /** Epoch ms; after this the device starts a new session. */
  expiresAt: number;
  /** Signed table token from the QR link (`&qr=`), passed on to the backend. */
  qrToken?: string;
}

/** What a QR scan carries: `/?table=12&qr=<token>`. */
export interface TableScan {
  table: number;
  qrToken?: string;
}
