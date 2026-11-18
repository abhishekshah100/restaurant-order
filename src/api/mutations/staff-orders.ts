'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminToken } from '@/hooks/useAdminSession';
import type {
  CancelByStaffRequest,
  CollectPaymentRequest,
  CollectTableRequest,
  EditRoundRequest,
  PaymentProofRequest,
  RefundRequest,
  StaffRoundRequest,
  TakeTableOrderRequest,
  DiscountRequest,
} from '../contracts';
import { api } from '../endpoints';
import { branchOf, refreshAfter } from '../refreshAfter';
import { requireToken } from './shared';

/* ---------- Staff orders and payments ---------- */

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

/**
 * PATCH …/orders/:id/buyer (or DELETE with `buyer` null): a business customer's details for the
 * order's tax invoice, before it's paid.
 */
export function useOrderBuyer() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      orderId,
      buyer,
    }: {
      branchId: string;
      orderId: string;
      buyer: { name: string; taxId?: string; address?: string } | null;
    }) =>
      buyer
        ? api.setOrderBuyer(requireToken(token), branchId, orderId, buyer).then(() => undefined)
        : api.clearOrderBuyer(requireToken(token), branchId, orderId),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'orderBuyerChanged', branchOf(variables)),
  });
}

/** POST …/orders/:id/discounts: money off the bill or an item by hand (the order, priced again). */
export function useGiveDiscount() {
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
      body: DiscountRequest;
    }) => api.giveDiscount(requireToken(token), branchId, orderId, body),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'discountChanged', branchOf(variables)),
  });
}

/** DELETE …/orders/:id/discounts/:discountId: a manual discount taken off. */
export function useRemoveDiscount() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      orderId,
      discountId,
    }: {
      branchId: string;
      orderId: string;
      discountId: string;
    }) => api.removeDiscount(requireToken(token), branchId, orderId, discountId),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'discountChanged', branchOf(variables)),
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

/** POST /admin/branches/:branchId/payment-proofs: a proof photo kept privately; its key. */
export function useUploadPaymentProof() {
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: PaymentProofRequest }) =>
      api.uploadPaymentProof(requireToken(token), branchId, body),
  });
}
