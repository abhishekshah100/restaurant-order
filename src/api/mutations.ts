'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAdminToken } from '@/hooks/useAdminSession';
import { withAvailability } from '@/lib/adminMenu';
import { withDismissed, withKitchenStep, withPlated } from '@/lib/kitchenBoard';
import { withAcknowledged, withoutReadyRound, withoutRequest } from '@/lib/adminService';
import type { AdminBranchService, AdminServiceRequest, ReservationRules } from '@/types/admin';
import type { ServiceRequest } from '@/types/service';
import { PROMO_REFUSALS } from '@/lib/promotions';
import type { MenuData } from '@/types/menu';
import type {
  AddShiftRequest,
  FixShiftRequest,
  SaveRotaShiftRequest,
  ShiftTypeRequest,
} from '@/types/admin';
import type { Order } from '@/types/order';
import type {
  OrderInput,
  PurchasingSettings,
  ReceiptInput,
  ReturnInput,
  SupplierInput,
  SupplierItemInput,
} from '@/types/purchasing';
import type {
  AdjustmentLine,
  CreateIngredientRequest,
  OpeningLine,
  ProductionRequest,
  RecipeLineInput,
  SendTransferRequest,
  UpdateBatchRequest,
  WriteOffRequest,
  StockEntryRequest,
  UpdateIngredientRequest,
  UpdateStockRequest,
  WastageLine,
} from '@/types/inventory';
import type {
  AddRoundRequest,
  AddStaffRequest,
  CancelByStaffRequest,
  CancelOrderRequest,
  CancelRoundRequest,
  ChangeOrderRequest,
  ChangePasswordRequest,
  CollectPaymentRequest,
  CollectTableRequest,
  CreateBranchRequest,
  DishInput,
  EditRoundRequest,
  ImageUploadRequest,
  UpdateSearchSuggestionsRequest,
  UpdateCartSuggestionsRequest,
  PaymentProofRequest,
  DepositRequest,
  CashMovementRequest,
  CloseRegisterRequest,
  OpenRegisterRequest,
  ItemUnavailableRequest,
  KitchenMessageRequest,
  KitchenStep,
  OfferRequest,
  OrderUnavailableRequest,
  RefundRequest,
  ReservationInput,
  RoleInput,
  ServiceRequestListResponse,
  SetAvailabilityRequest,
  SetBranchStatusRequest,
  SetReservationStatusRequest,
  SimulatePaymentRequest,
  StaffRoundRequest,
  TakeTableOrderRequest,
  UpdateBranchSettingsRequest,
  UpdateCategoriesRequest,
  UpdateFloorsRequest,
  UpdateSessionRequest,
  UpdateStaffRequest,
  ValidatePromoRequest,
} from './contracts';
import { api } from './endpoints';
import { branchOf, refreshAfter, type Change } from './refreshAfter';
import { ApiError, isApiError } from './client';
import {
  branchMenuQuery,
  adminSearchSuggestionsQuery,
  adminCartSuggestionsQuery,
  branchOrdersQuery,
  branchServiceQuery,
  branchSettingsQuery,
  floorLayoutQuery,
  orderQuery,
  promoQuoteQuery,
  serviceRequestsQuery,
} from './queries';

/*
 * Every write, as a TanStack mutation over api/endpoints. After a write, what it changed is read
 * again through the one list in api/refreshAfter ("after X, refresh Y"), so screens never
 * refresh caches themselves.
 */

/** The order changed on the server meanwhile (too late, or cancelled): read it again. */
function refreshIfStale(client: QueryClient, error: unknown) {
  if (isApiError(error, 'window_closed') || isApiError(error, 'order_closed')) {
    return refreshAfter(client, 'guestOrder');
  }
}

/** The server refused the cart's promo code: price it again, so the cart says why. */
function refreshPromoIfRefused(client: QueryClient, error: unknown) {
  if (PROMO_REFUSALS.some((code) => isApiError(error, code))) {
    return refreshAfter(client, 'promoRefused');
  }
}

/** Caches an order as the server returned it and refreshes every order list. */
function storeOrders(client: QueryClient, orders: readonly Order[]) {
  for (const order of orders) client.setQueryData(orderQuery(order.id).queryKey, order);
  return refreshAfter(client, 'guestOrder');
}

/** POST /admin/sessions: a staff member signs in; resolves with the admin session. */
export const useAdminLogin = () => useMutation({ mutationFn: api.createAdminSession });

/** POST /sessions: open a guest session at a table. */
export const useStartSession = () => useMutation({ mutationFn: api.createSession, retry: 2 });

/** PATCH /sessions/:id: order another way (or to another delivery area) in the same session. */
export const useUpdateSession = () =>
  useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateSessionRequest) =>
      api.updateSession(id, body),
  });

/** POST /otp: text a code (or `resend: true` to send another). */
export const useSendOtp = () => useMutation({ mutationFn: api.sendOtp });

/** POST /otp/verify: check the code. */
export const useVerifyOtp = () => useMutation({ mutationFn: api.verifyOtp });

/**
 * POST /promos/validate when the guest applies a code: the answer is cached as the cart's quote
 * for the code the server names, so the bill shows the discount at once.
 */
export function useValidatePromo() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.validatePromo,
    onSuccess: (quote, { sessionId, lines }: ValidatePromoRequest) =>
      client.setQueryData(promoQuoteQuery(sessionId, quote.code, lines).queryKey, quote),
  });
}

/** POST /orders: place an order; it's cached straight away for the confirmation page. */
export function useCreateOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.placeOrder,
    onSuccess: (order) => storeOrders(client, [order]),
    onError: (error) => refreshPromoIfRefused(client, error),
  });
}

/** POST /orders/:id/rounds: another round on the guest's running dine-in order; cached at once. */
export function useAddRound() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, ...body }: { orderId: string } & AddRoundRequest) =>
      api.addRound(orderId, body),
    onSuccess: (order) => storeOrders(client, [order]),
    onError: (error) => refreshIfStale(client, error),
  });
}

/** PATCH /orders/:id: change the order's latest round within the window; cached at once. */
export function useChangeOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, ...body }: { orderId: string } & ChangeOrderRequest) =>
      api.changeOrder(orderId, body),
    onSuccess: ({ order }) => storeOrders(client, [order]),
    onError: (error) => refreshIfStale(client, error),
  });
}

/** POST /orders/:id/cancel: take back the latest round (or the order) within the window. */
export function useCancelOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, ...body }: { orderId: string } & CancelOrderRequest) =>
      api.cancelOrder(orderId, body),
    onSuccess: ({ order }) => storeOrders(client, [order]),
    onError: (error) => refreshIfStale(client, error),
  });
}

/**
 * POST /payments: open an online payment request (checkout or bill). Nothing left to pay: the
 * bill is re-read; a refused promo code is priced again.
 */
export function useCreatePayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.createPayment,
    onError: async (error) => {
      if (isApiError(error, 'nothing_to_pay')) await refreshAfter(client, 'guestOrder');
      await refreshPromoIfRefused(client, error);
    },
  });
}

/** POST /payments/:id/simulate (mock): the payment partner's result; paid bills refresh the orders and requests. */
export function useSimulatePayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, outcome }: { id: string } & SimulatePaymentRequest) =>
      api.simulatePayment(id, { outcome }),
    onSuccess: async ({ orders }) => {
      if (orders.length === 0) return;
      await Promise.all([storeOrders(client, orders), refreshAfter(client, 'guestPaid')]);
    },
  });
}

const withRequests = (
  client: QueryClient,
  sessionId: string,
  update: (requests: ServiceRequest[]) => ServiceRequest[],
) =>
  client.setQueryData<ServiceRequestListResponse>(
    serviceRequestsQuery(sessionId).queryKey,
    (current) => ({ requests: update(current?.requests ?? []) }),
  );

/** POST /service-requests: call a waiter or ask for the bill; the pending list updates at once. */
export function useCreateServiceRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.createServiceRequest,
    onSuccess: ({ request }) =>
      withRequests(client, request.sessionId, (list) => [
        ...list.filter((r) => r.kind !== request.kind),
        request,
      ]),
  });
}

/** DELETE /service-requests/:id: cancel; removed from the pending list straight away (restored if it fails). */
export function useCancelServiceRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: ServiceRequest) =>
      api.cancelServiceRequest(request.id, request.sessionId),
    onMutate: async (request) => {
      const { queryKey } = serviceRequestsQuery(request.sessionId);
      await client.cancelQueries({ queryKey });
      withRequests(client, request.sessionId, (list) => list.filter((r) => r.id !== request.id));
    },
    onError: (_error, request) =>
      client.invalidateQueries({ queryKey: serviceRequestsQuery(request.sessionId).queryKey }),
  });
}

/* ---------- Admin: floor service ---------- */

/**
 * The floor's cached service for this branch updated straight away (`update`); returns how to
 * put it back if the server refuses. Afterwards what `change` touches is read again
 * (api/refreshAfter), so every screen in this browser agrees with the server.
 */
function useOptimisticService<V extends { branchId: string }, R>(
  send: (token: string, variables: V) => Promise<R>,
  update: (service: AdminBranchService, variables: V) => AdminBranchService,
  change: Change,
) {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (variables: V) => {
      if (!token) throw new ApiError(401, 'admin', { error: 'unauthorized' });
      return send(token, variables);
    },
    onMutate: async (variables) => {
      const { queryKey } = branchServiceQuery(token, variables.branchId);
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData(queryKey);
      if (previous) client.setQueryData(queryKey, update(previous, variables));
      return { queryKey, previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(context.queryKey, context.previous);
    },
    onSettled: (_data, _error, variables) => refreshAfter(client, change, variables.branchId),
  });
}

/**
 * POST /admin/service-requests/:id/acknowledge: "On my way". The request shows who's coming at
 * once (as it was if the server refuses); the guest's pending requests refresh.
 */
export const useAcknowledgeRequest = () =>
  useOptimisticService(
    (
      token,
      { request }: { branchId: string; request: AdminServiceRequest; by: string; at: string },
    ) => api.acknowledgeServiceRequest(token, request.id),
    (service, { request, by, at }) => withAcknowledged(service, request.id, by, at),
    'requestHandled',
  );

/**
 * POST /admin/service-requests/:id/resolve: a waiter dealt with the request. It leaves the
 * queue at once (back if the server refuses); the guest's pending requests refresh.
 */
export const useResolveRequest = () =>
  useOptimisticService(
    (token, { request }: { branchId: string; request: AdminServiceRequest }) =>
      api.resolveServiceRequest(token, request.id),
    (service, { request }) => withoutRequest(service, request.id),
    'requestHandled',
  );

/**
 * POST /admin/orders/:id/served: the round (every ready round without one) is at the table or
 * handed over. It leaves the queue at once (back if the server refuses); orders refresh.
 */
export const useMarkServed = () =>
  useOptimisticService(
    (token, { orderId, round }: { branchId: string; orderId: string; round?: number }) =>
      api.markOrderServed(token, orderId, { round }),
    (service, { orderId, round }) => withoutReadyRound(service, orderId, round),
    'served',
  );

/**
 * PATCH /admin/branches/:branchId/orders/:id/rounds/:round/status: the kitchen started a round
 * or has it ready, or (`back`: an undo, a recall) moved it back. The ticket moves lanes at once
 * (back if the server refuses); then the floor (Ready to serve, the Orders page) and the guests'
 * tracking read fresh.
 */
export function useSetKitchenStatus() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      orderId,
      round,
      step,
      back,
    }: {
      branchId: string;
      orderId: string;
      round: number;
      step: KitchenStep;
      back?: boolean;
    }) =>
      api.setKitchenStatus(requireToken(token), branchId, orderId, round, {
        status: step,
        ...(back ? { back: true } : {}),
      }),
    onMutate: async ({ branchId, orderId, round, step }) => {
      const { queryKey } = branchOrdersQuery(token, branchId);
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData(queryKey);
      if (previous) {
        client.setQueryData(queryKey, {
          ...previous,
          orders: withKitchenStep(previous.orders, orderId, round, step),
        });
      }
      return { queryKey, previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(context.queryKey, context.previous);
    },
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'kitchenStep', branchOf(variables)),
  });
}

/**
 * PATCH …/orders/:id/rush: a waiter marks the order rush (or not). Then the floor and the kitchen
 * read fresh (the kitchen also hears it from the branch's events).
 */
export function useSetRush() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      orderId,
      rush,
    }: {
      branchId: string;
      orderId: string;
      rush: boolean;
    }) => api.setRush(requireToken(token), branchId, orderId, { rush }),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'orderChanged', branchOf(variables)),
  });
}

/**
 * POST …/orders/:id/messages: the kitchen tells the waiters about an order (running late, an
 * item unavailable, a question). It lands on their Requests board.
 */
export function useSendKitchenMessage() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      orderId,
      ...body
    }: { branchId: string; orderId: string } & KitchenMessageRequest) =>
      api.sendKitchenMessage(requireToken(token), branchId, orderId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'kitchenMessage', branchOf(variables)),
  });
}

/**
 * POST …/orders/:id/rounds/:round/cancel: a waiter takes back a round the kitchen hasn't
 * started and that isn't paid (the only round cancels the order). Orders read again.
 */
export function useCancelRound() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      orderId,
      round,
      ...body
    }: { branchId: string; orderId: string; round: number } & CancelRoundRequest) =>
      api.cancelRound(requireToken(token), branchId, orderId, round, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'orderChanged', branchOf(variables)),
  });
}

/**
 * The kitchen can't make something (sold out): some of an item (POST …/rounds/:round/items/
 * :position/unavailable) or the whole order (POST …/orders/:id/unavailable). The bill comes down
 * (or the order is cancelled) and the waiters are told; the boards and orders are read again.
 */
export function useMarkUnavailable() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (
      target:
        | ({
            kind: 'item';
            branchId: string;
            orderId: string;
            round: number;
            index: number;
          } & ItemUnavailableRequest)
        | ({ kind: 'order'; branchId: string; orderId: string } & OrderUnavailableRequest),
    ) =>
      target.kind === 'item'
        ? api.itemUnavailable(
            requireToken(token),
            target.branchId,
            target.orderId,
            target.round,
            target.index,
            {
              quantity: target.quantity,
              ...(target.note ? { note: target.note } : {}),
            },
          )
        : api.orderUnavailable(requireToken(token), target.branchId, target.orderId, {
            ...(target.note ? { note: target.note } : {}),
          }),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'itemUnavailable', branchOf(variables)),
  });
}

/**
 * PATCH …/orders/:id/rounds/:round/items/:position/plated: an item ticked off as plated (or not).
 * The tick shows at once (taken back if the server refuses); other kitchen screens see it from
 * the branch's events.
 */
export function useSetPlated() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      orderId,
      round,
      index,
      plated,
    }: {
      branchId: string;
      orderId: string;
      round: number;
      index: number;
      plated: boolean;
    }) => api.setPlated(requireToken(token), branchId, orderId, round, index, { plated }),
    onMutate: async ({ branchId, orderId, round, index, plated }) => {
      const { queryKey } = branchOrdersQuery(token, branchId);
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData(queryKey);
      if (previous) {
        client.setQueryData(queryKey, {
          ...previous,
          orders: withPlated(previous.orders, orderId, round, index, plated),
        });
      }
      return { queryKey, previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(context.queryKey, context.previous);
    },
  });
}

/**
 * POST …/orders/:id/rounds/:round/dismiss: a cancelled ticket put away. It leaves this screen at
 * once (back if the server refuses); the other kitchen screens drop it from the branch's events.
 */
export function useDismissTicket() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      orderId,
      round,
    }: {
      branchId: string;
      orderId: string;
      round: number;
    }) => api.dismissTicket(requireToken(token), branchId, orderId, round),
    onMutate: async ({ branchId, orderId, round }) => {
      const { queryKey } = branchOrdersQuery(token, branchId);
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData(queryKey);
      if (previous) {
        client.setQueryData(queryKey, {
          ...previous,
          orders: withDismissed(previous.orders, orderId, round, new Date().toISOString()),
        });
      }
      return { queryKey, previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(context.queryKey, context.previous);
    },
  });
}

/** The admin's token, or a 401 like the server's when signed out. */
function requireToken(token: string | null): string {
  if (!token) throw new ApiError(401, 'admin', { error: 'unauthorized' });
  return token;
}

/** POST /admin/branches/:branchId/tables/:table/orders: a waiter takes a new order at the table. */
export function useTakeTableOrder() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      table,
      body,
    }: {
      branchId: string;
      table: number;
      body: TakeTableOrderRequest;
    }) => api.takeTableOrder(requireToken(token), branchId, table, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'orderChanged', branchOf(variables)),
  });
}

/** POST /admin/branches/:branchId/orders/:id/rounds: a waiter adds items to an open order. */
export function useAddStaffRound() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      orderId,
      body,
    }: {
      branchId: string;
      orderId: string;
      body: StaffRoundRequest;
    }) => api.addStaffRound(requireToken(token), branchId, orderId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'orderChanged', branchOf(variables)),
  });
}

/** POST /admin/branches/:branchId/orders/:id/payment: staff took the payment in person. */
export function useCollectPayment() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      orderId,
      body,
    }: {
      branchId: string;
      orderId: string;
      body: CollectPaymentRequest;
    }) => api.collectPayment(requireToken(token), branchId, orderId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'paymentTaken', branchOf(variables)),
  });
}

/** POST /admin/branches/:branchId/orders/:id/refund: staff give money back on an order. */
export function useRefundOrder() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      orderId,
      body,
    }: {
      branchId: string;
      orderId: string;
      body: RefundRequest;
    }) => api.refundOrder(requireToken(token), branchId, orderId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'refundGiven', branchOf(variables)),
  });
}

/** POST …/orders/:id/refunds/:seq/received: an online refund reached the guest. */
export function useRefundReceived() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, orderId, seq }: { branchId: string; orderId: string; seq: number }) =>
      api.refundReceived(requireToken(token), branchId, orderId, seq),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'refundReceived', branchOf(variables)),
  });
}

/** POST …/reservations/:id/deposit: the guest's advance recorded on the booking. */
export function useRecordDeposit() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, body }: { branchId: string; id: string; body: DepositRequest }) =>
      api.recordDeposit(requireToken(token), branchId, id, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'depositTaken', branchOf(variables)),
  });
}

/** POST …/reservations/:id/reminded: staff reminded the guest (WhatsApp or SMS). */
export function useMarkReminded() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id }: { branchId: string; id: string }) =>
      api.reservationReminded(requireToken(token), branchId, id),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'bookingChanged', branchOf(variables)),
  });
}

/** PATCH …/reservations/rules: the branch's no-show and deposit rules. */
export function useSetReservationRules() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, rules }: { branchId: string; rules: ReservationRules }) =>
      api.setReservationRules(requireToken(token), branchId, rules),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'bookingChanged', branchOf(variables)),
  });
}

/** POST /admin/branches/:branchId/orders/:id/cancel: the restaurant cancels an order. */
export function useCancelByStaff() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      orderId,
      body,
    }: {
      branchId: string;
      orderId: string;
      body: CancelByStaffRequest;
    }) => api.cancelByStaff(requireToken(token), branchId, orderId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'orderChanged', branchOf(variables)),
  });
}

/** PATCH /admin/branches/:branchId/orders/:id/rounds/:round: a waiter changes a round's items. */
export function useEditStaffRound() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      orderId,
      round,
      body,
    }: {
      branchId: string;
      orderId: string;
      round: number;
      body: EditRoundRequest;
    }) => api.editStaffRound(requireToken(token), branchId, orderId, round, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'orderChanged', branchOf(variables)),
  });
}

/** POST /admin/branches/:branchId/tables/:table/payment: the whole table paid in person. */
export function useCollectTablePayment() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      table,
      body,
    }: {
      branchId: string;
      table: number;
      body: CollectTableRequest;
    }) => api.collectTablePayment(requireToken(token), branchId, table, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'paymentTaken', branchOf(variables)),
  });
}

/**
 * PATCH /admin/branches/:branchId/floors: saves the floor plan. Everything that reads it is read
 * again: the staff pages (floor plan, tables, QR codes, reservations) and the branches (the
 * tables guests can scan).
 */
export function useUpdateFloors() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: UpdateFloorsRequest }) =>
      api.updateFloors(requireToken(token), branchId, body),
    onSuccess: (layout, { branchId }) =>
      client.setQueryData(floorLayoutQuery(token, branchId).queryKey, layout),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'floorPlanChanged', branchOf(variables)),
  });
}

/** POST /admin/branches/:branchId/tables/:table/free: the guests left, the table is free. */
export function useFreeTable() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, table }: { branchId: string; table: number }) =>
      api.freeTable(requireToken(token), branchId, table),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'tableChanged', branchOf(variables)),
  });
}

/**
 * PATCH …/tables/sections: tables given to a waiter (or released); DELETE: clear all. The floor
 * (and who covers what) is read again.
 */
export function useAssignTables() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      tables,
      waiterId,
    }: {
      branchId: string;
      tables: number[];
      /** A waiter's id, "me" (the signed-in staff member) or null (nobody). */
      waiterId: string | null;
    }) => api.assignTables(requireToken(token), branchId, { tables, waiterId }),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'tableChanged', branchOf(variables)),
  });
}

/** POST …/shifts/start or …/end: clock in or out; my shift (and, out, the floor) read again. */
export function useShiftClock() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, action }: { branchId: string; action: 'start' | 'end' }) =>
      action === 'start'
        ? api.startShift(requireToken(token), branchId)
        : api.endShift(requireToken(token), branchId),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'shiftChanged', branchOf(variables)),
  });
}

/**
 * Team › Attendance: fix a shift's times (`id`) or add a forgotten one (`add`); the list, my
 * shift and (a shift closed) the floor read again.
 */
export function useFixAttendance() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (
      target:
        | { branchId: string; id: string; body: FixShiftRequest }
        | { branchId: string; add: AddShiftRequest },
    ): Promise<unknown> =>
      'add' in target
        ? api.addShift(requireToken(token), target.branchId, target.add)
        : api.fixShift(requireToken(token), target.branchId, target.id, target.body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'shiftChanged', branchOf(variables)),
  });
}

/** POST …/rota/types (no `id`) or PATCH …/rota/types/:id, or archive (`archive`). */
export function useSaveShiftType() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (
      target:
        | { branchId: string; id?: undefined; body: ShiftTypeRequest }
        | { branchId: string; id: string; body: Partial<ShiftTypeRequest> }
        | { branchId: string; id: string; archive: true },
    ): Promise<unknown> =>
      'archive' in target
        ? api.archiveShiftType(requireToken(token), target.branchId, target.id)
        : target.id === undefined
          ? api.addShiftType(requireToken(token), target.branchId, target.body)
          : api.updateShiftType(requireToken(token), target.branchId, target.id, target.body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'rotaChanged', branchOf(variables)),
  });
}

/** POST …/rota/shifts (someone's shift on a day), or DELETE …/rota/shifts/:id (`remove`). */
export function useSaveRotaShift() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (
      target:
        { branchId: string; body: SaveRotaShiftRequest } | { branchId: string; remove: string },
    ): Promise<unknown> =>
      'remove' in target
        ? api.removeRotaShift(requireToken(token), target.branchId, target.remove)
        : api.saveRotaShift(requireToken(token), target.branchId, target.body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'rotaChanged', branchOf(variables)),
  });
}

/** PATCH …/rota/settings: the weekly hours warning. */
export function useRotaSettings() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      weekHoursLimit,
    }: {
      branchId: string;
      weekHoursLimit: number | null;
    }) => api.rotaSettings(requireToken(token), branchId, weekHoursLimit),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'rotaChanged', branchOf(variables)),
  });
}

/** Time off: ask (staff), cancel (one's own) or decide (a planner). */
export function useTimeOff() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (
      target:
        | { branchId: string; ask: { from: string; to: string; reason: string } }
        | { branchId: string; id: string; cancel: true }
        | { branchId: string; id: string; decide: { approve: boolean; note?: string } },
    ) =>
      'ask' in target
        ? api.askTimeOff(requireToken(token), target.branchId, target.ask)
        : 'cancel' in target
          ? api.timeOffAction(requireToken(token), target.branchId, target.id, 'cancel')
          : api.timeOffAction(
              requireToken(token),
              target.branchId,
              target.id,
              'decide',
              target.decide,
            ),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'rotaChanged', branchOf(variables)),
  });
}

/** Swaps: ask a colleague, the colleague's answer, cancel (the asker) or decide (a planner). */
export function useShiftSwap() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (
      target:
        | { branchId: string; ask: { shiftId: string; toStaffId: string; note?: string } }
        | { branchId: string; id: string; respond: boolean }
        | { branchId: string; id: string; cancel: true }
        | { branchId: string; id: string; decide: { approve: boolean; note?: string } },
    ) =>
      'ask' in target
        ? api.askSwap(requireToken(token), target.branchId, target.ask)
        : 'respond' in target
          ? api.swapAction(requireToken(token), target.branchId, target.id, 'respond', {
              accept: target.respond,
            })
          : 'cancel' in target
            ? api.swapAction(requireToken(token), target.branchId, target.id, 'cancel')
            : api.swapAction(
                requireToken(token),
                target.branchId,
                target.id,
                'decide',
                target.decide,
              ),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'rotaChanged', branchOf(variables)),
  });
}

/** POST …/rota/copy | clear | publish {week}. */
export function useRotaWeekAction() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      action,
      week,
    }: {
      branchId: string;
      action: 'copy' | 'clear' | 'publish';
      week: string;
    }) => api.rotaWeekAction(requireToken(token), branchId, action, week),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'rotaChanged', branchOf(variables)),
  });
}

/** PATCH …/tables/:table/note: the guests' note for the visit; the floor and orders read again. */
export function useSetTableNote() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      table,
      text,
      tags,
    }: {
      branchId: string;
      table: number;
      text: string;
      tags: string[];
    }) => api.setTableNote(requireToken(token), branchId, table, { text, tags }),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'tableChanged', branchOf(variables)),
  });
}

export function useClearSections() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId }: { branchId: string }) =>
      api.clearSections(requireToken(token), branchId),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'tableChanged', branchOf(variables)),
  });
}

/**
 * POST …/reservations (no `id`) or PATCH …/reservations/:id: a booking taken or changed. The
 * floor plan and the bookings are read again.
 */
export function useSaveReservation() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      id,
      body,
    }: {
      branchId: string;
      id?: string;
      body: ReservationInput;
    }) =>
      id
        ? api.updateReservation(requireToken(token), branchId, id, body)
        : api.createReservation(requireToken(token), branchId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'bookingChanged', branchOf(variables)),
  });
}

/** PATCH …/reservations/:id/status: seated, cancelled, a no-show, or restored. */
export function useSetReservationStatus() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      id,
      body,
    }: {
      branchId: string;
      id: string;
      body: SetReservationStatusRequest;
    }) => api.setReservationStatus(requireToken(token), branchId, id, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'bookingChanged', branchOf(variables)),
  });
}

/**
 * PATCH …/menu/dishes/:slug/availability: sold out, off today or back on (and sizes). The menu
 * shows it at once (as it was if the server refuses).
 */
export function useSetDishAvailability() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      slug,
      body,
    }: {
      branchId: string;
      slug: string;
      body: SetAvailabilityRequest;
    }) => api.setDishAvailability(requireToken(token), branchId, slug, body),
    onMutate: async ({ branchId, slug, body }) => {
      const { queryKey } = branchMenuQuery(branchId);
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData(queryKey);
      if (previous) client.setQueryData(queryKey, withAvailability(previous, slug, body));
      return { queryKey, previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(context.queryKey, context.previous);
    },
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'menuChanged', branchOf(variables)),
  });
}

/** POST …/menu/dishes (no slug) or PATCH …/menu/dishes/:slug: a dish added or edited. */
export function useSaveDish() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, slug, body }: { branchId: string; slug?: string; body: DishInput }) =>
      slug
        ? api.updateDish(requireToken(token), branchId, slug, body)
        : api.createDish(requireToken(token), branchId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'menuChanged', branchOf(variables)),
  });
}

/** DELETE …/menu/dishes/:slug: a dish off the menu for good. */
export function useRemoveDish() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, slug }: { branchId: string; slug: string }) =>
      api.removeDish(requireToken(token), branchId, slug),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'menuChanged', branchOf(variables)),
  });
}

/** PATCH …/menu/categories/:categoryId/order: the order guests see a category's dishes in. */
export function useReorderDishes() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      categoryId,
      slugs,
    }: {
      branchId: string;
      categoryId: string;
      slugs: string[];
    }) => api.reorderDishes(requireToken(token), branchId, categoryId, { slugs }),
    onSuccess: (menu, { branchId }) =>
      client.setQueryData(branchMenuQuery(branchId).queryKey, menu),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'menuChanged', branchOf(variables)),
  });
}

/** PATCH …/menu/categories: the categories renamed and in their order. */
export function useUpdateCategories() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: UpdateCategoriesRequest }) =>
      api.updateCategories(requireToken(token), branchId, body),
    onSuccess: (menu, { branchId }) =>
      client.setQueryData(branchMenuQuery(branchId).queryKey, menu),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'menuChanged', branchOf(variables)),
  });
}

/** POST …/menu/categories (`add`) or DELETE …/menu/categories/:id (`remove`, moving its dishes). */
export function useCategoryChange() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (
      change:
        | { branchId: string; add: { name: string; description?: string; drinks?: boolean } }
        | { branchId: string; remove: string; moveTo?: string },
    ): Promise<MenuData | void> =>
      'add' in change
        ? api.addCategory(requireToken(token), change.branchId, change.add)
        : api.removeCategory(requireToken(token), change.branchId, change.remove, change.moveTo),
    // Adding answers the menu; removing is read again (below).
    onSuccess: (menu, { branchId }) => {
      if (menu) client.setQueryData(branchMenuQuery(branchId).queryKey, menu);
    },
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'menuChanged', branchOf(variables)),
  });
}

/** POST …/menu/images: a dish picture (resized by the app), to put on the dish. */
export function useUploadDishImage() {
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: ImageUploadRequest }) =>
      api.uploadDishImage(requireToken(token), branchId, body),
  });
}

/** POST …/settings/image: the branch photo (resized by the app), to save with the details. */
export function useUploadBranchImage() {
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: ImageUploadRequest }) =>
      api.uploadBranchImage(requireToken(token), branchId, body),
  });
}

/**
 * PATCH …/menu/suggestions (Admin › Menu › Search suggestions): staff's pins, words and auto-fill
 * switches. The screen shows the answer at once; guests' suggestions and the menu are read again.
 */
export function useSaveSearchSuggestions() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: UpdateSearchSuggestionsRequest }) =>
      api.updateSearchSuggestions(requireToken(token), branchId, body),
    onSuccess: (saved, { branchId }) =>
      client.setQueryData(adminSearchSuggestionsQuery(token, branchId).queryKey, saved),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'searchSuggestionsChanged', branchOf(variables)),
  });
}

/**
 * PATCH …/menu/cart-suggestions (Admin › Menu › Suggestions › Cart): the switch, categories and
 * pins. The tab shows the answer at once; guests' cart suggestions and the menu are read again.
 */
export function useSaveCartSuggestions() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      body,
      preview,
    }: {
      branchId: string;
      body: UpdateCartSuggestionsRequest;
      preview?: string;
    }) => api.updateCartSuggestions(requireToken(token), branchId, body, preview),
    onSuccess: (saved, { branchId, preview }) =>
      client.setQueryData(adminCartSuggestionsQuery(token, branchId, preview).queryKey, saved),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'cartSuggestionsChanged', branchOf(variables)),
  });
}

/** POST …/cash-register/open: the drawer opens with a float. */
export function useOpenRegister() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: OpenRegisterRequest }) =>
      api.openRegister(requireToken(token), branchId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'cashChanged', branchOf(variables)),
  });
}

/** POST …/cash-register/movements: cash paid in or out. */
export function useMoveCash() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: CashMovementRequest }) =>
      api.moveCash(requireToken(token), branchId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'cashChanged', branchOf(variables)),
  });
}

/** POST …/cash-register/close: the count (409 count_differs until a difference has a reason). */
export function useCloseRegister() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: CloseRegisterRequest }) =>
      api.closeRegister(requireToken(token), branchId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'cashChanged', branchOf(variables)),
  });
}

/** POST …/cash-register/days/:day/sign-off: a manager accepts the day's register. */
export function useSignOffCashDay() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, day, note }: { branchId: string; day: string; note?: string }) =>
      api.signOffCashDay(requireToken(token), branchId, day, note),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'cashChanged', branchOf(variables)),
  });
}

/** POST …/cash-register/sessions/:id/check: a manager checked a drawer that needed it. */
export function useCheckCashSession() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, note }: { branchId: string; id: string; note?: string }) =>
      api.checkCashSession(requireToken(token), branchId, id, note),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'cashChanged', branchOf(variables)),
  });
}

/** PATCH …/cash-register/limit: how big a difference can be before it needs review. */
export function useSetCashLimit() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, differenceLimit }: { branchId: string; differenceLimit: number }) =>
      api.setCashLimit(requireToken(token), branchId, differenceLimit),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'cashChanged', branchOf(variables)),
  });
}

/**
 * PATCH …/features (super admins): a module switched on or off for the restaurant. Everything
 * it changes is read again: permissions (the branches), the menu (dishes stock had taken off).
 */
export function useSetFeatures() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, inventory }: { branchId: string; inventory: boolean }) =>
      api.setFeatures(requireToken(token), branchId, { inventory }),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'featuresChanged', branchOf(variables)),
  });
}

/* ---------- Purchasing (backend only) ---------- */

/** Purchasing changed: it, and the stock it moves, are read again. */
function usePurchasingMutation<V extends { branchId: string }, R>(
  call: (token: string, variables: V) => Promise<R>,
) {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (variables: V) => call(requireToken(token), variables),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'purchasingChanged', branchOf(variables)),
  });
}

export const useSaveSupplier = () =>
  usePurchasingMutation((token, v: { branchId: string; id?: string; body: SupplierInput }) =>
    v.id
      ? api.updateSupplier(token, v.branchId, v.id, v.body)
      : api.createSupplier(token, v.branchId, v.body),
  );
export const useArchiveSupplier = () =>
  usePurchasingMutation((token, v: { branchId: string; id: string }) =>
    api.archiveSupplier(token, v.branchId, v.id),
  );
export const useSetSupplierItems = () =>
  usePurchasingMutation((token, v: { branchId: string; id: string; items: SupplierItemInput[] }) =>
    api.setSupplierItems(token, v.branchId, v.id, v.items),
  );
export const useSavePurchaseOrder = () =>
  usePurchasingMutation((token, v: { branchId: string; id?: string; body: OrderInput }) =>
    v.id
      ? api.updatePurchaseOrder(token, v.branchId, v.id, {
          lines: v.body.lines,
          ...(v.body.expectedOn ? { expectedOn: v.body.expectedOn } : {}),
          ...(v.body.note ? { note: v.body.note } : {}),
        })
      : api.createPurchaseOrder(token, v.branchId, v.body),
  );
export const useSuggestPurchaseOrder = () =>
  usePurchasingMutation((token, v: { branchId: string; supplierId: string }) =>
    api.suggestPurchaseOrder(token, v.branchId, v.supplierId),
  );
export const usePurchaseOrderStep = () =>
  usePurchasingMutation(
    (token, v: { branchId: string; id: string; step: 'approve' | 'send' | 'cancel' | 'close' }) =>
      api.purchaseOrderStep(token, v.branchId, v.id, v.step),
  );
export const useSetPurchasingSettings = () =>
  usePurchasingMutation((token, v: { branchId: string; body: Partial<PurchasingSettings> }) =>
    api.setPurchasingSettings(token, v.branchId, v.body),
  );
export const useReceive = () =>
  usePurchasingMutation((token, v: { branchId: string; body: ReceiptInput }) =>
    api.receive(token, v.branchId, v.body),
  );
export const useConfirmPrices = () =>
  usePurchasingMutation(
    (token, v: { branchId: string; id: string; lines: { lineId: string; price: number }[] }) =>
      api.confirmPrices(token, v.branchId, v.id, v.lines),
  );
export const useCreatePurchaseReturn = () =>
  usePurchasingMutation((token, v: { branchId: string; body: ReturnInput }) =>
    api.createPurchaseReturn(token, v.branchId, v.body),
  );

/** POST …/purchasing/proofs: an invoice photo kept privately; its key. */
export function useUploadPurchaseProof() {
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: PaymentProofRequest }) =>
      api.uploadPurchaseProof(requireToken(token), branchId, body),
  });
}

/* ---------- Inventory (backend only) ---------- */

/** A mutation on the branch's inventory that reads it all again afterwards. */
function useInventoryMutation<V extends { branchId: string }, R>(
  call: (token: string, variables: V) => Promise<R>,
) {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (variables: V) => call(requireToken(token), variables),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'stockChanged', branchOf(variables)),
  });
}

/** POST …/inventory/opening: the first stock of items, at their cost (409 opening_done). */
export const useOpeningStock = () =>
  useInventoryMutation((token, v: { branchId: string; body: StockEntryRequest<OpeningLine> }) =>
    api.openingStock(token, v.branchId, v.body),
  );

/** POST …/inventory/adjustments: up or down by an amount, or to a count, with a reason. */
export const useAdjustStock = () =>
  useInventoryMutation((token, v: { branchId: string; body: StockEntryRequest<AdjustmentLine> }) =>
    api.adjustStock(token, v.branchId, v.body),
  );

/** POST …/inventory/wastage: stock thrown away, and why. */
export const useWasteStock = () =>
  useInventoryMutation((token, v: { branchId: string; body: StockEntryRequest<WastageLine> }) =>
    api.wasteStock(token, v.branchId, v.body),
  );

/** PATCH …/inventory/batches/:id: a batch dated, coded or split. */
export const useUpdateBatch = () =>
  useInventoryMutation((token, v: { branchId: string; id: string; body: UpdateBatchRequest }) =>
    api.updateBatch(token, v.branchId, v.id, v.body),
  );

/** POST …/inventory/batches/write-off: expired stock thrown away (wastage "expired"). */
export const useWriteOffBatches = () =>
  useInventoryMutation((token, v: { branchId: string; body: WriteOffRequest }) =>
    api.writeOffBatches(token, v.branchId, v.body),
  );

/** POST …/inventory/counts: a count started (all, a category, or chosen items). */
export const useStartCount = () =>
  useInventoryMutation(
    (token, v: { branchId: string; body: Parameters<typeof api.startCount>[2] }) =>
      api.startCount(token, v.branchId, v.body),
  );

/** PATCH …/inventory/counts/:id/lines: counted quantities, saved as staff go. */
export const useSaveCountLines = () =>
  useInventoryMutation(
    (token, v: { branchId: string; id: string; lines: Parameters<typeof api.saveCountLines>[3] }) =>
      api.saveCountLines(token, v.branchId, v.id, v.lines),
  );

/** POST …/inventory/counts/:id/submit | apply | cancel */
export const useCountStep = () =>
  useInventoryMutation(
    (
      token,
      v: {
        branchId: string;
        id: string;
        step: 'submit' | 'apply' | 'cancel';
        notes?: { ingredientId: string; note: string }[];
      },
    ) => api.countStep(token, v.branchId, v.id, v.step, v.notes ? { notes: v.notes } : {}),
  );

/** POST …/inventory/transfers: stock sent to another branch. */
export const useSendTransfer = () =>
  useInventoryMutation((token, v: { branchId: string; body: SendTransferRequest }) =>
    api.sendTransfer(token, v.branchId, v.body),
  );

/** POST …/inventory/transfers/:id/receive | cancel */
export const useTransferStep = () =>
  useInventoryMutation(
    (
      token,
      v: {
        branchId: string;
        id: string;
        step: 'receive' | 'cancel';
        lines?: { ingredientId: string; received: number }[];
      },
    ) => api.transferStep(token, v.branchId, v.id, v.step, v.lines ? { lines: v.lines } : {}),
  );

/** POST …/inventory/production: a batch of a prepared item made. */
export const useProduceStock = () =>
  useInventoryMutation((token, v: { branchId: string; body: ProductionRequest }) =>
    api.produceStock(token, v.branchId, v.body),
  );

/**
 * PATCH …/inventory/recipes/:dishSlug: the dish's recipe, replaced whole (its dishes are checked
 * against stock: the menu is read again too).
 */
export function useSaveRecipe() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (v: { branchId: string; slug: string; lines: RecipeLineInput[] }) =>
      api.saveRecipe(requireToken(token), v.branchId, v.slug, v.lines),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'recipeChanged', branchOf(variables)),
  });
}

/** PATCH …/inventory/settings: the food cost target (a percentage). */
export const useSetFoodCostTarget = () =>
  useInventoryMutation((token, v: { branchId: string; target: number }) =>
    api.setFoodCostTarget(token, v.branchId, v.target),
  );

/** PATCH …/inventory/stock/:ingredientId: tracking, levels, cost. */
export const useUpdateStockItem = () =>
  useInventoryMutation(
    (token, v: { branchId: string; ingredientId: string; body: UpdateStockRequest }) =>
      api.updateInventoryItem(token, v.branchId, v.ingredientId, v.body),
  );

/** POST …/inventory/ingredients (409 name_taken). */
export const useCreateIngredient = () =>
  useInventoryMutation((token, v: { branchId: string; body: CreateIngredientRequest }) =>
    api.createIngredient(token, v.branchId, v.body),
  );

/** PATCH …/inventory/ingredients/:id (409 name_taken, ingredient_in_use). */
export const useUpdateIngredient = () =>
  useInventoryMutation(
    (token, v: { branchId: string; id: string; body: UpdateIngredientRequest }) =>
      api.updateIngredient(token, v.branchId, v.id, v.body),
  );

/** DELETE …/inventory/ingredients/:id: archived (409 ingredient_in_use while any is held). */
export const useArchiveIngredient = () =>
  useInventoryMutation((token, v: { branchId: string; id: string }) =>
    api.archiveIngredient(token, v.branchId, v.id),
  );

/** POST …/inventory/categories (409 name_taken). */
export const useCreateIngredientCategory = () =>
  useInventoryMutation((token, v: { branchId: string; name: string }) =>
    api.createIngredientCategory(token, v.branchId, v.name),
  );

/** PATCH …/inventory/categories/:id: renamed. */
export const useRenameIngredientCategory = () =>
  useInventoryMutation((token, v: { branchId: string; id: string; name: string }) =>
    api.updateIngredientCategory(token, v.branchId, v.id, { name: v.name }),
  );

/** DELETE …/inventory/categories/:id: its ingredients stay, in none. */
export const useDeleteIngredientCategory = () =>
  useInventoryMutation((token, v: { branchId: string; id: string }) =>
    api.deleteIngredientCategory(token, v.branchId, v.id),
  );

/** POST /admin/branches/:branchId/payment-proofs: a proof photo kept privately; its key. */
export function useUploadPaymentProof() {
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: PaymentProofRequest }) =>
      api.uploadPaymentProof(requireToken(token), branchId, body),
  });
}

/**
 * PATCH /admin/branches/:branchId/status: pause new orders, close for the day, or open again.
 * The admin's branches and the branch data guests read are read again.
 */
export function useSetBranchStatus() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: SetBranchStatusRequest }) =>
      api.setBranchStatus(requireToken(token), branchId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'branchStatusChanged', branchOf(variables)),
  });
}

/**
 * PATCH /admin/branches/:branchId/settings (a Settings page's section): the page's draft
 * becomes the saved settings at once, then the branch data is read again everywhere.
 */
export function useUpdateBranchSettings() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: UpdateBranchSettingsRequest }) =>
      api.updateBranchSettings(requireToken(token), branchId, body),
    onSuccess: (saved, { branchId }) =>
      client.setQueryData(branchSettingsQuery(token, branchId).queryKey, saved),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'branchSetupChanged', branchOf(variables)),
  });
}

/** POST /admin/branches (Settings › Branches › Add branch). */
export function useCreateBranch() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (body: CreateBranchRequest) => api.createBranch(requireToken(token), body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'branchSetupChanged', branchOf(variables)),
  });
}

/** DELETE /admin/branches/:branchId (Settings › Branches › Remove). */
export function useRemoveBranch() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (branchId: string) => api.removeBranch(requireToken(token), branchId),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'branchSetupChanged', branchOf(variables)),
  });
}

/** Offers changed: Settings › Offers lists them again, and the menu's prices follow. */
/** POST …/staff (no `id`) or PATCH …/staff/:staffId. */
export function useSaveStaff() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (
      target:
        | { branchId: string; id?: undefined; body: AddStaffRequest }
        | { branchId: string; id: string; body: UpdateStaffRequest },
    ) =>
      target.id === undefined
        ? api.addStaff(requireToken(token), target.branchId, target.body)
        : api.updateStaff(requireToken(token), target.branchId, target.id, target.body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'staffChanged', branchOf(variables)),
  });
}

/** POST …/staff/:staffId/password: a new password for them, changed at their next sign-in. */
export function useResetStaffPassword() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, password }: { branchId: string; id: string; password: string }) =>
      api.resetStaffPassword(requireToken(token), branchId, id, { password }),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'staffChanged', branchOf(variables)),
  });
}

/** POST …/staff/:staffId/remove: removed from the team here, with why (soft; history stays). */
export function useRemoveStaff() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, reason }: { branchId: string; id: string; reason: string }) =>
      api.removeStaff(requireToken(token), branchId, id, { reason }),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'staffChanged', branchOf(variables)),
  });
}

/** POST …/staff/:staffId/restore: someone removed, back on the team. */
export function useRestoreStaff() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, roleId }: { branchId: string; id: string; roleId?: string }) =>
      api.restoreStaff(requireToken(token), branchId, id, roleId ? { roleId } : {}),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'staffChanged', branchOf(variables)),
  });
}

/** PATCH /admin/sessions/current/password: one's own password (the first sign-in's step too). */
export function useChangeOwnPassword() {
  const token = useAdminToken();
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) => api.changeOwnPassword(requireToken(token), body),
  });
}

/** POST …/roles (no `id`) or PATCH …/roles/:roleId: a role of the restaurant's own. */
export function useSaveRole() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, body }: { branchId: string; id?: string; body: RoleInput }) =>
      id
        ? api.updateRole(requireToken(token), branchId, id, body)
        : api.createRole(requireToken(token), branchId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'rolesChanged', branchOf(variables)),
  });
}

/** DELETE …/roles/:roleId: one of the restaurant's own nobody holds. */
export function useRemoveRole() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id }: { branchId: string; id: string }) =>
      api.removeRole(requireToken(token), branchId, id),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'rolesChanged', branchOf(variables)),
  });
}

/** POST or PATCH …/offers: a new automatic offer, or one replaced in full. */
export function useSaveOffer() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, body }: { branchId: string; id?: string; body: OfferRequest }) =>
      id
        ? api.updateOffer(requireToken(token), branchId, id, body)
        : api.createOffer(requireToken(token), branchId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'offersChanged', branchOf(variables)),
  });
}

/** DELETE …/offers/:offerId. */
export function useRemoveOffer() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id }: { branchId: string; id: string }) =>
      api.removeOffer(requireToken(token), branchId, id),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'offersChanged', branchOf(variables)),
  });
}
