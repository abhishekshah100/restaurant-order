/*
 * The developer setup page (restaurant-backend › /v1/dev/setup, ADR-047): a client's restaurant
 * made in one go from one JSON before a demo. Every request carries the developer key
 * (`X-Dev-Key`), never a staff token.
 */

export type SetupStaffRole = 'admin' | 'manager' | 'waiter' | 'kitchen';

/** Where the JSON is wrong ("menu.dishes[4].categoryId") and what's wrong there. */
export interface SetupIssue {
  path: string;
  message: string;
}

export interface SetupSummary {
  restaurant: string;
  branch: string;
  country: string;
  currency: string;
  floors: number;
  tables: number;
  staff: { name: string; role: SetupStaffRole }[];
  categories: number;
  dishes: number;
}

/** POST /dev/setup/check `{ data }`: what Import would do, nothing written. */
export interface SetupCheckResponse {
  valid: boolean;
  issues: SetupIssue[];
  warnings: string[];
  summary: SetupSummary | null;
  /** Made here before under the same name: Import replaces it only with `replace`. */
  existing: { id: string; name: string; createdAt: string } | null;
}

/** POST /dev/setup/import. */
export interface SetupImportRequest {
  /** The client's JSON, as pasted. */
  data: unknown;
  /** Delete the restaurant made here before under this name (and all it has) first. */
  replace: boolean;
}

/** POST /dev/setup/import → 201. */
export interface SetupImportResponse {
  restaurant: { id: string; name: string; slug: string };
  branch: { id: string; name: string; country: string; currency: string };
  /** Each table's signed QR token: its link is `/?branch=<id>&table=<n>&qr=<token>`. */
  tables: { number: number; qrToken: string }[];
  /** Sign-ins, passwords included: shown once. */
  staff: {
    name: string;
    role: SetupStaffRole;
    email: string;
    phone: string;
    phoneNational: string;
    password: string;
  }[];
  summary: SetupSummary;
  warnings: string[];
  replaced: boolean;
}

/** GET /dev/setup/templates: what the page offers to download. */
export interface SetupTemplates {
  /** A sample of the JSON, using every part of it (placeholders in capitals). */
  sample: unknown;
  /** The prompt to paste into Claude with the menu photos; the sample is its example. */
  prompt: string;
}

/** GET /dev/setup/restaurants: those made there, newest first. */
export interface SetupRestaurant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  features: string[];
  branches: { id: string; name: string; country: string; currency: string; tables: number }[];
  staff: { name: string; role: string; email: string; phoneNational: string }[];
  dishes: number;
  orders: number;
}
