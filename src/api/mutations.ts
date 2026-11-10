'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAdminToken } from '@/hooks/useAdminSession';
import { withAvailability } from '@/lib/adminMenu';
import { withDismissed, withKitchenStep, withPlated } from '@/lib/kitchenBoard';
import { withAcknowledged, withoutReadyRound, withoutRequest } from '@/lib/adminService';
import type { AdminBranchService, AdminServiceRequest, ReservationRules } from '@/types/admin';
import type { ServiceRequest } from '@/types/service';
import { PROMO_REFUSALS } from '@/lib/promotions';
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
import { ApiError, isApiError } from './client';
import {
  branchMenuQuery,
  adminSearchSuggestionsQuery,
  adminCartSuggestionsQuery,
  searchSuggestionsQuery,
  branchOrdersQuery,
  branchPromotionsQuery,
  branchServiceQuery,
  branchesQuery,
  branchSettingsQuery,
  floorLayoutQuery,
  orderQuery,
  promoQuoteQuery,
  serviceRequestsQuery,
} from './queries';

/*
 * Every write, as a TanStack mutation over api/endpoints. After a write the affected reads are
 * updated or invalidated here, so screens never refresh caches themselves.
 */

/** The order changed on the server meanwhile (too late, or cancelled): read it again. */
function refreshIfStale(client: QueryClient, error: unknown) {
  if (isApiError(error, 'window_closed') || isApiError(error, 'order_closed')) {
    return client.invalidateQueries({ queryKey: ['orders'] });
  }
}

/** The server refused the cart's promo code: price it again, so the cart says why. */
function refreshPromoIfRefused(client: QueryClient, error: unknown) {
  if (PROMO_REFUSALS.some((code) => isApiError(error, code))) {
    return client.invalidateQueries({ queryKey: ['promo-quote'] });
  }
}

/** Caches an order as the server returned it and refreshes every order list. */
function storeOrders(client: QueryClient, orders: readonly Order[]) {
  for (const order of orders) client.setQueryData(orderQuery(order.id).queryKey, order);
  return client.invalidateQueries({ queryKey: ['orders'] });
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
      if (isApiError(error, 'nothing_to_pay'))
        await client.invalidateQueries({ queryKey: ['orders'] });
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
      await Promise.all([
        storeOrders(client, orders),
        client.invalidateQueries({ queryKey: ['service-requests'] }),
      ]);
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
 * put it back if the server refuses. Afterwards the floor and the guest-side reads (orders,
 * requests) are refreshed, so every screen in this browser agrees with the server.
 */
function useOptimisticService<V extends { branchId: string }, R>(
  send: (token: string, variables: V) => Promise<R>,
  update: (service: AdminBranchService, variables: V) => AdminBranchService,
  refresh: readonly (readonly string[])[],
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
    onSettled: () =>
      Promise.all(
        [['admin', 'service'], ...refresh].map((queryKey) =>
          client.invalidateQueries({ queryKey }),
        ),
      ),
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
    [['service-requests']],
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
    [['service-requests']],
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
    [['orders']],
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
    onSettled: () => refreshFloor(client),
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
    onSettled: () => refreshFloor(client),
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
    onSettled: () => client.invalidateQueries({ queryKey: ['admin', 'service'] }),
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
    onSettled: () => refreshFloor(client),
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
    onSettled: () => refreshFloor(client),
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

/** After a waiter's order: the floor, the table and the guests' orders read fresh. */
const refreshFloor = (client: QueryClient) =>
  Promise.all(
    [['admin', 'service'], ['orders'], ['admin', 'cash-register']].map((queryKey) =>
      client.invalidateQueries({ queryKey }),
    ),
  );

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
    onSettled: () => refreshFloor(client),
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
    onSettled: () => refreshFloor(client),
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
    onSettled: () => refreshFloor(client),
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
    onSettled: () => refreshFloor(client),
  });
}

/** POST …/orders/:id/refunds/:seq/received: an online refund reached the guest. */
export function useRefundReceived() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, orderId, seq }: { branchId: string; orderId: string; seq: number }) =>
      api.refundReceived(requireToken(token), branchId, orderId, seq),
    onSettled: () => refreshFloor(client),
  });
}

/** POST …/reservations/:id/deposit: the guest's advance recorded on the booking. */
export function useRecordDeposit() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, body }: { branchId: string; id: string; body: DepositRequest }) =>
      api.recordDeposit(requireToken(token), branchId, id, body),
    onSettled: () => Promise.all([refreshFloor(client), refreshRegister(client)]),
  });
}

/** POST …/reservations/:id/reminded: staff reminded the guest (WhatsApp or SMS). */
export function useMarkReminded() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id }: { branchId: string; id: string }) =>
      api.reservationReminded(requireToken(token), branchId, id),
    onSettled: () => refreshFloor(client),
  });
}

/** PATCH …/reservations/rules: the branch's no-show and deposit rules. */
export function useSetReservationRules() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, rules }: { branchId: string; rules: ReservationRules }) =>
      api.setReservationRules(requireToken(token), branchId, rules),
    onSettled: () => refreshFloor(client),
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
    onSettled: () => refreshFloor(client),
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
    onSettled: () => refreshFloor(client),
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
    onSettled: () => refreshFloor(client),
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
    onSettled: () =>
      Promise.all(
        [['admin'], branchesQuery().queryKey].map((queryKey) =>
          client.invalidateQueries({ queryKey }),
        ),
      ),
  });
}

/** POST /admin/branches/:branchId/tables/:table/free: the guests left, the table is free. */
export function useFreeTable() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, table }: { branchId: string; table: number }) =>
      api.freeTable(requireToken(token), branchId, table),
    onSettled: () => refreshFloor(client),
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
    onSettled: () => refreshFloor(client),
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
    onSettled: () => refreshFloor(client),
  });
}

/** The branch's menu read again after a staff change (the guest app reads it after a minute). */
const refreshMenu = (client: QueryClient, branchId: string) =>
  client.invalidateQueries({ queryKey: branchMenuQuery(branchId).queryKey });

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
    onSettled: (_data, _error, { branchId }) => refreshMenu(client, branchId),
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
    onSettled: (_data, _error, { branchId }) => refreshMenu(client, branchId),
  });
}

/** DELETE …/menu/dishes/:slug: a dish off the menu for good. */
export function useRemoveDish() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, slug }: { branchId: string; slug: string }) =>
      api.removeDish(requireToken(token), branchId, slug),
    onSettled: (_data, _error, { branchId }) => refreshMenu(client, branchId),
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
    onSettled: (_data, _error, { branchId }) => refreshMenu(client, branchId),
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
    onSettled: (_data, _error, { branchId }) => refreshMenu(client, branchId),
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
    onSettled: (_data, _error, { branchId }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: searchSuggestionsQuery(branchId).queryKey }),
        client.invalidateQueries({ queryKey: branchMenuQuery(branchId).queryKey }),
      ]),
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
    onSettled: (_data, _error, { branchId }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['branches', branchId, 'cart-suggestions'] }),
        client.invalidateQueries({ queryKey: branchMenuQuery(branchId).queryKey }),
      ]),
  });
}

/** The cash register changed: it and its sessions are read again. */
const refreshRegister = (client: QueryClient) =>
  Promise.all(
    [
      ['admin', 'cash-register'],
      ['admin', 'cash-session'],
    ].map((queryKey) => client.invalidateQueries({ queryKey })),
  );

/** POST …/cash-register/open: the drawer opens with a float. */
export function useOpenRegister() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: OpenRegisterRequest }) =>
      api.openRegister(requireToken(token), branchId, body),
    onSettled: () => refreshRegister(client),
  });
}

/** POST …/cash-register/movements: cash paid in or out. */
export function useMoveCash() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: CashMovementRequest }) =>
      api.moveCash(requireToken(token), branchId, body),
    onSettled: () => refreshRegister(client),
  });
}

/** POST …/cash-register/close: the count (409 count_differs until a difference has a reason). */
export function useCloseRegister() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: CloseRegisterRequest }) =>
      api.closeRegister(requireToken(token), branchId, body),
    onSettled: () => refreshRegister(client),
  });
}

/** POST …/cash-register/days/:day/sign-off: a manager accepts the day's register. */
export function useSignOffCashDay() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, day, note }: { branchId: string; day: string; note?: string }) =>
      api.signOffCashDay(requireToken(token), branchId, day, note),
    onSettled: () => refreshRegister(client),
  });
}

/** PATCH …/cash-register/limit: how big a difference can be before it needs review. */
export function useSetCashLimit() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, differenceLimit }: { branchId: string; differenceLimit: number }) =>
      api.setCashLimit(requireToken(token), branchId, differenceLimit),
    onSettled: () => refreshRegister(client),
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
    onSettled: (_data, _error, { branchId }) =>
      Promise.all(
        [
          ['admin', 'features', branchId],
          ['admin', 'branches'],
          ['admin', 'inventory', branchId],
          ['branches', branchId, 'menu'],
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      ),
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
    onSettled: (_data, _error, { branchId }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['admin', 'purchasing', branchId] }),
        client.invalidateQueries({ queryKey: ['admin', 'inventory', branchId] }),
      ]),
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

/** A branch's stock changed: its stock, ledger, alerts and ingredients are read again. */
const refreshInventory = (client: QueryClient, branchId: string) =>
  client.invalidateQueries({ queryKey: ['admin', 'inventory', branchId] });

/** A mutation on the branch's inventory that reads it all again afterwards. */
function useInventoryMutation<V extends { branchId: string }, R>(
  call: (token: string, variables: V) => Promise<R>,
) {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (variables: V) => call(requireToken(token), variables),
    onSettled: (_data, _error, { branchId }) => refreshInventory(client, branchId),
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
    onSettled: (_data, _error, { branchId }) =>
      Promise.all([
        refreshInventory(client, branchId),
        client.invalidateQueries({ queryKey: ['branches', branchId, 'menu'] }),
      ]),
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
    onSettled: () =>
      Promise.all(
        [['admin', 'branches'], ['branches']].map((queryKey) =>
          client.invalidateQueries({ queryKey, exact: queryKey[0] === 'branches' }),
        ),
      ),
  });
}

/** After a change to a branch's setup: the admin's reads and every guest screen's branch data. */
const refreshBranches = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: ['admin'] }),
    client.invalidateQueries({ queryKey: branchesQuery().queryKey, exact: true }),
    // Each branch's rules (taxes, payments, delivery) are read on their own.
    client.invalidateQueries({
      predicate: ({ queryKey }) => queryKey[0] === 'branches' && queryKey[2] === 'config',
    }),
  ]);

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
    onSettled: () => refreshBranches(client),
  });
}

/** POST /admin/branches (Settings › Branches › Add branch). */
export function useCreateBranch() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (body: CreateBranchRequest) => api.createBranch(requireToken(token), body),
    onSettled: () => refreshBranches(client),
  });
}

/** DELETE /admin/branches/:branchId (Settings › Branches › Remove). */
export function useRemoveBranch() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: (branchId: string) => api.removeBranch(requireToken(token), branchId),
    onSettled: () => refreshBranches(client),
  });
}

/** Offers changed: Settings › Offers lists them again, and the menu's prices follow. */
/** Staff and the roles' staff counts read again after a change to who works here. */
const refreshStaff = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: ['admin', 'staff'] }),
    client.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  ]);

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
    onSettled: () => refreshStaff(client),
  });
}

/** POST …/staff/:staffId/password: a new password for them, changed at their next sign-in. */
export function useResetStaffPassword() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, password }: { branchId: string; id: string; password: string }) =>
      api.resetStaffPassword(requireToken(token), branchId, id, { password }),
    onSettled: () => refreshStaff(client),
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
    onSettled: () => client.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  });
}

/** DELETE …/roles/:roleId: one of the restaurant's own nobody holds. */
export function useRemoveRole() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id }: { branchId: string; id: string }) =>
      api.removeRole(requireToken(token), branchId, id),
    onSettled: () => client.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  });
}

const refreshOffers = (client: QueryClient, branchId: string) =>
  Promise.all([
    client.invalidateQueries({ queryKey: ['admin', 'offers', branchId] }),
    client.invalidateQueries({ queryKey: branchPromotionsQuery(branchId).queryKey }),
  ]);

/** POST or PATCH …/offers: a new automatic offer, or one replaced in full. */
export function useSaveOffer() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id, body }: { branchId: string; id?: string; body: OfferRequest }) =>
      id
        ? api.updateOffer(requireToken(token), branchId, id, body)
        : api.createOffer(requireToken(token), branchId, body),
    onSettled: (_data, _error, { branchId }) => refreshOffers(client, branchId),
  });
}

/** DELETE …/offers/:offerId. */
export function useRemoveOffer() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, id }: { branchId: string; id: string }) =>
      api.removeOffer(requireToken(token), branchId, id),
    onSettled: (_data, _error, { branchId }) => refreshOffers(client, branchId),
  });
}
