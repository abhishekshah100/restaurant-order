import type { AdminBranch, AdminServiceRequest, FloorPlanLayout, Reservation } from '@/types/admin';
import type { MenuData } from '@/types/menu';
import type { GuestSession } from '@/types/session';
import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import { guestQuery } from './guestQuery';
import type {
  AcknowledgeRequestResponse,
  AddRoundRequest,
  AdminBranchesResponse,
  AdminOrdersFilter,
  AdminOrdersResponse,
  AdminSignInRequest,
  AdminSignInResponse,
  BranchServiceResponse,
  BranchSettingsResponse,
  CreateBranchRequest,
  UpdateBranchSettingsRequest,
  CancelByStaffRequest,
  CancelOrderRequest,
  ChangeOrderRequest,
  CollectPaymentRequest,
  RefundRequest,
  UpdateFloorsRequest,
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
  SetKitchenStatusRequest,
  SetPlatedRequest,
  SetRushRequest,
  KitchenMessageRequest,
  SetKitchenStatusResponse,
  OrderChangeResponse,
  OrderListResponse,
  OrderResponse,
  OtpChallenge,
  Payment,
  PlaceOrderRequest,
  PromoQuote,
  ReorderDishesRequest,
  ReservationInput,
  ReservationsResponse,
  ResolveRequestResponse,
  SendOtpRequest,
  ServiceRequestListResponse,
  SettledPaymentResponse,
  SetAvailabilityRequest,
  SetBranchStatusRequest,
  SetReservationStatusRequest,
  SimulatePaymentRequest,
  StaffRoundRequest,
  TableDetailResponse,
  TablePaymentResponse,
  TableQrCodesResponse,
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

/** "?from=…&to=…" from the fields that are set ("" with none). */
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
  uploadDishImage: (token: string, branchId: string, body: ImageUploadRequest) =>
    apiPost<ImageUploadResponse>(
      `admin/branches/${seg(branchId)}/menu/images`,
      body,
      bearer(token),
    ),
  reservations: (token: string, branchId: string) =>
    apiGet<ReservationsResponse>(`admin/branches/${seg(branchId)}/reservations`, bearer(token)),
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
  getOrder: (id: string) => apiGet<OrderResponse>(`orders/${seg(id)}${guestQuery()}`),
  addRound: (id: string, body: AddRoundRequest) =>
    apiPost<OrderResponse>(`orders/${seg(id)}/rounds`, body),
  changeOrder: (id: string, body: ChangeOrderRequest) =>
    apiPatch<OrderChangeResponse>(`orders/${seg(id)}`, body),
  cancelOrder: (id: string, body: CancelOrderRequest) =>
    apiPost<OrderChangeResponse>(`orders/${seg(id)}/cancel`, body),
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
