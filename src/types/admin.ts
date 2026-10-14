import type { BranchImage, BranchStatus, CountryCode, OrderMode } from './branch';

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
  /** Today's opening hours as shown, in the branch's local time: "11:00 AM – 10:00 PM". */
  hoursToday: string;
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
