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
