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
  /** The menu on its own (`{ menu }`), for Load a menu into a branch. */
  menuSample: unknown;
  /** The prompt for a menu only; the menu sample is its example. */
  menuPrompt: string;
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

/* ---------- Load a menu into a branch (any client's, demo or live) ---------- */

/** GET /dev/setup/clients: every client (demos first) and its live branches. */
export interface SetupClient {
  id: string;
  name: string;
  /** Still a Dev setup demo (not gone live). */
  demo: boolean;
  /** Its package's name; null: no plan. */
  plan: string | null;
  /** Dishes per branch its package allows; null: no limit. */
  dishLimit: number | null;
  branches: SetupClientBranch[];
}

export interface SetupClientBranch {
  id: string;
  name: string;
  shortName: string;
  city: string;
  country: string;
  currency: string;
  categories: number;
  dishes: number;
  orders: number;
}

/** The branch now: what it has, and what a replace would take with its menu. */
export interface MenuBranchState {
  id: string;
  name: string;
  restaurant: string;
  categories: number;
  dishes: number;
  orders: number;
  /** Dishes with a recipe (they go with them). */
  recipes: number;
  /** Offers naming its dishes or categories (those links go). */
  offers: number;
}

export interface MenuSummary {
  categories: number;
  dishes: number;
  chefsPicks: number;
}

/** POST /dev/setup/menu/check `{ branchId, data }`: what Load would do, nothing written. */
export interface MenuCheckResponse {
  valid: boolean;
  issues: SetupIssue[];
  warnings: string[];
  summary: MenuSummary | null;
  branch: MenuBranchState;
  /** It has a menu: Load needs `replace`. */
  replaces: boolean;
  /** It has taken orders: nothing can be loaded (the owner edits it in Admin). */
  blocked: boolean;
}

/** POST /dev/setup/menu/import. */
export interface MenuLoadRequest {
  branchId: string;
  /** The menu (`{ menu }` or a whole setup JSON), as pasted. */
  data: unknown;
  /** Replace the menu it has (only before its first order). */
  replace: boolean;
  /** The console's name, kept in the client's history. */
  by: string;
}

/**
 * POST /dev/setup/menu/import → 201. 409 conflict `hasMenu` (no `replace`) or `hasOrders`;
 * 403 plan_limit past the package's dishes; 400 `issues`.
 */
export interface MenuLoadResponse {
  branch: { id: string; name: string };
  summary: MenuSummary;
  warnings: string[];
  /** The dishes it had before (0: it was empty). */
  replaced: number;
}
