import type { GuestSession } from '@/types/session';
import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import type {
  AddRoundRequest,
  CancelOrderRequest,
  ChangeOrderRequest,
  CreatePaymentRequest,
  CreateServiceRequestRequest,
  CreateServiceRequestResponse,
  CreateSessionRequest,
  DeliveryQuoteRequest,
  DeliveryQuoteResponse,
  OrderChangeResponse,
  OrderListResponse,
  OrderResponse,
  OtpChallenge,
  Payment,
  PlaceOrderRequest,
  PromoQuote,
  SendOtpRequest,
  ServiceRequestListResponse,
  SettledPaymentResponse,
  SimulatePaymentRequest,
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

export const api = {
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
