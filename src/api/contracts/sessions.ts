import type { OrderMode } from '@/types/branch';
import type { GuestSession, SessionStart } from '@/types/session';

/* ---------- Sessions ---------- */

/**
 * `POST /sessions` — open a guest session: dine-in at a branch's table (one per QR scan and
 * device: `{ branchId, mode: 'dineIn', table, qrToken? }`), or takeaway / delivery from an outlet
 * (`{ branchId, mode, deliveryArea? }`). A table scan must carry the table's signed `qrToken`
 * (GET /admin/branches/:id/tables/qr-codes): editing the table in the link breaks the signature.
 * The server opens the session and decides when it expires. 201 → the session. Errors: 400
 * invalid_request (unknown branch, table outside its range, a mode the branch doesn't offer),
 * 403 qr_invalid (no token, or not this table's), 409 table_disabled, 422 area_not_served.
 */
export type CreateSessionRequest = SessionStart;
export type CreateSessionResponse = GuestSession;

/**
 * `GET /sessions/:id` — the session as it is, while it's live. 200 → `GuestSession`. Errors: 404
 * session_not_found once it ended: it expired, or staff freed its table (`POST
 * /admin/branches/:branchId/tables/:table/free` ends every session open at the table, so the
 * next scan starts a new visit). The app checks a session it kept before going on with it.
 * Backend only.
 */
export type SessionResponse = GuestSession;

/**
 * `PATCH /sessions/:id` — order another way, or to another delivery area, in the same session
 * (the cart, checkout and orders stay with it). 200 → the session. Errors: 400
 * invalid_request, 404 session_not_found, 409 mode_unavailable (dine-in without a table, or a
 * mode the branch doesn't offer), 422 area_not_served.
 */
export interface UpdateSessionRequest {
  mode?: OrderMode;
  deliveryArea?: string;
}
