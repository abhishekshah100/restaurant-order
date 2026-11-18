'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminToken } from '@/hooks/useAdminSession';
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
import { api } from '../endpoints';
import { branchOf, refreshAfter } from '../refreshAfter';
import { requireToken } from './shared';

/* ---------- Inventory ---------- */

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
