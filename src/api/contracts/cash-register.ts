import type { Price } from '@/types/menu';

/* ---------- The cash register ---------- */

/** Notes and coins counted: ₹500 × 4, ₹10 × 7 (they add up to the amount they go with). */
export type DrawerCount = { value: Price; quantity: number }[];

/** Why cash went in or out of the drawer, other than an order's. */
export type CashMovementReason = 'float' | 'supplies' | 'withdrawal' | 'bank' | 'other';

export interface CashMovement {
  id: string;
  kind: 'in' | 'out';
  amount: Price;
  reason: CashMovementReason;
  note?: string;
  at: string;
  by?: string;
}

/** What the drawer took and gave back since it opened, besides the float. */
export interface CashTotals {
  /** Cash payments, tips included. */
  taken: Price;
  tips: Price;
  /** Cash handed back (refunds). */
  refunded: Price;
  paidIn: Price;
  paidOut: Price;
  /** Float + taken - refunded + paid in - paid out. */
  expected: Price;
}

/** A branch's cash drawer from opening (a float) to closing (a count). */
export interface CashSession {
  id: string;
  number: number;
  openedAt: string;
  openedBy?: string;
  float: Price;
  openingCount?: DrawerCount;
  movements: CashMovement[];
  /** While open only for staff who see reports (the close count is blind); always once closed. */
  totals?: CashTotals;
  closedAt?: string;
  closedBy?: string;
  counted?: Price;
  closingCount?: DrawerCount;
  /** Counted - expected (negative: short). */
  difference?: Price;
  /** Closed: card, UPI… taken in person, checked against the machine or statement. */
  methods?: CashMethodCheck[];
  /** Closed: a difference above the branch's limit then: it needs review. */
  overLimit?: boolean;
  note?: string;
  /** A manager checked it (it needed a check). */
  checked?: CashCheck;
}

/** A manager's check of a drawer that needed one: when, who, what they found. */
export interface CashCheck {
  at: string;
  by?: string;
  note?: string;
}

/** A way taken in person during a session, and what was counted (when checked). */
export interface CashMethodCheck {
  method: string;
  expected: Price;
  counted?: Price;
  difference?: Price;
}

export interface CashSessionSummary {
  id: string;
  number: number;
  openedAt: string;
  openedBy?: string;
  closedAt?: string;
  closedBy?: string;
  float: Price;
  expected?: Price;
  counted?: Price;
  difference?: Price;
  overLimit?: boolean;
  checked?: CashCheck;
}

/**
 * `GET /admin/branches/:branchId/cash-register` — the drawer now (`current`, null when closed),
 * the count at the last close (`lastCounted`: the next float) and recent sessions (for staff
 * with `cash.manage` or `reports.view`). Read by those who collect payments too (cash needs an
 * open drawer). `GET …/cash-register/sessions/:id` → one `CashSession`. Backend only.
 */
export interface CashRegisterResponse {
  current: CashSession | null;
  lastCounted?: Price;
  recent: CashSessionSummary[];
  /** How big a difference can be before it needs review (0: any). */
  differenceLimit: Price;
}

/**
 * `GET …/cash-register/days/:day` — the branch's day at the register (sessions opened that
 * calendar day): its cash, card and UPI, what needs review and the sign-off. `POST
 * …/days/:day/sign-off` (`{ note? }`, needs `cash.review`) → the same, signed off; 409 day_open
 * while a session that day is open, 409 day_signed_off.
 */
export interface CashDaySummary {
  day: string;
  sessions: CashSessionSummary[];
  open: boolean;
  cash: {
    float: Price;
    taken: Price;
    refunded: Price;
    paidIn: Price;
    paidOut: Price;
    expected: Price;
    counted: Price;
    difference: Price;
  };
  methods: CashMethodCheck[];
  needsReview: number;
  signOff?: { at: string; by?: string; note?: string };
}

/**
 * `GET …/cash-register/report?from=&to=` — closed sessions day by day (the last 30 days by
 * default, at most 92), and each closer's record. `PATCH …/cash-register/limit` (`{
 * differenceLimit }`, needs `cash.review`) sets how big a difference can be before review.
 */
export interface CashReport {
  from: string;
  to: string;
  days: {
    day: string;
    sessions: number;
    expected: Price;
    counted: Price;
    difference: Price;
    needsReview: number;
    signedOff: boolean;
  }[];
  staff: { name: string; sessions: number; short: Price; over: Price }[];
}

/**
 * `POST …/cash-register/open` (201 → `CashSession`; 409 register_open), `POST …/movements`
 * (→ `CashSession`; 409 register_closed) and `POST …/close` (→ the closed `CashSession`; 409
 * count_differs with `expected` and `difference` until a differing count comes with `note`;
 * 409 register_closed). Need `cash.manage`. A `count` must add up to its amount (400 `count`).
 */
export interface OpenRegisterRequest {
  float: Price;
  count?: DrawerCount;
}
export interface CashMovementRequest {
  kind: 'in' | 'out';
  amount: Price;
  reason: CashMovementReason;
  note?: string;
}
export interface CloseRegisterRequest {
  counted: Price;
  count?: DrawerCount;
  /** Card, UPI…: the machine's batch total or the statement's, as counted (optional). */
  methods?: { method: string; counted: Price }[];
  note?: string;
}
