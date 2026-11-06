/*
 * Inventory (backend only; restaurant-backend › src/modules/inventory/inventory.types.ts). The
 * restaurant's ingredients are shared by its branches; each branch keeps its own stock and ledger.
 * Quantities are in the ingredient's own unit (`unit`), money in major units. Costs and values
 * come only to staff with `inventory.manage` or `reports.view`.
 */

/** The units ingredients are kept in (lib/inventory › UNITS). */
export type InventoryUnit = 'g' | 'kg' | 'ml' | 'l' | 'pc' | 'dozen';

/** Out at nothing or less; low at or below the reorder level. */
export type StockStatus = 'ok' | 'low' | 'out';

export type StockMovementKind =
  | 'opening'
  | 'adjustment'
  | 'wastage'
  | 'revaluation'
  | 'consumption'
  | 'production_in'
  | 'production_out'
  | 'purchase'
  | 'purchase_return'
  | 'purchase_price'
  | 'count'
  | 'transfer_out'
  | 'transfer_in';
export type AdjustmentReason = 'correction' | 'found' | 'missing' | 'other';
export type WastageReason =
  'expired' | 'spoiled' | 'damaged' | 'kitchen_mistake' | 'spilled' | 'guest_return' | 'other';
/** Also an order item's stock given back (`returned`), or taken then cancelled (`cancelled`). */
export type StockReason =
  AdjustmentReason | WastageReason | 'returned' | 'cancelled' | 'wrong_item' | 'excess';

export interface IngredientCategory {
  id: string;
  name: string;
  rank: number;
}

export interface IngredientPack {
  id: string;
  name: string;
  /** How much one holds, in the ingredient's unit. */
  quantity: number;
}

/** One of the restaurant's ingredients, and whether this branch tracks it. */
export interface Ingredient {
  id: string;
  name: string;
  categoryId: string | null;
  unit: InventoryUnit;
  sku?: string;
  packs: IngredientPack[];
  tracked: boolean;
  /** Made in batches: how much one batch makes (its unit) and what it uses. */
  prep?: PrepRecipe;
  /** Kept in batches with expiry dates: how long it keeps, how early to warn. */
  expiry?: ExpirySettings;
}

export interface ExpirySettings {
  /** Days it keeps once received or made (prefills a batch's date); none: entered each time. */
  shelfLifeDays?: number;
  warnDays: number;
}

export interface PrepRecipe {
  batchQuantity: number;
  lines: { ingredientId: string; name: string; unit: InventoryUnit; quantity: number }[];
}

export interface IngredientsResponse {
  categories: IngredientCategory[];
  ingredients: Ingredient[];
}

/** An ingredient the branch tracks, and what it has. */
export interface StockItem {
  ingredientId: string;
  name: string;
  categoryId: string | null;
  unit: InventoryUnit;
  sku?: string;
  onHand: number;
  reorderLevel: number;
  parLevel: number;
  status: StockStatus;
  /** Its stock never moved: opening stock can still be entered. */
  openingDue: boolean;
  lastMovedAt?: string;
  /** Per unit, and what's on hand is worth (managers and reports only). */
  cost?: number;
  value?: number;
  /** Items that track expiry: the next last good day, and how much is near it, past it, undated. */
  expiry?: StockExpiry;
}

export type ExpiryState = 'ok' | 'expiring' | 'expired' | 'unknown';

export interface StockExpiry {
  next?: string;
  expiring: number;
  expired: number;
  undated: number;
}

export interface StockSummary {
  tracked: number;
  low: number;
  out: number;
  value?: number;
  wastedToday?: number;
  /** Items near or past expiry; what's past it is worth. */
  expiring: number;
  expired: number;
  expiredValue?: number;
}

export interface StockResponse {
  items: StockItem[];
  summary: StockSummary;
}

/** One row of the stock ledger. */
export interface StockMovement {
  id: string;
  entryId: string;
  ingredientId: string;
  name: string;
  unit: InventoryUnit;
  kind: StockMovementKind;
  /** Signed: in is positive, out negative. */
  quantity: number;
  balanceAfter: number;
  reason?: StockReason;
  note?: string;
  at: string;
  by?: string;
  cost?: number;
  value?: number;
  /** Items that track expiry: the batches it took from or put into. */
  batches?: { quantity: number; expiresOn?: string; lot?: string }[];
}

export interface StockItemResponse {
  item: StockItem;
  movements: StockMovement[];
  next?: string;
}

export interface MovementsResponse {
  movements: StockMovement[];
  next?: string;
}

export interface StockEntryResponse {
  entryId: string;
  items: StockItem[];
}

export interface StockAlert {
  ingredientId: string;
  name: string;
  unit: InventoryUnit;
  onHand: number;
  reorderLevel: number;
  status: 'low' | 'out';
}

export interface StockAlertsResponse {
  low: number;
  out: number;
  items: StockAlert[];
  /** Items near or past expiry; the batches to use first (or write off), soonest first. */
  expiring: number;
  expired: number;
  useFirst: ExpiryAlert[];
}

export interface ExpiryAlert {
  batchId: string;
  ingredientId: string;
  name: string;
  unit: InventoryUnit;
  expiresOn?: string;
  /** 0: its last day; below 0: expired. */
  daysLeft?: number;
  quantity: number;
  state: 'expiring' | 'expired' | 'unknown';
}

/** A batch of an item that tracks expiry. */
export interface StockBatch {
  id: string;
  ingredientId: string;
  name: string;
  unit: InventoryUnit;
  expiresOn?: string;
  daysLeft?: number;
  state: ExpiryState;
  lot?: string;
  receivedAt: string;
  source: string;
  quantityIn: number;
  left: number;
  value?: number;
}

export interface BatchesResponse {
  batches: StockBatch[];
}

export type UpdateBatchRequest = Partial<{
  expiresOn: string;
  lot: string | null;
  split: { quantity: number; expiresOn: string };
}>;

export interface WriteOffRequest {
  entryId: string;
  lines: { batchId: string; quantity?: number }[];
  note?: string;
}

/** Tracks expiry with these (an update's null: stops). */
export interface ExpiryInput {
  shelfLifeDays?: number | null;
  warnDays?: number;
}

/* ---------- Requests ---------- */

export interface PackInput {
  name: string;
  quantity: number;
}

export interface PrepInput {
  batchQuantity: number;
  lines: { ingredientId: string; quantity: number; unit?: InventoryUnit }[];
}

export interface CreateIngredientRequest {
  prep?: PrepInput | null;
  name: string;
  unit: InventoryUnit;
  categoryId?: string | null;
  sku?: string;
  packs?: PackInput[];
  track?: boolean;
  reorderLevel?: number;
  expiry?: ExpiryInput;
}

export type UpdateIngredientRequest = Partial<{
  name: string;
  unit: InventoryUnit;
  categoryId: string | null;
  sku: string | null;
  packs: PackInput[];
  prep: PrepInput | null;
  expiry: ExpiryInput | null;
}>;

export type UpdateStockRequest = Partial<{
  tracked: boolean;
  reorderLevel: number;
  parLevel: number;
  cost: number;
}>;

/** How a line's quantity is given: the ingredient's unit, another of its measure, or packs. */
interface LineMeasure {
  ingredientId: string;
  unit?: InventoryUnit;
  packId?: string;
}

export interface OpeningLine extends LineMeasure {
  quantity: number;
  cost: number;
  /** Items that track expiry: its last good day. */
  expiresOn?: string;
}

export interface AdjustmentLine extends LineMeasure {
  change?: number;
  counted?: number;
  reason: AdjustmentReason;
  note?: string;
}

export interface WastageLine extends LineMeasure {
  quantity: number;
  reason: WastageReason;
  note?: string;
}

/** One submission; `entryId` (made up by the app) makes sending it again harmless. */
export interface StockEntryRequest<L> {
  entryId?: string;
  lines: L[];
}

export interface MovementsQuery {
  from?: string;
  to?: string;
  kind?: StockMovementKind;
  ingredient?: string;
  before?: string;
}

/* ---------- Recipes (Inv-B) ---------- */

export type RecipePart = 'dish' | 'size' | 'addon' | 'choice' | 'removal';

/** A portion's price (before tax), cost and cost as a percentage of the price. */
export interface PortionCost {
  price: number;
  cost: number;
  foodCost?: number;
}

export interface RecipeSummary {
  slug: string;
  name: string;
  category: string;
  /** Recipe lines (0: no recipe, it uses no stock). */
  lines: number;
  portions: ({ code?: string; name?: string; price: number } & Partial<PortionCost>)[];
  soldOutByStock: boolean;
  unknownParts: number;
}

export interface RecipesResponse {
  foodCostTarget: number;
  dishes: RecipeSummary[];
}

export interface RecipeLineView {
  part: RecipePart;
  code?: string;
  choice?: string;
  ingredientId: string;
  name: string;
  unit: InventoryUnit;
  quantity: number;
  unknown?: boolean;
  cost?: number;
}

export interface RecipeResponse {
  dish: {
    slug: string;
    name: string;
    price?: number;
    sizes: { code: string; name: string; price: number }[];
    addOns: { code: string; name: string; price: number }[];
    options: { code: string; name: string; choices: { name: string; price: number }[] }[];
    removables: { code: string; name: string }[];
  };
  lines: RecipeLineView[];
  foodCostTarget: number;
  portions?: ({ code?: string } & PortionCost)[];
}

export interface RecipeLineInput {
  part: RecipePart;
  code?: string;
  choice?: string;
  ingredientId: string;
  quantity: number;
  unit?: InventoryUnit;
}

export interface ProductionRequest {
  entryId?: string;
  ingredientId: string;
  quantity: number;
  unit?: InventoryUnit;
  note?: string;
  /** Items that track expiry: the batch's last good day. */
  expiresOn?: string;
}

/* ---------- Control (Inv-D): counts, transfers, usage, dashboard ---------- */

export type CountStatus = 'counting' | 'submitted' | 'applied' | 'cancelled';

export interface CountLine {
  ingredientId: string;
  name: string;
  categoryId: string | null;
  unit: InventoryUnit;
  packs: { id: string; name: string; quantity: number }[];
  counted?: number;
  /** Not blind only. */
  expected?: number;
  difference?: number;
  value?: number;
  big?: boolean;
  note?: string;
}

export interface StockCount {
  id: string;
  number: number;
  scope: 'all' | 'category' | 'items';
  status: CountStatus;
  note?: string;
  startedAt: string;
  startedBy?: string;
  submittedAt?: string;
  submittedBy?: string;
  appliedAt?: string;
  appliedBy?: string;
  counted: number;
  total: number;
  differenceValue?: number;
  blind: boolean;
  lines: CountLine[];
}

export interface CountsResponse {
  counts: Omit<StockCount, 'lines'>[];
}

export type TransferStatus = 'sent' | 'received' | 'cancelled';

export interface StockTransfer {
  id: string;
  number: number;
  direction: 'out' | 'in';
  from: { id: string; name: string };
  to: { id: string; name: string };
  status: TransferStatus;
  note?: string;
  sentAt: string;
  sentBy?: string;
  endedAt?: string;
  receivedBy?: string;
  lines: {
    ingredientId: string;
    name: string;
    unit: InventoryUnit;
    quantity: number;
    received?: number;
    lost?: number;
    value?: number;
    lostValue?: number;
  }[];
  value?: number;
  lostValue?: number;
}

export interface TransfersResponse {
  transfers: StockTransfer[];
  branches: { id: string; name: string }[];
}

export interface UsageFigures {
  opening: number;
  cameIn: number;
  closing: number;
  actual: number;
  theoretical: number;
  wastage: number;
  unexplained: number;
}

export interface UsageRow {
  ingredientId: string;
  name: string;
  categoryId: string | null;
  unit: InventoryUnit;
  quantity: UsageFigures;
  value?: UsageFigures;
}

export interface UsageResponse {
  from: string;
  to: string;
  countedAt?: string;
  rows: UsageRow[];
  categories: { id: string | null; name: string; value?: UsageFigures }[];
  total?: UsageFigures;
  sales?: number;
  foodCost?: { theoretical?: number; actual?: number };
}

export interface DashboardBranch {
  branchId: string;
  name: string;
  stockValue?: number;
  low: number;
  out: number;
  wastedWeek?: number;
  purchasedMonth?: number;
  foodCost?: { theoretical?: number; actual?: number };
  lastCount?: { number: number; at: string; differenceValue?: number };
}

export interface InventoryDashboard extends DashboardBranch {
  todo: {
    countsToApply: number;
    transfersToReceive: number;
    expiring: number;
    expired: number;
    pricesToConfirm: number;
    ordersToApprove: number;
    deliveriesDue: number;
  };
  valueTrend?: { day: string; value: number }[];
  wastageByReason: { reason: string; quantityItems: number; value?: number }[];
  topUsed: {
    ingredientId: string;
    name: string;
    unit: InventoryUnit;
    quantity: number;
    value?: number;
  }[];
  priceMoves?: {
    ingredientId: string;
    name: string;
    unit: InventoryUnit;
    from: number;
    to: number;
    change: number;
  }[];
  branches?: DashboardBranch[];
}

export interface SendTransferRequest {
  entryId: string;
  toBranchId: string;
  note?: string;
  lines: { ingredientId: string; quantity: number; unit?: InventoryUnit; packId?: string }[];
}
