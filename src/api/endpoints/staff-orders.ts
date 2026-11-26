import type { AdminServiceRequest } from '@/types/admin';
import { apiGet, apiPatch, apiPost } from '../client';
import type {
  AcknowledgeRequestResponse,
  AdminOrdersFilter,
  AdminOrdersResponse,
  CancelByStaffRequest,
  CancelRoundRequest,
  CollectPaymentRequest,
  CollectTableRequest,
  EditRoundRequest,
  RequestHistoryResponse,
  ItemUnavailableRequest,
  KitchenMessageRequest,
  MarkServedRequest,
  MarkServedResponse,
  OrderChangeResponse,
  OrderResponse,
  OrderHistoryQuery,
  OrderHistoryResponse,
  OrderUnavailableRequest,
  RefundRequest,
  ResolveRequestResponse,
  SetKitchenStatusRequest,
  SetKitchenStatusResponse,
  SetPlatedRequest,
  SetRushRequest,
  StaffRoundRequest,
  TablePaymentResponse,
  TakeTableOrderRequest,
  PhoneOrderRequest,
} from '../contracts';
import { bearer, searchOf, seg } from './shared';

/** Orders as staff work them: taking, payments, refunds, the kitchen, service requests, history. */
export const staffOrdersApi = {
  takeTableOrder: (token: string, branchId: string, table: number, body: TakeTableOrderRequest) =>
    apiPost<OrderResponse>(
      `admin/branches/${seg(branchId)}/tables/${table}/orders`,
      body,
      bearer(token),
    ),
  takePhoneOrder: (token: string, branchId: string, body: PhoneOrderRequest) =>
    apiPost<OrderResponse>(`admin/branches/${seg(branchId)}/orders/phone`, body, bearer(token)),
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
};
