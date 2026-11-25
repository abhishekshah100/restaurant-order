import type {
  AdjustmentLine,
  CreateIngredientRequest,
  Ingredient,
  IngredientCategory,
  IngredientsResponse,
  MovementsQuery,
  MovementsResponse,
  OpeningLine,
  ProductionRequest,
  RecipeLineInput,
  RecipeResponse,
  RecipesResponse,
  StockAlertsResponse,
  CountsResponse,
  BatchesResponse,
  UpdateBatchRequest,
  WriteOffRequest,
  InventoryDashboard,
  SendTransferRequest,
  StockCount,
  StockTransfer,
  TransfersResponse,
  UsageResponse,
  StockEntryRequest,
  StockEntryResponse,
  StockItem,
  StockItemResponse,
  StockResponse,
  UpdateIngredientRequest,
  UpdateStockRequest,
  WastageLine,
} from '@/types/inventory';
import { apiDelete, apiGet, apiPatch, apiPost, backendBlob } from '../client';
import type { PaymentProofRequest, PaymentProofResponse } from '../contracts';
import { bearer, inventory, searchOf, seg } from './shared';

/** Inventory: stock, ingredients, counts, transfers, recipes. */
export const inventoryApi = {
  inventoryStock: (token: string, branchId: string) =>
    apiGet<StockResponse>(`${inventory(branchId)}/stock`, bearer(token)),
  inventoryItem: (token: string, branchId: string, ingredientId: string, before?: string) =>
    apiGet<StockItemResponse>(
      `${inventory(branchId)}/stock/${seg(ingredientId)}${searchOf({ before })}`,
      bearer(token),
    ),
  updateInventoryItem: (
    token: string,
    branchId: string,
    ingredientId: string,
    body: UpdateStockRequest,
  ) =>
    apiPatch<StockItem>(`${inventory(branchId)}/stock/${seg(ingredientId)}`, body, bearer(token)),
  inventoryMovements: (token: string, branchId: string, query: MovementsQuery) =>
    apiGet<MovementsResponse>(`${inventory(branchId)}/movements${searchOf(query)}`, bearer(token)),
  inventoryAlerts: (token: string, branchId: string) =>
    apiGet<StockAlertsResponse>(`${inventory(branchId)}/alerts`, bearer(token)),
  ingredients: (token: string, branchId: string) =>
    apiGet<IngredientsResponse>(`${inventory(branchId)}/ingredients`, bearer(token)),
  createIngredient: (token: string, branchId: string, body: CreateIngredientRequest) =>
    apiPost<Ingredient>(`${inventory(branchId)}/ingredients`, body, bearer(token)),
  updateIngredient: (token: string, branchId: string, id: string, body: UpdateIngredientRequest) =>
    apiPatch<Ingredient>(`${inventory(branchId)}/ingredients/${seg(id)}`, body, bearer(token)),
  archiveIngredient: (token: string, branchId: string, id: string) =>
    apiDelete(`${inventory(branchId)}/ingredients/${seg(id)}`, bearer(token)),
  createIngredientCategory: (token: string, branchId: string, name: string) =>
    apiPost<IngredientCategory>(`${inventory(branchId)}/categories`, { name }, bearer(token)),
  updateIngredientCategory: (
    token: string,
    branchId: string,
    id: string,
    body: { name?: string; rank?: number },
  ) =>
    apiPatch<IngredientCategory>(
      `${inventory(branchId)}/categories/${seg(id)}`,
      body,
      bearer(token),
    ),
  deleteIngredientCategory: (token: string, branchId: string, id: string) =>
    apiDelete(`${inventory(branchId)}/categories/${seg(id)}`, bearer(token)),
  openingStock: (token: string, branchId: string, body: StockEntryRequest<OpeningLine>) =>
    apiPost<StockEntryResponse>(`${inventory(branchId)}/opening`, body, bearer(token)),
  adjustStock: (token: string, branchId: string, body: StockEntryRequest<AdjustmentLine>) =>
    apiPost<StockEntryResponse>(`${inventory(branchId)}/adjustments`, body, bearer(token)),
  wasteStock: (
    token: string,
    branchId: string,
    body: StockEntryRequest<WastageLine> & { proofs?: string[] },
  ) => apiPost<StockEntryResponse>(`${inventory(branchId)}/wastage`, body, bearer(token)),
  /** POST …/inventory/proofs: a wastage photo (as a payment's proof), its key back. */
  uploadInventoryProof: (token: string, branchId: string, body: PaymentProofRequest) =>
    apiPost<PaymentProofResponse>(`${inventory(branchId)}/proofs`, body, bearer(token)),
  /** A wastage photo's bytes (private). Backend only. */
  inventoryProof: (token: string, branchId: string, key: string) =>
    backendBlob(`${inventory(branchId)}/proofs/${seg(key)}`, bearer(token)),
  stockBatches: (
    token: string,
    branchId: string,
    query: { ingredient?: string; status?: 'expiring' | 'expired' | 'unknown' },
  ) => apiGet<BatchesResponse>(`${inventory(branchId)}/batches${searchOf(query)}`, bearer(token)),
  updateBatch: (token: string, branchId: string, id: string, body: UpdateBatchRequest) =>
    apiPatch<BatchesResponse>(`${inventory(branchId)}/batches/${seg(id)}`, body, bearer(token)),
  writeOffBatches: (token: string, branchId: string, body: WriteOffRequest) =>
    apiPost<StockEntryResponse>(`${inventory(branchId)}/batches/write-off`, body, bearer(token)),
  inventoryDashboard: (token: string, branchId: string, scope: 'branch' | 'restaurant') =>
    apiGet<InventoryDashboard>(
      `${inventory(branchId)}/dashboard${searchOf({ scope })}`,
      bearer(token),
    ),
  stockCounts: (token: string, branchId: string) =>
    apiGet<CountsResponse>(`${inventory(branchId)}/counts`, bearer(token)),
  stockCount: (token: string, branchId: string, id: string) =>
    apiGet<StockCount>(`${inventory(branchId)}/counts/${seg(id)}`, bearer(token)),
  startCount: (
    token: string,
    branchId: string,
    body: {
      scope: 'all' | 'category' | 'items';
      categoryId?: string;
      ingredientIds?: string[];
      note?: string;
    },
  ) => apiPost<StockCount>(`${inventory(branchId)}/counts`, body, bearer(token)),
  saveCountLines: (
    token: string,
    branchId: string,
    id: string,
    lines: { ingredientId: string; counted: number | null; unit?: string }[],
  ) =>
    apiPatch<StockCount>(
      `${inventory(branchId)}/counts/${seg(id)}/lines`,
      { lines },
      bearer(token),
    ),
  countStep: (
    token: string,
    branchId: string,
    id: string,
    step: 'submit' | 'apply' | 'cancel',
    body: { notes?: { ingredientId: string; note: string }[] } = {},
  ) => apiPost<StockCount>(`${inventory(branchId)}/counts/${seg(id)}/${step}`, body, bearer(token)),
  stockTransfers: (token: string, branchId: string) =>
    apiGet<TransfersResponse>(`${inventory(branchId)}/transfers`, bearer(token)),
  sendTransfer: (token: string, branchId: string, body: SendTransferRequest) =>
    apiPost<StockTransfer>(`${inventory(branchId)}/transfers`, body, bearer(token)),
  transferStep: (
    token: string,
    branchId: string,
    id: string,
    step: 'receive' | 'cancel',
    body: { lines?: { ingredientId: string; received: number }[] } = {},
  ) =>
    apiPost<StockTransfer>(
      `${inventory(branchId)}/transfers/${seg(id)}/${step}`,
      body,
      bearer(token),
    ),
  inventoryUsage: (token: string, branchId: string, range: { from?: string; to?: string }) =>
    apiGet<UsageResponse>(`${inventory(branchId)}/usage${searchOf(range)}`, bearer(token)),
  /** A CSV export's bytes (backend only). */
  inventoryExport: (
    token: string,
    branchId: string,
    kind: 'ledger' | 'usage' | 'count',
    query: { from?: string; to?: string; id?: string },
  ) => backendBlob(`${inventory(branchId)}/exports/${kind}${searchOf(query)}`, bearer(token)),
  produceStock: (token: string, branchId: string, body: ProductionRequest) =>
    apiPost<StockEntryResponse>(`${inventory(branchId)}/production`, body, bearer(token)),
  recipes: (token: string, branchId: string) =>
    apiGet<RecipesResponse>(`${inventory(branchId)}/recipes`, bearer(token)),
  recipe: (token: string, branchId: string, slug: string) =>
    apiGet<RecipeResponse>(`${inventory(branchId)}/recipes/${seg(slug)}`, bearer(token)),
  saveRecipe: (token: string, branchId: string, slug: string, lines: RecipeLineInput[]) =>
    apiPatch<RecipeResponse>(
      `${inventory(branchId)}/recipes/${seg(slug)}`,
      { lines },
      bearer(token),
    ),
  setFoodCostTarget: (token: string, branchId: string, foodCostTarget: number) =>
    apiPatch<{ foodCostTarget: number }>(
      `${inventory(branchId)}/settings`,
      { foodCostTarget },
      bearer(token),
    ),
};
