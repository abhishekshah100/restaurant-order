'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ServiceRequest } from '@/types/service';
import { PROMO_REFUSALS } from '@/lib/promotions';
import type { Order } from '@/types/order';
import type {
  AddRoundRequest,
  CancelOrderRequest,
  ChangeOrderRequest,
  ServiceRequestListResponse,
  SimulatePaymentRequest,
  UpdateSessionRequest,
  ValidatePromoRequest,
} from './contracts';
import { isApiError } from './client';
import { api } from './endpoints';
import { orderQuery, promoQuoteQuery, serviceRequestsQuery } from './queries';

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
