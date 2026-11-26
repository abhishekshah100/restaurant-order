import type { FloorPlanLayout } from '@/types/admin';
import type { BranchImage } from '@/types/branch';
import type {
  Allergen,
  Category,
  CategoryId,
  ComboInfo,
  Dish,
  DishAvailability,
  DishImage,
  DishTag,
  Price,
  SpiceLevel,
} from '@/types/menu';

/* ---------- The menu (staff) ---------- */

/* ---------- The menu (staff) ---------- */

/**
 * `GET /branches/:id/menu` is the menu everyone reads, staff changes included (the guest app
 * reads it again after a minute and on returning to the tab). Staff change it with these, each
 * authorised like GET /admin/branches; errors 401, 403 and 404 not_found for an unknown dish.
 */

/**
 * `PATCH /admin/branches/:branchId/menu/dishes/:slug/availability` — the most common change:
 * sold out (optionally until a time guests read, "8 PM"), off for the day, or back on; and
 * sizes switched off or on (`variants`: `{ "full": false }`). 200 → `DishResponse`. Errors: 400
 * (an unknown status or size).
 */
export interface SetAvailabilityRequest {
  availability: DishAvailability;
  /** By size id: false to switch a size off, true to put it back. */
  variants?: Record<string, boolean>;
}

/**
 * Everything staff set on a dish: name, short and long description, category, veg or not, tags,
 * spice, prep time and serves; one price or sizes (each named, priced and on or off;
 * the cheapest is the "from" price) with their label ("Portion"); choice groups (each with two or
 * more choices and their extra price, optionally only with some sizes — a meal's slots are choice
 * groups); add-ons (free or priced, optionally per size or only with some sizes) and how many can
 * be picked; ingredients guests can leave out; quick kitchen instructions; a meal's contents and
 * saving; allergens; the picture (POST …/menu/images first); and availability. A new size,
 * group, add-on or ingredient may bring its own id (a-z, 0-9, -) so others can refer to it.
 */
export interface DishInput {
  name: string;
  description: string;
  longDescription?: string;
  categoryId: CategoryId;
  veg: boolean;
  tags: DishTag[];
  spice?: SpiceLevel;
  prepTime?: string;
  serves?: number;
  /** Without sizes. */
  price?: Price;
  /** One or more (one: a named size, "Regular · 350 ml"). */
  variants?: {
    id?: string;
    name: string;
    /** A note under the size, e.g. "Perfect for one". */
    description?: string;
    price: Price;
    available?: boolean;
  }[];
  variantLabel?: string;
  optionGroups?: {
    id?: string;
    name: string;
    showInSummary?: boolean;
    /** Size ids it's offered with (none: every size). */
    availableFor?: string[];
    choices: { name: string; price?: Price; availableFor?: string[] }[];
  }[];
  addOns?: {
    id?: string;
    name: string;
    price: Price;
    availableFor?: string[];
    priceByVariant?: Record<string, Price>;
  }[];
  maxAddOns?: number;
  removables?: { id?: string; name: string }[];
  quickInstructions?: string[];
  combo?: ComboInfo;
  allergens: Allergen[];
  /** Absent: no picture. */
  image?: DishImage;
  /** The small copy uploaded with a new picture (rows, cart, orders); absent: the picture. */
  thumb?: DishImage;
  availability: DishAvailability;
}

/**
 * `POST /admin/branches/:branchId/menu/dishes` — a new dish, last in its category, its slug made
 * from the name. 201 → `DishResponse`. `PATCH /admin/branches/:branchId/menu/dishes/:slug` —
 * the dish as staff left it (moved to another category: last there). 200 → `DishResponse`.
 * Errors: 400 (a missing name, an unknown category, no price, no size, fewer than two choices, a
 * name used twice in a list, an add-on limit above the add-ons, a size id that isn't the dish's).
 * `DELETE /admin/branches/:branchId/menu/dishes/:slug` — off the menu for good (and out of the
 * curated lists). 204.
 */
export type DishResponse = Dish;

/**
 * `PATCH /admin/branches/:branchId/menu/categories/:categoryId/order` — the order guests see a
 * category's dishes in (its "Recommended" order): `slugs`, exactly the category's dishes. 200 →
 * the menu. Errors: 400, 404 (no such category). `PATCH /admin/branches/:branchId/menu/categories`
 * — the categories renamed (name, short name, description) and in their order: exactly the
 * menu's categories (adding or removing one needs the guest pages built again). 200 → the menu.
 */
export interface ReorderDishesRequest {
  slugs: string[];
}

export interface UpdateCategoriesRequest {
  categories: Pick<Category, 'id' | 'name' | 'shortName' | 'description'>[];
}

/**
 * `POST /admin/branches/:branchId/menu/images` — a dish picture, resized by the app (WebP or
 * JPEG, at most 640 px), with its small copy. 201 → `{ image, thumb }` to put on the dish. Errors: 400 (not a JPEG / PNG / WebP data URL,
 * or too large). Mock: the data URL itself is the picture's `src`.
 */
export interface ImageUploadRequest {
  dataUrl: string;
  width: number;
  height: number;
  /** A dish picture's small copy (short side 192 px), kept as its thumbnail. */
  thumb?: { dataUrl: string; width: number; height: number };
  /**
   * POST …/settings/image only: what the picture is for, the branch photo (the default) or a
   * payment QR (Settings › Payment QR codes; kept sharp so it scans).
   */
  purpose?: 'branch' | 'qr';
}

export interface ImageUploadResponse {
  image: DishImage;
  /** The small copy, when one was sent: saved with the dish as its `thumb`. */
  thumb?: DishImage;
}

/**
 * `POST /admin/branches/:branchId/settings/image` — the branch photo, resized by the app (JPEG,
 * same body as a dish picture). 201 → `{ image }` to save with Settings › Details. Needs
 * `branch.settings.manage`. Mock: the data URL itself is the photo's `src`.
 */
export interface BranchImageUploadResponse {
  image: BranchImage;
}

/**
 * `GET /branches/:branchId/menu/suggestions` — what the search screen shows before the guest
 * types: staff's picks first, then (when auto-fill is on) what was ordered. "Trending tonight":
 * dishes ordered most today, then this week (with a photo); "Popular at…": the names of dishes
 * ordered most in 30 days. Dishes that can't be ordered now are left out. Mock: staff's picks
 * only (it doesn't count orders).
 */
export interface SearchSuggestions {
  /** Dish slugs. */
  trending: string[];
  /** Search words. */
  popular: string[];
}

export type TrendingSource = 'pinned' | 'today' | 'week';

export type PopularSource = 'word' | 'orders';

/**
 * `GET /admin/branches/:branchId/menu/suggestions` (`menu.manage`) — the same, with where each
 * suggestion came from (Admin › Menu › Search suggestions), and staff's pins and words.
 */
export interface AdminSearchSuggestions {
  trending: {
    auto: boolean;
    /** Pinned dishes; `showing: false` while guests can't order it (sold out, off today). */
    pins: { slug: string; name: string; showing: boolean }[];
    showing: { slug: string; name: string; source: TrendingSource; count?: number }[];
  };
  popular: {
    auto: boolean;
    words: string[];
    showing: { term: string; source: PopularSource; slug?: string; count?: number }[];
  };
}

/**
 * `PATCH /admin/branches/:branchId/menu/suggestions` — replaces the pins (up to 4 live dishes),
 * the words (up to 6, 1–40 characters, each once) and the auto-fill switches. 200 →
 * AdminSearchSuggestions. 400 `{ field, reason }` otherwise.
 */
export interface UpdateSearchSuggestionsRequest {
  trending: { auto: boolean; pins: string[] };
  popular: { auto: boolean; words: string[] };
}

/**
 * `GET /sessions/:id/wifi` — the branch's guest Wi-Fi for a guest seated at a table (the
 * password is for them only): null where there's none, or for takeaway and delivery.
 */
export interface SessionWifiResponse {
  wifi: { name: string; password: string } | null;
}

/** Why a dish is suggested in the cart: pinned by staff, ordered together, popular, or the menu. */
export type CartSuggestionSource = 'pinned' | 'together' | 'popular' | 'menu';

export interface CartSuggestion {
  slug: string;
  name: string;
  source: CartSuggestionSource;
  /** "together": the cart dish it's most often ordered with (its name). */
  withName?: string;
  /** "together": orders with both (30 days); "popular": times ordered (30 days). */
  count?: number;
}

/**
 * `GET /branches/:branchId/menu/cart-suggestions?dishes=a,b` — "Goes well with your order": up
 * to 3 dishes, never one in the cart or one that can't be ordered. Staff's pins first, then
 * dishes ordered together with the cart's (in 3+ orders, 30 days), then the most ordered, then
 * the menu, each from the chosen categories. None when switched off. Mock: pins, then the menu.
 */
export interface CartSuggestionsResponse {
  dishes: CartSuggestion[];
}

/**
 * `GET /admin/branches/:branchId/menu/cart-suggestions[?preview=slug]` (`menu.manage`) — the
 * switch, the categories (codes; none: any the cart has nothing from) and the pins (up to 3), and
 * what a guest with `preview` in the cart would see (shown even while switched off).
 */
export interface AdminCartSuggestions {
  enabled: boolean;
  categories: string[];
  pins: { slug: string; name: string; showing: boolean }[];
  preview: { dish: string | null; dishes: CartSuggestion[] };
}

/** `PATCH /admin/branches/:branchId/menu/cart-suggestions[?preview=slug]` → AdminCartSuggestions. */
export interface UpdateCartSuggestionsRequest {
  enabled: boolean;
  categories: string[];
  pins: string[];
}

/**
 * `GET /admin/branches/:branchId/floors` — the branch's floor plan as staff set it up (the
 * floors.json shape: areas in the order staff walk them, each with its tables and seats).
 * Authorised like GET /admin/branches. 200 → `FloorPlanLayout`. Errors: 401, 403.
 *
 * `PATCH /admin/branches/:branchId/floors` — replaces it (Settings › Floor plan): areas added,
 * renamed, reordered or removed; tables added, renumbered, moved or removed. Everything that
 * reads the floor plan follows (the Tables page, table pages and QR codes, reservations, the
 * tables guests can scan). A table may be out of service (`disabled: true`): it stays on the
 * plan, but guests, waiters and bookings are refused there (409 table_disabled). A table that's
 * left out (removed, or renumbered) or taken out of service mustn't have an open order or bill
 * today or a booking still to come. 200 → `FloorPlanLayout`. Errors: 400
 * invalid_request (lib/floorLayout › layoutErrors), 401, 403, 409 table_in_use (`tables`).
 */
export type UpdateFloorsRequest = FloorPlanLayout;
