'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AddonRequest,
  FeatureGroup,
  NewClientRequest,
  RecordPaymentRequest,
  SuspendRequest,
  UpdateClientRequest,
  UpdateFeatureRequest,
  UpdatePackageRequest,
  UpdatePlatformSettingsRequest,
} from '../contracts';
import { api } from '../endpoints';
import { refreshAfter } from '../refreshAfter';

/* ---------- The platform console (its key, never a staff token) ---------- */

/** PATCH /platform/clients/:id: anything about a client's package. */
export function useUpdatePlatformClient(key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateClientRequest }) =>
      api.updatePlatformClient(key, id, body),
    onSettled: () => refreshAfter(client, 'platformChanged'),
  });
}

/** POST /platform/clients/:id/suspend: now, at closing time or planned. */
export function useSuspendPlatformClient(key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SuspendRequest }) =>
      api.suspendPlatformClient(key, id, body),
    onSettled: () => refreshAfter(client, 'platformChanged'),
  });
}

/** POST /platform/clients/:id/plan-change/cancel: a planned downgrade called off. */
export function useCancelPlanChange(key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, by }: { id: string; by: string }) => api.cancelPlanChange(key, id, { by }),
    onSettled: () => refreshAfter(client, 'platformChanged'),
  });
}

/** POST /platform/clients/:id/resume: back on, or a planned suspension called off. */
export function useResumePlatformClient(key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, by }: { id: string; by: string }) =>
      api.resumePlatformClient(key, id, { by }),
    onSettled: () => refreshAfter(client, 'platformChanged'),
  });
}

/** PATCH /platform/plans/:code: a package's defaults. */
export function useUpdatePlatformPackage(key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ code, body }: { code: string; body: UpdatePackageRequest }) =>
      api.updatePlatformPackage(key, code, body),
    onSettled: () => refreshAfter(client, 'platformChanged'),
  });
}

/** PATCH /platform/settings */
export function useUpdatePlatformSettings(key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdatePlatformSettingsRequest) => api.updatePlatformSettings(key, body),
    onSettled: () => refreshAfter(client, 'platformChanged'),
  });
}

/** POST /platform/clients/:id/payments: a payment recorded (the term extended, if asked). */
export function useRecordPlatformPayment(key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RecordPaymentRequest }) =>
      api.recordPlatformPayment(key, id, body),
    onSettled: () => refreshAfter(client, 'platformChanged'),
  });
}

/** POST /platform/clients/:id/payments/:paymentId/remove */
export function useRemovePlatformPayment(key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      paymentId,
      body,
    }: {
      id: string;
      paymentId: string;
      body: { by: string; reason: string };
    }) => api.removePlatformPayment(key, id, paymentId, body),
    onSettled: () => refreshAfter(client, 'platformChanged'),
  });
}

/** POST /platform/clients/:id/reminded: a renewal reminder sent (on WhatsApp, by hand). */
export function usePlatformReminded(key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, by, daysLeft }: { id: string; by: string; daysLeft: number | null }) =>
      api.platformReminded(key, id, { by, daysLeft }),
    onSettled: () => refreshAfter(client, 'platformChanged'),
  });
}

/** POST /platform/clients: a new, live client (its owner's password comes back once). */
export function useCreatePlatformClient(key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: NewClientRequest) => api.createPlatformClient(key, body),
    onSettled: () => refreshAfter(client, 'devSetupChanged'),
  });
}

/** POST /platform/clients/:id/go-live: Dev setup can no longer reset or delete it. */
export function useGoLive(key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, by }: { id: string; by: string }) => api.goLivePlatformClient(key, id, by),
    onSettled: () => refreshAfter(client, 'devSetupChanged'),
  });
}

/** The platform's catalog (features, packages, add-ons) changed: every console read again. */
function useCatalogMutation<V, R>(key: string, run: (v: V) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => refreshAfter(client, 'platformChanged'),
  });
}

export const useCreatePlatformFeature = (key: string) =>
  useCatalogMutation(
    key,
    (body: { by: string; name: string; description: string; group: FeatureGroup }) =>
      api.createPlatformFeature(key, body),
  );
export const useUpdatePlatformFeature = (key: string) =>
  useCatalogMutation(key, ({ feature, body }: { feature: string; body: UpdateFeatureRequest }) =>
    api.updatePlatformFeature(key, feature, body),
  );
export const useRemovePlatformFeature = (key: string) =>
  useCatalogMutation(key, ({ feature, by }: { feature: string; by: string }) =>
    api.removePlatformFeature(key, feature, by),
  );
export const useOrderPlatformFeatures = (key: string) =>
  useCatalogMutation(key, (body: { by: string; keys: string[] }) =>
    api.orderPlatformFeatures(key, body),
  );
export const useCreatePlatformPackage = (key: string) =>
  useCatalogMutation(key, (body: { by: string; name: string; copyFrom: string }) =>
    api.createPlatformPackage(key, body),
  );
export const useOrderPlatformPackages = (key: string) =>
  useCatalogMutation(key, (body: { by: string; keys: string[] }) =>
    api.orderPlatformPackages(key, body),
  );
export const useRemovePlatformPackage = (key: string) =>
  useCatalogMutation(key, ({ code, by }: { code: string; by: string }) =>
    api.removePlatformPackage(key, code, by),
  );
export const useCreatePlatformAddon = (key: string) =>
  useCatalogMutation(key, (body: AddonRequest) => api.createPlatformAddon(key, body));
export const useUpdatePlatformAddon = (key: string) =>
  useCatalogMutation(key, ({ code, body }: { code: string; body: AddonRequest }) =>
    api.updatePlatformAddon(key, code, body),
  );
export const useOrderPlatformAddons = (key: string) =>
  useCatalogMutation(key, (body: { by: string; keys: string[] }) =>
    api.orderPlatformAddons(key, body),
  );
export const useAddClientAddon = (key: string) =>
  useCatalogMutation(
    key,
    ({ id, body }: { id: string; body: { by: string; addon: string; quantity: number } }) =>
      api.addClientAddon(key, id, body),
  );
export const useRemoveClientAddon = (key: string) =>
  useCatalogMutation(key, ({ id, addonId, by }: { id: string; addonId: string; by: string }) =>
    api.removeClientAddon(key, id, addonId, by),
  );
