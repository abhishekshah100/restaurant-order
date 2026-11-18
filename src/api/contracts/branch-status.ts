/* ---------- The branch's status (staff) ---------- */

/**
 * `PATCH /admin/branches/:branchId/status` — staff pause new orders for a while (the kitchen is
 * swamped), close for the rest of the day, or open again. Paused and closed are reported on GET
 * /branches (`status`, `pausedForMinutes`, `reopensTomorrow`), so guests see the paused or closed
 * screen within a minute, and guests' orders and payments for new food are refused (409
 * ordering_unavailable); waiters can still take orders at the table. A pause ends by itself
 * after its minutes; a day closed opens again at the next day's opening time. 200 → the
 * branch as `AdminBranch` (with `statusUntil`). Errors: 400 (another status, or minutes not
 * 15, 30, 45, 60 or 90), 401, 403.
 */
export type SetBranchStatusRequest =
  { status: 'open' } | { status: 'paused'; minutes: 15 | 30 | 45 | 60 | 90 } | { status: 'closed' };
