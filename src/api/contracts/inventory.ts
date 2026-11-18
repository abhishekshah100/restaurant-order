/* ---------- Inventory (backend only) ---------- */

/*
 * `/admin/branches/:branchId/inventory` (types/inventory.ts). Costs and values only with
 * `inventory.manage` or `reports.view`.
 * - `GET /stock` → StockResponse; `GET /stock/:ingredientId?before=` → StockItemResponse;
 *   `GET /movements?from=&to=&kind=&ingredient=&before=` → MovementsResponse (`inventory.view`).
 * - `GET /ingredients` → IngredientsResponse; `GET /alerts` → StockAlertsResponse (any inventory
 *   permission: the kitchen's wastage too).
 * - `PATCH /stock/:ingredientId` (tracked, levels, cost) → StockItem; `POST /opening` → 409
 *   opening_done; ingredients `POST`, `PATCH`/`DELETE /ingredients/:id` (409 name_taken,
 *   ingredient_in_use); categories `POST`, `PATCH`/`DELETE /categories/:id` (`inventory.manage`).
 * - `POST /adjustments` (`inventory.adjust`), `POST /wastage` (`inventory.wastage`) →
 *   StockEntryResponse; 409 not_tracked (`ingredients`: names).
 */
export type * from '@/types/inventory';

/*
 * `/admin/branches/:branchId/purchasing` (types/purchasing.ts): suppliers and their items, purchase
 * orders (approve above the branch's limit, send, cancel, close, suggest), deliveries (receive,
 * confirm prices, price changes) and returns. `purchasing/proofs` keeps invoice photos.
 */
export type * from '@/types/purchasing';
