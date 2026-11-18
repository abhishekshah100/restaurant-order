'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminToken } from '@/hooks/useAdminSession';
import type {
  OrderInput,
  PurchasingSettings,
  ReceiptInput,
  ReturnInput,
  SupplierInput,
  SupplierItemInput,
} from '@/types/purchasing';
import type { PaymentProofRequest } from '../contracts';
import { api } from '../endpoints';
import { branchOf, refreshAfter } from '../refreshAfter';
import { requireToken } from './shared';

/* ---------- Purchasing ---------- */

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
