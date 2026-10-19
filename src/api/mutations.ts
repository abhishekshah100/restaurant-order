'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAdminToken } from '@/hooks/useAdminSession';
import { withAvailability } from '@/lib/adminMenu';
import { withKitchenStep } from '@/lib/kitchenBoard';
import { withAcknowledged, withoutReadyRound, withoutRequest } from '@/lib/adminService';
import type { AdminBranchService, AdminServiceRequest } from '@/types/admin';
import type { ServiceRequest } from '@/types/service';
import { PROMO_REFUSALS } from '@/lib/promotions';
import type { Order } from '@/types/order';
import type {
  AddRoundRequest,
  CancelByStaffRequest,
  CancelOrderRequest,
  ChangeOrderRequest,
  CollectPaymentRequest,
  RefundRequest,
  UpdateFloorsRequest,
  UpdateBranchSettingsRequest,
  CreateBranchRequest,
  CollectTableRequest,
  DishInput,
  ImageUploadRequest,
  EditRoundRequest,
  ReservationInput,
  ServiceRequestListResponse,
  SetAvailabilityRequest,
  SetBranchStatusRequest,
  KitchenStep,
  SetReservationStatusRequest,
  UpdateCategoriesRequest,
  SimulatePaymentRequest,
  StaffRoundRequest,
  TakeTableOrderRequest,
  UpdateSessionRequest,
  ValidatePromoRequest,
} from './contracts';
import { api } from './endpoints';
import { ApiError, isApiError } from './client';
import {
  branchMenuQuery,
  branchOrdersQuery,
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
    mutationFn: (request: ServiceRequest) => api.cancelServiceRequest(request.id),
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
 * or has it ready. The ticket moves lanes at once (back if the server refuses); then the
 * floor (Ready to serve, the Orders page) and the guests' tracking read fresh.
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
    }: {
      branchId: string;
      orderId: string;
      round: number;
      step: KitchenStep;
    }) => api.setKitchenStatus(requireToken(token), branchId, orderId, round, { status: step }),
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

/** The admin's token, or a 401 like the server's when signed out. */
function requireToken(token: string | null): string {
  if (!token) throw new ApiError(401, 'admin', { error: 'unauthorized' });
  return token;
}

/** After a waiter's order: the floor, the table and the guests' orders read fresh. */
const refreshFloor = (client: QueryClient) =>
  Promise.all(
    [['admin', 'service'], ['orders']].map((queryKey) => client.invalidateQueries({ queryKey })),
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
