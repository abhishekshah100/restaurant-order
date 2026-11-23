'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SetupImportRequest } from '../contracts';
import { api } from '../endpoints';
import { refreshAfter } from '../refreshAfter';

/* ---------- The developer setup page (its key, never a staff token) ---------- */

/** POST /dev/setup/check: what Import would do; nothing is written, nothing refreshed. */
export function useCheckSetup(key: string) {
  return useMutation({ mutationFn: (data: unknown) => api.checkSetup(key, data) });
}

/** POST /dev/setup/import: the restaurant made in one go; the list and the branches read again. */
export function useImportSetup(key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: SetupImportRequest) => api.importSetup(key, body),
    onSettled: () => refreshAfter(client, 'devSetupChanged'),
  });
}

/** POST /dev/setup/restaurants/:id/reset: a rehearsal undone. */
export function useResetSetupRestaurant(key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (restaurantId: string) => api.resetSetupRestaurant(key, restaurantId),
    onSettled: () => refreshAfter(client, 'devSetupChanged'),
  });
}

/** DELETE /dev/setup/restaurants/:id: the restaurant and everything it has. */
export function useDeleteSetupRestaurant(key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (restaurantId: string) => api.deleteSetupRestaurant(key, restaurantId),
    onSettled: () => refreshAfter(client, 'devSetupChanged'),
  });
}
