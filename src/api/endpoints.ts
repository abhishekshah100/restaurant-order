import type {
  AdminBranch,
  AdminServiceRequest,
  FloorPlanLayout,
  GuestHistory,
  Reservation,
  ReservationRules,
  AdminRole,
  AdminStaffMember,
} from '@/types/admin';
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
import type { MenuData } from '@/types/menu';
import type { FeaturesResponse, SectionWaiter, ShiftListResponse, StaffShift } from '@/types/admin';
import type {
  OrderInput,
  PriceChangesResponse,
  PurchaseOrder,
  PurchaseOrdersResponse,
  PurchaseReturn,
  PurchasingSettings,
  Receipt,
  ReceiptInput,
  ReceiptsResponse,
  ReturnInput,
  ReturnsResponse,
  Supplier,
  SupplierInput,
  SupplierItemInput,
  SuppliersResponse,
} from '@/types/purchasing';
import type { AutoOffer } from '@/types/promotion';
import type { GuestSession } from '@/types/session';
import { apiDelete, apiGet, apiPatch, apiPost, backendBlob } from './client';
import { guestQuery } from './guestQuery';
import type {
  AcknowledgeRequestResponse,
  AddRoundRequest,
  AddStaffRequest,
  AdminBranchesResponse,
  AdminOrdersFilter,
  AdminOrdersResponse,
  AdminSignInRequest,
  AdminSignInResponse,
  BranchServiceResponse,
  BranchSettingsResponse,
  CancelByStaffRequest,
  CancelOrderRequest,
  CancelRoundRequest,
  ChangeOrderRequest,
  ChangePasswordRequest,
  CollectPaymentRequest,
  CollectTableRequest,
  CreateBranchRequest,
  CreatePaymentRequest,
  CreateServiceRequestRequest,
  CreateServiceRequestResponse,
  CreateSessionRequest,
  DeliveryQuoteRequest,
  DeliveryQuoteResponse,
  DishInput,
  DishResponse,
  EditRoundRequest,
  FloorPlanResponse,
  FreeTableResponse,
  ImageUploadRequest,
  DepositRequest,
  PaymentProofRequest,
  PaymentProofResponse,
  CashDaySummary,
  CashMovementRequest,
  CashRegisterResponse,
  CashReport,
  CashSession,
  CloseRegisterRequest,
  OpenRegisterRequest,
  ImageUploadResponse,
  BranchImageUploadResponse,
  SearchSuggestions,
  AdminSearchSuggestions,
  UpdateSearchSuggestionsRequest,
  CartSuggestionsResponse,
  SessionWifiResponse,
  RequestHistoryResponse,
  PaymentHistoryResponse,
  PaymentHistoryQuery,
  AdminCartSuggestions,
  UpdateCartSuggestionsRequest,
  ItemUnavailableRequest,
  KitchenMessageRequest,
  MarkServedRequest,
  MarkServedResponse,
  OfferRequest,
  OrderChangeResponse,
  OrderListResponse,
  OrderResponse,
  OrderHistoryQuery,
  OrderHistoryResponse,
  OrderUnavailableRequest,
  OtpChallenge,
  Payment,
  PlaceOrderRequest,
  PromoQuote,
  RefundRequest,
  ReorderDishesRequest,
  ReservationInput,
  ReservationsFilter,
  ReservationsResponse,
  ResetStaffPasswordRequest,
  ResolveRequestResponse,
  RoleInput,
  RolesResponse,
  SendOtpRequest,
  ServiceRequestListResponse,
  SetAvailabilityRequest,
  SetBranchStatusRequest,
  SetKitchenStatusRequest,
  SetKitchenStatusResponse,
  SetPlatedRequest,
  SetReservationStatusRequest,
  SetRushRequest,
  SettledPaymentResponse,
  SimulatePaymentRequest,
  StaffResponse,
  StaffRoundRequest,
  TableDetailResponse,
  TablePaymentResponse,
  TableQrCodesResponse,
  TakeTableOrderRequest,
  UpdateBranchSettingsRequest,
  UpdateCategoriesRequest,
  UpdateFloorsRequest,
  UpdateSessionRequest,
  UpdateStaffRequest,
  ValidatePromoRequest,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from './contracts';

/*
 * One typed function per server-owned endpoint (contracts in api/contracts). Components never
 * call these directly: they use the hooks in api/hooks and api/mutations.
 */

const seg = encodeURIComponent;

/** "?from=…&to=…" from the fields that are set ("" with none). */
/** A branch's purchasing endpoints. */
const purchasing = (branchId: string) => `admin/branches/${seg(branchId)}/purchasing`;

/** A branch's inventory endpoints. */
const inventory = (branchId: string) => `admin/branches/${seg(branchId)}/inventory`;

function searchOf(fields: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(fields) as [string, string | number | undefined][]) {
    if (value !== undefined) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** Admin requests carry the staff session's token. */
const bearer = (token: string): RequestInit => ({ headers: { Authorization: `Bearer ${token}` } });

export const api = {
  createAdminSession: (body: AdminSignInRequest) =>
    apiPost<AdminSignInResponse>('admin/sessions', body),
  endAdminSession: (token: string) => apiDelete('admin/sessions/current', bearer(token)),
  changeOwnPassword: (token: string, body: ChangePasswordRequest) =>
    apiPatch<void>('admin/sessions/current/password', body, bearer(token)),
  staff: (token: string, branchId: string) =>
    apiGet<StaffResponse>(`admin/branches/${seg(branchId)}/staff`, bearer(token)),
  addStaff: (token: string, branchId: string, body: AddStaffRequest) =>
    apiPost<AdminStaffMember>(`admin/branches/${seg(branchId)}/staff`, body, bearer(token)),
  updateStaff: (token: string, branchId: string, id: string, body: UpdateStaffRequest) =>
    apiPatch<AdminStaffMember>(
      `admin/branches/${seg(branchId)}/staff/${seg(id)}`,
      body,
      bearer(token),
    ),
  resetStaffPassword: (
    token: string,
    branchId: string,
    id: string,
    body: ResetStaffPasswordRequest,
  ) =>
    apiPost<void>(`admin/branches/${seg(branchId)}/staff/${seg(id)}/password`, body, bearer(token)),
  adminBranches: (token: string) => apiGet<AdminBranchesResponse>('admin/branches', bearer(token)),
  setBranchStatus: (token: string, branchId: string, body: SetBranchStatusRequest) =>
    apiPatch<AdminBranch>(`admin/branches/${seg(branchId)}/status`, body, bearer(token)),
  createBranch: (token: string, body: CreateBranchRequest) =>
    apiPost<AdminBranch>('admin/branches', body, bearer(token)),
  removeBranch: (token: string, branchId: string) =>
    apiDelete(`admin/branches/${seg(branchId)}`, bearer(token)),
  branchSettings: (token: string, branchId: string) =>
    apiGet<BranchSettingsResponse>(`admin/branches/${seg(branchId)}/settings`, bearer(token)),
  updateBranchSettings: (token: string, branchId: string, body: UpdateBranchSettingsRequest) =>
    apiPatch<BranchSettingsResponse>(
      `admin/branches/${seg(branchId)}/settings`,
      body,
      bearer(token),
    ),
  branchService: (token: string, branchId: string) =>
    apiGet<BranchServiceResponse>(`admin/branches/${seg(branchId)}/service`, bearer(token)),
  floorPlan: (token: string, branchId: string) =>
    apiGet<FloorPlanResponse>(`admin/branches/${seg(branchId)}/tables`, bearer(token)),
  /** My open shift at the branch, or null. */
  currentShift: (token: string, branchId: string) =>
    apiGet<StaffShift | null>(`admin/branches/${seg(branchId)}/shifts/current`, bearer(token)),
  /** Start shift (an open one already: that one). */
  startShift: (token: string, branchId: string) =>
    apiPost<StaffShift>(`admin/branches/${seg(branchId)}/shifts/start`, {}, bearer(token)),
  /** Clock out: my tables are released. */
  endShift: (token: string, branchId: string) =>
    apiPost<StaffShift>(`admin/branches/${seg(branchId)}/shifts/end`, {}, bearer(token)),
  /** Team › Shifts: the shifts started on those days, with what each person did. */
  shifts: (token: string, branchId: string, range: { from: string; to: string }) =>
    apiGet<ShiftListResponse>(
      `admin/branches/${seg(branchId)}/shifts?from=${range.from}&to=${range.to}`,
      bearer(token),
    ),
  /** Table sections: who can cover tables, with what each covers now. */
  sectionWaiters: (token: string, branchId: string) =>
    apiGet<SectionWaiter[]>(`admin/branches/${seg(branchId)}/tables/waiters`, bearer(token)),
  /** These tables to this waiter, or to nobody (`waiterId` null). */
  assignTables: (
    token: string,
    branchId: string,
    body: { tables: number[]; waiterId: string | null },
  ) =>
    apiPatch<FloorPlanResponse>(
      `admin/branches/${seg(branchId)}/tables/sections`,
      body,
      bearer(token),
    ),
  /** The guests' note at a table for the visit (both empty: cleared). */
  setTableNote: (
    token: string,
    branchId: string,
    table: number,
    body: { text: string; tags: string[] },
  ) =>
    apiPatch<TableDetailResponse>(
      `admin/branches/${seg(branchId)}/tables/${String(table)}/note`,
      body,
      bearer(token),
    ),
  /** Clear all: nobody covers any table. */
  clearSections: (token: string, branchId: string) =>
    apiDelete(`admin/branches/${seg(branchId)}/tables/sections`, bearer(token)),
  floorLayout: (token: string, branchId: string) =>
    apiGet<FloorPlanLayout>(`admin/branches/${seg(branchId)}/floors`, bearer(token)),
  updateFloors: (token: string, branchId: string, body: UpdateFloorsRequest) =>
    apiPatch<FloorPlanLayout>(`admin/branches/${seg(branchId)}/floors`, body, bearer(token)),
  tableDetail: (token: string, branchId: string, table: number) =>
    apiGet<TableDetailResponse>(`admin/branches/${seg(branchId)}/tables/${table}`, bearer(token)),
  takeTableOrder: (token: string, branchId: string, table: number, body: TakeTableOrderRequest) =>
    apiPost<OrderResponse>(
      `admin/branches/${seg(branchId)}/tables/${table}/orders`,
      body,
      bearer(token),
    ),
  setDishAvailability: (
    token: string,
    branchId: string,
    slug: string,
    body: SetAvailabilityRequest,
  ) =>
    apiPatch<DishResponse>(
      `admin/branches/${seg(branchId)}/menu/dishes/${seg(slug)}/availability`,
      body,
      bearer(token),
    ),
  createDish: (token: string, branchId: string, body: DishInput) =>
    apiPost<DishResponse>(`admin/branches/${seg(branchId)}/menu/dishes`, body, bearer(token)),
  updateDish: (token: string, branchId: string, slug: string, body: DishInput) =>
    apiPatch<DishResponse>(
      `admin/branches/${seg(branchId)}/menu/dishes/${seg(slug)}`,
      body,
      bearer(token),
    ),
  removeDish: (token: string, branchId: string, slug: string) =>
    apiDelete(`admin/branches/${seg(branchId)}/menu/dishes/${seg(slug)}`, bearer(token)),
  reorderDishes: (
    token: string,
    branchId: string,
    categoryId: string,
    body: ReorderDishesRequest,
  ) =>
    apiPatch<MenuData>(
      `admin/branches/${seg(branchId)}/menu/categories/${seg(categoryId)}/order`,
      body,
      bearer(token),
    ),
  updateCategories: (token: string, branchId: string, body: UpdateCategoriesRequest) =>
    apiPatch<MenuData>(`admin/branches/${seg(branchId)}/menu/categories`, body, bearer(token)),
  cashRegister: (token: string, branchId: string) =>
    apiGet<CashRegisterResponse>(`admin/branches/${seg(branchId)}/cash-register`, bearer(token)),
  cashSession: (token: string, branchId: string, id: string) =>
    apiGet<CashSession>(
      `admin/branches/${seg(branchId)}/cash-register/sessions/${seg(id)}`,
      bearer(token),
    ),
  openRegister: (token: string, branchId: string, body: OpenRegisterRequest) =>
    apiPost<CashSession>(`admin/branches/${seg(branchId)}/cash-register/open`, body, bearer(token)),
  moveCash: (token: string, branchId: string, body: CashMovementRequest) =>
    apiPost<CashSession>(
      `admin/branches/${seg(branchId)}/cash-register/movements`,
      body,
      bearer(token),
    ),
  closeRegister: (token: string, branchId: string, body: CloseRegisterRequest) =>
    apiPost<CashSession>(
      `admin/branches/${seg(branchId)}/cash-register/close`,
      body,
      bearer(token),
    ),
  cashDay: (token: string, branchId: string, day: string) =>
    apiGet<CashDaySummary>(
      `admin/branches/${seg(branchId)}/cash-register/days/${seg(day)}`,
      bearer(token),
    ),
  signOffCashDay: (token: string, branchId: string, day: string, note?: string) =>
    apiPost<CashDaySummary>(
      `admin/branches/${seg(branchId)}/cash-register/days/${seg(day)}/sign-off`,
      note ? { note } : {},
      bearer(token),
    ),
  cashReport: (token: string, branchId: string, range: { from: string; to: string }) =>
    apiGet<CashReport>(
      `admin/branches/${seg(branchId)}/cash-register/report${searchOf(range)}`,
      bearer(token),
    ),
  setCashLimit: (token: string, branchId: string, differenceLimit: number) =>
    apiPatch<{ differenceLimit: number }>(
      `admin/branches/${seg(branchId)}/cash-register/limit`,
      { differenceLimit },
      bearer(token),
    ),
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
  wasteStock: (token: string, branchId: string, body: StockEntryRequest<WastageLine>) =>
    apiPost<StockEntryResponse>(`${inventory(branchId)}/wastage`, body, bearer(token)),
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
  features: (token: string, branchId: string) =>
    apiGet<FeaturesResponse>(`admin/branches/${seg(branchId)}/features`, bearer(token)),
  setFeatures: (token: string, branchId: string, body: { inventory: boolean }) =>
    apiPatch<FeaturesResponse>(`admin/branches/${seg(branchId)}/features`, body, bearer(token)),
  suppliers: (token: string, branchId: string) =>
    apiGet<SuppliersResponse>(`${purchasing(branchId)}/suppliers`, bearer(token)),
  createSupplier: (token: string, branchId: string, body: SupplierInput) =>
    apiPost<Supplier>(`${purchasing(branchId)}/suppliers`, body, bearer(token)),
  updateSupplier: (token: string, branchId: string, id: string, body: Partial<SupplierInput>) =>
    apiPatch<Supplier>(`${purchasing(branchId)}/suppliers/${seg(id)}`, body, bearer(token)),
  archiveSupplier: (token: string, branchId: string, id: string) =>
    apiDelete(`${purchasing(branchId)}/suppliers/${seg(id)}`, bearer(token)),
  setSupplierItems: (token: string, branchId: string, id: string, items: SupplierItemInput[]) =>
    apiPatch<Supplier>(
      `${purchasing(branchId)}/suppliers/${seg(id)}/items`,
      { items },
      bearer(token),
    ),
  purchaseOrders: (
    token: string,
    branchId: string,
    query: { status?: string; supplier?: string },
  ) =>
    apiGet<PurchaseOrdersResponse>(
      `${purchasing(branchId)}/orders${searchOf(query)}`,
      bearer(token),
    ),
  purchaseOrder: (token: string, branchId: string, id: string) =>
    apiGet<PurchaseOrder>(`${purchasing(branchId)}/orders/${seg(id)}`, bearer(token)),
  createPurchaseOrder: (token: string, branchId: string, body: OrderInput) =>
    apiPost<PurchaseOrder>(`${purchasing(branchId)}/orders`, body, bearer(token)),
  suggestPurchaseOrder: (token: string, branchId: string, supplierId: string) =>
    apiPost<PurchaseOrder>(
      `${purchasing(branchId)}/orders/suggest${searchOf({ supplier: supplierId })}`,
      {},
      bearer(token),
    ),
  updatePurchaseOrder: (
    token: string,
    branchId: string,
    id: string,
    body: Omit<OrderInput, 'supplierId'>,
  ) => apiPatch<PurchaseOrder>(`${purchasing(branchId)}/orders/${seg(id)}`, body, bearer(token)),
  purchaseOrderStep: (
    token: string,
    branchId: string,
    id: string,
    step: 'approve' | 'send' | 'cancel' | 'close',
  ) =>
    apiPost<PurchaseOrder>(`${purchasing(branchId)}/orders/${seg(id)}/${step}`, {}, bearer(token)),
  setPurchasingSettings: (token: string, branchId: string, body: Partial<PurchasingSettings>) =>
    apiPatch<PurchasingSettings>(`${purchasing(branchId)}/settings`, body, bearer(token)),
  receipts: (token: string, branchId: string, range: { from?: string; to?: string }) =>
    apiGet<ReceiptsResponse>(`${purchasing(branchId)}/receipts${searchOf(range)}`, bearer(token)),
  receipt: (token: string, branchId: string, id: string) =>
    apiGet<Receipt>(`${purchasing(branchId)}/receipts/${seg(id)}`, bearer(token)),
  receive: (token: string, branchId: string, body: ReceiptInput) =>
    apiPost<Receipt>(`${purchasing(branchId)}/receipts`, body, bearer(token)),
  confirmPrices: (
    token: string,
    branchId: string,
    id: string,
    lines: { lineId: string; price: number }[],
  ) =>
    apiPost<Receipt>(
      `${purchasing(branchId)}/receipts/${seg(id)}/prices`,
      { lines },
      bearer(token),
    ),
  priceChanges: (token: string, branchId: string) =>
    apiGet<PriceChangesResponse>(`${purchasing(branchId)}/price-changes`, bearer(token)),
  purchaseReturns: (token: string, branchId: string, range: { from?: string; to?: string }) =>
    apiGet<ReturnsResponse>(`${purchasing(branchId)}/returns${searchOf(range)}`, bearer(token)),
  createPurchaseReturn: (token: string, branchId: string, body: ReturnInput) =>
    apiPost<PurchaseReturn>(`${purchasing(branchId)}/returns`, body, bearer(token)),
  uploadPurchaseProof: (token: string, branchId: string, body: PaymentProofRequest) =>
    apiPost<PaymentProofResponse>(`${purchasing(branchId)}/proofs`, body, bearer(token)),
  /** An invoice photo's bytes (private). Backend only. */
  purchaseProof: (token: string, branchId: string, key: string) =>
    backendBlob(`${purchasing(branchId)}/proofs/${seg(key)}`, bearer(token)),
  refundReceived: (token: string, branchId: string, orderId: string, seq: number) =>
    apiPost<OrderResponse>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/refunds/${seq}/received`,
      {},
      bearer(token),
    ),
  uploadPaymentProof: (token: string, branchId: string, body: PaymentProofRequest) =>
    apiPost<PaymentProofResponse>(
      `admin/branches/${seg(branchId)}/payment-proofs`,
      body,
      bearer(token),
    ),
  /** A proof photo's bytes (private: the admin's token). Backend only. */
  paymentProof: (token: string, branchId: string, key: string) =>
    backendBlob(`admin/branches/${seg(branchId)}/payment-proofs/${seg(key)}`, bearer(token)),
  uploadDishImage: (token: string, branchId: string, body: ImageUploadRequest) =>
    apiPost<ImageUploadResponse>(
      `admin/branches/${seg(branchId)}/menu/images`,
      body,
      bearer(token),
    ),
  uploadBranchImage: (token: string, branchId: string, body: ImageUploadRequest) =>
    apiPost<BranchImageUploadResponse>(
      `admin/branches/${seg(branchId)}/settings/image`,
      body,
      bearer(token),
    ),
  searchSuggestions: (branchId: string) =>
    apiGet<SearchSuggestions>(`branches/${seg(branchId)}/menu/suggestions`),
  adminSearchSuggestions: (token: string, branchId: string) =>
    apiGet<AdminSearchSuggestions>(
      `admin/branches/${seg(branchId)}/menu/suggestions`,
      bearer(token),
    ),
  updateSearchSuggestions: (
    token: string,
    branchId: string,
    body: UpdateSearchSuggestionsRequest,
  ) =>
    apiPatch<AdminSearchSuggestions>(
      `admin/branches/${seg(branchId)}/menu/suggestions`,
      body,
      bearer(token),
    ),
  cartSuggestions: (branchId: string, dishes: readonly string[]) =>
    apiGet<CartSuggestionsResponse>(
      `branches/${seg(branchId)}/menu/cart-suggestions?dishes=${dishes.map(seg).join(',')}`,
    ),
  adminCartSuggestions: (token: string, branchId: string, preview?: string) =>
    apiGet<AdminCartSuggestions>(
      `admin/branches/${seg(branchId)}/menu/cart-suggestions${preview ? `?preview=${seg(preview)}` : ''}`,
      bearer(token),
    ),
  updateCartSuggestions: (
    token: string,
    branchId: string,
    body: UpdateCartSuggestionsRequest,
    preview?: string,
  ) =>
    apiPatch<AdminCartSuggestions>(
      `admin/branches/${seg(branchId)}/menu/cart-suggestions${preview ? `?preview=${seg(preview)}` : ''}`,
      body,
      bearer(token),
    ),
  offers: (token: string, branchId: string) =>
    apiGet<AutoOffer[]>(`admin/branches/${seg(branchId)}/offers`, bearer(token)),
  createOffer: (token: string, branchId: string, body: OfferRequest) =>
    apiPost<AutoOffer>(`admin/branches/${seg(branchId)}/offers`, body, bearer(token)),
  updateOffer: (token: string, branchId: string, id: string, body: OfferRequest) =>
    apiPatch<AutoOffer>(`admin/branches/${seg(branchId)}/offers/${seg(id)}`, body, bearer(token)),
  removeOffer: (token: string, branchId: string, id: string) =>
    apiDelete(`admin/branches/${seg(branchId)}/offers/${seg(id)}`, bearer(token)),
  roles: (token: string, branchId: string) =>
    apiGet<RolesResponse>(`admin/branches/${seg(branchId)}/roles`, bearer(token)),
  createRole: (token: string, branchId: string, body: RoleInput) =>
    apiPost<AdminRole>(`admin/branches/${seg(branchId)}/roles`, body, bearer(token)),
  updateRole: (token: string, branchId: string, id: string, body: RoleInput) =>
    apiPatch<AdminRole>(`admin/branches/${seg(branchId)}/roles/${seg(id)}`, body, bearer(token)),
  removeRole: (token: string, branchId: string, id: string) =>
    apiDelete(`admin/branches/${seg(branchId)}/roles/${seg(id)}`, bearer(token)),
  recordDeposit: (token: string, branchId: string, id: string, body: DepositRequest) =>
    apiPost<Reservation>(
      `admin/branches/${seg(branchId)}/reservations/${seg(id)}/deposit`,
      body,
      bearer(token),
    ),
  reservationReminded: (token: string, branchId: string, id: string) =>
    apiPost<Reservation>(
      `admin/branches/${seg(branchId)}/reservations/${seg(id)}/reminded`,
      {},
      bearer(token),
    ),
  guestHistory: (token: string, branchId: string, phone: string) =>
    apiGet<GuestHistory>(
      `admin/branches/${seg(branchId)}/reservations/guests/${seg(phone)}`,
      bearer(token),
    ),
  setReservationRules: (token: string, branchId: string, rules: ReservationRules) =>
    apiPatch<ReservationRules>(
      `admin/branches/${seg(branchId)}/reservations/rules`,
      rules,
      bearer(token),
    ),
  reservations: (token: string, branchId: string, filter: ReservationsFilter = {}) =>
    apiGet<ReservationsResponse>(
      `admin/branches/${seg(branchId)}/reservations${searchOf(filter)}`,
      bearer(token),
    ),
  createReservation: (token: string, branchId: string, body: ReservationInput) =>
    apiPost<Reservation>(`admin/branches/${seg(branchId)}/reservations`, body, bearer(token)),
  updateReservation: (token: string, branchId: string, id: string, body: ReservationInput) =>
    apiPatch<Reservation>(
      `admin/branches/${seg(branchId)}/reservations/${seg(id)}`,
      body,
      bearer(token),
    ),
  setReservationStatus: (
    token: string,
    branchId: string,
    id: string,
    body: SetReservationStatusRequest,
  ) =>
    apiPatch<Reservation>(
      `admin/branches/${seg(branchId)}/reservations/${seg(id)}/status`,
      body,
      bearer(token),
    ),
  branchOrders: (token: string, branchId: string, filter: AdminOrdersFilter = {}) =>
    apiGet<AdminOrdersResponse>(
      `admin/branches/${seg(branchId)}/orders${searchOf(filter)}`,
      bearer(token),
    ),
  collectPayment: (token: string, branchId: string, orderId: string, body: CollectPaymentRequest) =>
    apiPost<OrderResponse>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/payment`,
      body,
      bearer(token),
    ),
  refundOrder: (token: string, branchId: string, orderId: string, body: RefundRequest) =>
    apiPost<OrderResponse>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/refund`,
      body,
      bearer(token),
    ),
  tableQrCodes: (token: string, branchId: string) =>
    apiGet<TableQrCodesResponse>(`admin/branches/${seg(branchId)}/tables/qr-codes`, bearer(token)),
  freeTable: (token: string, branchId: string, table: number) =>
    apiPost<FreeTableResponse>(
      `admin/branches/${seg(branchId)}/tables/${table}/free`,
      undefined,
      bearer(token),
    ),
  collectTablePayment: (
    token: string,
    branchId: string,
    table: number,
    body: CollectTableRequest,
  ) =>
    apiPost<TablePaymentResponse>(
      `admin/branches/${seg(branchId)}/tables/${table}/payment`,
      body,
      bearer(token),
    ),
  editStaffRound: (
    token: string,
    branchId: string,
    orderId: string,
    round: number,
    body: EditRoundRequest,
  ) =>
    apiPatch<OrderChangeResponse>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/rounds/${round}`,
      body,
      bearer(token),
    ),
  cancelByStaff: (token: string, branchId: string, orderId: string, body: CancelByStaffRequest) =>
    apiPost<OrderResponse>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/cancel`,
      body,
      bearer(token),
    ),
  addStaffRound: (token: string, branchId: string, orderId: string, body: StaffRoundRequest) =>
    apiPost<OrderResponse>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/rounds`,
      body,
      bearer(token),
    ),
  acknowledgeServiceRequest: (token: string, id: string) =>
    apiPost<AcknowledgeRequestResponse>(
      `admin/service-requests/${seg(id)}/acknowledge`,
      undefined,
      bearer(token),
    ),
  resolveServiceRequest: (token: string, id: string) =>
    apiPost<ResolveRequestResponse>(
      `admin/service-requests/${seg(id)}/resolve`,
      undefined,
      bearer(token),
    ),
  setKitchenStatus: (
    token: string,
    branchId: string,
    orderId: string,
    round: number,
    body: SetKitchenStatusRequest,
  ) =>
    apiPatch<SetKitchenStatusResponse>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/rounds/${round}/status`,
      body,
      bearer(token),
    ),
  setRush: (token: string, branchId: string, orderId: string, body: SetRushRequest) =>
    apiPatch<SetKitchenStatusResponse>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/rush`,
      body,
      bearer(token),
    ),
  cancelRound: (
    token: string,
    branchId: string,
    orderId: string,
    round: number,
    body: CancelRoundRequest,
  ) =>
    apiPost<OrderChangeResponse>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/rounds/${round}/cancel`,
      body,
      bearer(token),
    ),
  itemUnavailable: (
    token: string,
    branchId: string,
    orderId: string,
    round: number,
    position: number,
    body: ItemUnavailableRequest,
  ) =>
    apiPost<OrderChangeResponse>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/rounds/${round}/items/${position}/unavailable`,
      body,
      bearer(token),
    ),
  orderUnavailable: (
    token: string,
    branchId: string,
    orderId: string,
    body: OrderUnavailableRequest,
  ) =>
    apiPost<OrderChangeResponse>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/unavailable`,
      body,
      bearer(token),
    ),
  sendKitchenMessage: (
    token: string,
    branchId: string,
    orderId: string,
    body: KitchenMessageRequest,
  ) =>
    apiPost<{ request: AdminServiceRequest }>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/messages`,
      body,
      bearer(token),
    ),
  setPlated: (
    token: string,
    branchId: string,
    orderId: string,
    round: number,
    position: number,
    body: SetPlatedRequest,
  ) =>
    apiPatch<SetKitchenStatusResponse>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/rounds/${round}/items/${position}/plated`,
      body,
      bearer(token),
    ),
  dismissTicket: (token: string, branchId: string, orderId: string, round: number) =>
    apiPost<SetKitchenStatusResponse>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/rounds/${round}/dismiss`,
      {},
      bearer(token),
    ),
  markOrderServed: (token: string, id: string, body: MarkServedRequest) =>
    apiPost<MarkServedResponse>(`admin/orders/${seg(id)}/served`, body, bearer(token)),

  createSession: (body: CreateSessionRequest) => apiPost<GuestSession>('sessions', body),
  /** GET /sessions/:id: the session while it's live; 404 session_not_found once it ended. */
  session: (id: string) => apiGet<GuestSession>(`sessions/${seg(id)}`),
  updateSession: (id: string, body: UpdateSessionRequest) =>
    apiPatch<GuestSession>(`sessions/${seg(id)}`, body),

  quoteDelivery: (body: DeliveryQuoteRequest) =>
    apiPost<DeliveryQuoteResponse>('delivery/quote', body),

  validatePromo: (body: ValidatePromoRequest) => apiPost<PromoQuote>('promos/validate', body),

  sendOtp: (body: SendOtpRequest) => apiPost<OtpChallenge>('otp', body),
  verifyOtp: (body: VerifyOtpRequest) => apiPost<VerifyOtpResponse>('otp/verify', body),

  placeOrder: (body: PlaceOrderRequest) => apiPost<OrderResponse>('orders', body),
  getOrder: (id: string) => apiGet<OrderResponse>(`orders/${seg(id)}${guestQuery()}`),
  addRound: (id: string, body: AddRoundRequest) =>
    apiPost<OrderResponse>(`orders/${seg(id)}/rounds`, body),
  changeOrder: (id: string, body: ChangeOrderRequest) =>
    apiPatch<OrderChangeResponse>(`orders/${seg(id)}`, body),
  cancelOrder: (id: string, body: CancelOrderRequest) =>
    apiPost<OrderChangeResponse>(`orders/${seg(id)}/cancel`, body),
  paymentHistory: (token: string, branchId: string, query: PaymentHistoryQuery) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '' && value !== 'all') search.set(key, String(value));
    }
    return apiGet<PaymentHistoryResponse>(
      `admin/branches/${seg(branchId)}/payments/history?${search.toString()}`,
      bearer(token),
    );
  },
  orderHistory: (token: string, branchId: string, query: OrderHistoryQuery) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '' && value !== 'all') search.set(key, String(value));
    }
    return apiGet<OrderHistoryResponse>(
      `admin/branches/${seg(branchId)}/orders/history?${search.toString()}`,
      bearer(token),
    );
  },
  /** One order at the branch by its code, as staff see it (Orders › History opens it). */
  branchOrder: (token: string, branchId: string, id: string) =>
    apiGet<OrderResponse>(`admin/branches/${seg(branchId)}/orders/${seg(id)}`, bearer(token)),
  requestHistory: (
    token: string,
    branchId: string,
    query: { from: string; to: string; kind?: 'waiter' | 'bill' | 'kitchen' },
  ) =>
    apiGet<RequestHistoryResponse>(
      `admin/branches/${seg(branchId)}/service-requests/history?from=${query.from}&to=${query.to}${
        query.kind ? `&kind=${query.kind}` : ''
      }`,
      bearer(token),
    ),
  sessionWifi: (sessionId: string) =>
    apiGet<SessionWifiResponse>(`sessions/${seg(sessionId)}/wifi`),
  sessionOrders: (sessionId: string) =>
    apiGet<OrderListResponse>(`sessions/${seg(sessionId)}/orders`),
  tableOrders: (branchId: string, table: number) =>
    apiGet<OrderListResponse>(`tables/${seg(branchId)}/${table}/orders${guestQuery()}`),

  createPayment: (body: CreatePaymentRequest) => apiPost<Payment>('payments', body),
  simulatePayment: (id: string, body: SimulatePaymentRequest) =>
    apiPost<SettledPaymentResponse>(`payments/${seg(id)}/simulate${guestQuery()}`, body),

  createServiceRequest: (body: CreateServiceRequestRequest) =>
    apiPost<CreateServiceRequestResponse>('service-requests', body),
  cancelServiceRequest: (id: string, sessionId: string) =>
    apiDelete(`service-requests/${seg(id)}?sessionId=${seg(sessionId)}`),
  serviceRequests: (sessionId: string) =>
    apiGet<ServiceRequestListResponse>(`sessions/${seg(sessionId)}/service-requests`),
};
