import type { GuestSession } from '@/types/session';
import { apiDelete, apiGet, apiPatch, apiPost } from '../client';
import { guestQuery } from '../guestQuery';
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
  SessionWifiResponse,
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
} from '../contracts';
import { seg } from './shared';

/** Guests: sessions, codes, ordering, payments, service requests. */
export const guestsApi = {
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
