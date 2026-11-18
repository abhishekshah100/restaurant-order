'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminToken } from '@/hooks/useAdminSession';
import { withDismissed } from '@/lib/kitchenBoard';
import { withAcknowledged, withoutReadyRound, withoutRequest } from '@/lib/adminService';
import type { AdminBranchService, AdminServiceRequest } from '@/types/admin';
import type {
  CancelRoundRequest,
  ItemUnavailableRequest,
  KitchenMessageRequest,
  OrderUnavailableRequest,
} from '../contracts';
import { api } from '../endpoints';
import { branchOf, refreshAfter, type Change } from '../refreshAfter';
import { ApiError } from '../client';
import { branchOrdersQuery, branchServiceQuery } from '../queries';
import { requireToken } from './shared';

/* ---------- Floor service and kitchen ---------- */

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
