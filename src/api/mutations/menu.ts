'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminToken } from '@/hooks/useAdminSession';
import { withAvailability } from '@/lib/adminMenu';
import type { MenuData } from '@/types/menu';
import type {
  DishInput,
  ImageUploadRequest,
  UpdateSearchSuggestionsRequest,
  UpdateCartSuggestionsRequest,
  SetAvailabilityRequest,
  UpdateCategoriesRequest,
} from '../contracts';
import { api } from '../endpoints';
import { branchOf, refreshAfter } from '../refreshAfter';
import {
  branchMenuQuery,
  adminSearchSuggestionsQuery,
  adminCartSuggestionsQuery,
} from '../queries';
import { requireToken } from './shared';

/* ---------- Menu ---------- */

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
