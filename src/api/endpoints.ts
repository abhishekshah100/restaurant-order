import type { AdminBranch } from '@/types/admin';
import type { MenuData } from '@/types/menu';
import type { GuestSession } from '@/types/session';
import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import type {
  AcknowledgeRequestResponse,
  AddRoundRequest,
  AdminBranchesResponse,
  AdminOrdersResponse,
  AdminSignInRequest,
  AdminSignInResponse,
  BranchServiceResponse,
  CancelByStaffRequest,
  CancelOrderRequest,
  ChangeOrderRequest,
  CollectPaymentRequest,
  CollectTableRequest,
  EditRoundRequest,
  CreatePaymentRequest,
  CreateServiceRequestRequest,
  CreateServiceRequestResponse,
  CreateSessionRequest,
  DeliveryQuoteRequest,
  DishInput,
  DishResponse,
  ImageUploadRequest,
  ImageUploadResponse,
  DeliveryQuoteResponse,
  FloorPlanResponse,
  FreeTableResponse,
  MarkServedRequest,
  MarkServedResponse,
  OrderChangeResponse,
  OrderListResponse,
  OrderResponse,
  OtpChallenge,
  Payment,
  PlaceOrderRequest,
  PromoQuote,
  ReorderDishesRequest,
  ResolveRequestResponse,
  SendOtpRequest,
  ServiceRequestListResponse,
  SettledPaymentResponse,
  SetAvailabilityRequest,
  SetBranchStatusRequest,
  SimulatePaymentRequest,
  StaffRoundRequest,
  TableDetailResponse,
  TablePaymentResponse,
  TakeTableOrderRequest,
  UpdateCategoriesRequest,
  UpdateSessionRequest,
  ValidatePromoRequest,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from './contracts';

/*
 * One typed function per server-owned endpoint (contracts in api/contracts). Components never
 * call these directly: they use the hooks in api/hooks and api/mutations.
 */

const seg = encodeURIComponent;

/** Admin requests carry the staff session's token. */
const bearer = (token: string): RequestInit => ({ headers: { Authorization: `Bearer ${token}` } });

export const api = {
  createAdminSession: (body: AdminSignInRequest) =>
    apiPost<AdminSignInResponse>('admin/sessions', body),
  adminBranches: (token: string) => apiGet<AdminBranchesResponse>('admin/branches', bearer(token)),
  setBranchStatus: (token: string, branchId: string, body: SetBranchStatusRequest) =>
    apiPatch<AdminBranch>(`admin/branches/${seg(branchId)}/status`, body, bearer(token)),
  branchService: (token: string, branchId: string) =>
    apiGet<BranchServiceResponse>(`admin/branches/${seg(branchId)}/service`, bearer(token)),
  floorPlan: (token: string, branchId: string) =>
    apiGet<FloorPlanResponse>(`admin/branches/${seg(branchId)}/tables`, bearer(token)),
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
  uploadDishImage: (token: string, branchId: string, body: ImageUploadRequest) =>
    apiPost<ImageUploadResponse>(
      `admin/branches/${seg(branchId)}/menu/images`,
      body,
      bearer(token),
    ),
  branchOrders: (token: string, branchId: string) =>
    apiGet<AdminOrdersResponse>(`admin/branches/${seg(branchId)}/orders`, bearer(token)),
  collectPayment: (token: string, branchId: string, orderId: string, body: CollectPaymentRequest) =>
    apiPost<OrderResponse>(
      `admin/branches/${seg(branchId)}/orders/${seg(orderId)}/payment`,
      body,
      bearer(token),
    ),
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
  markOrderServed: (token: string, id: string, body: MarkServedRequest) =>
    apiPost<MarkServedResponse>(`admin/orders/${seg(id)}/served`, body, bearer(token)),

  createSession: (body: CreateSessionRequest) => apiPost<GuestSession>('sessions', body),
  updateSession: (id: string, body: UpdateSessionRequest) =>
    apiPatch<GuestSession>(`sessions/${seg(id)}`, body),

  quoteDelivery: (body: DeliveryQuoteRequest) =>
    apiPost<DeliveryQuoteResponse>('delivery/quote', body),

  validatePromo: (body: ValidatePromoRequest) => apiPost<PromoQuote>('promos/validate', body),

  sendOtp: (body: SendOtpRequest) => apiPost<OtpChallenge>('otp', body),
  verifyOtp: (body: VerifyOtpRequest) => apiPost<VerifyOtpResponse>('otp/verify', body),

  placeOrder: (body: PlaceOrderRequest) => apiPost<OrderResponse>('orders', body),
  getOrder: (id: string) => apiGet<OrderResponse>(`orders/${seg(id)}`),
  addRound: (id: string, body: AddRoundRequest) =>
    apiPost<OrderResponse>(`orders/${seg(id)}/rounds`, body),
  changeOrder: (id: string, body: ChangeOrderRequest) =>
    apiPatch<OrderChangeResponse>(`orders/${seg(id)}`, body),
  cancelOrder: (id: string, body: CancelOrderRequest) =>
    apiPost<OrderChangeResponse>(`orders/${seg(id)}/cancel`, body),
  sessionOrders: (sessionId: string) =>
    apiGet<OrderListResponse>(`sessions/${seg(sessionId)}/orders`),
  tableOrders: (branchId: string, table: number) =>
    apiGet<OrderListResponse>(`tables/${seg(branchId)}/${table}/orders`),

  createPayment: (body: CreatePaymentRequest) => apiPost<Payment>('payments', body),
  simulatePayment: (id: string, body: SimulatePaymentRequest) =>
    apiPost<SettledPaymentResponse>(`payments/${seg(id)}/simulate`, body),

  createServiceRequest: (body: CreateServiceRequestRequest) =>
    apiPost<CreateServiceRequestResponse>('service-requests', body),
  cancelServiceRequest: (id: string) => apiDelete(`service-requests/${seg(id)}`),
  serviceRequests: (sessionId: string) =>
    apiGet<ServiceRequestListResponse>(`sessions/${seg(sessionId)}/service-requests`),
};
