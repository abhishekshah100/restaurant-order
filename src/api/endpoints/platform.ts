import { apiGet, apiPatch, apiPost, backendBlob } from '../client';
import type {
  AddonInfo,
  AddonRequest,
  ClientDetail,
  FeatureGroup,
  FeatureInfo,
  NewClientRequest,
  NewClientResult,
  PaymentsOverview,
  RecordPaymentRequest,
  ClientSummary,
  PackagePlan,
  PlatformSettings,
  UpdateClientRequest,
  UpdatePackageRequest,
  UpdatePlatformSettingsRequest,
} from '../contracts';
import { seg } from './shared';

/** Platform console requests carry the platform owner's one key (DEV_SETUP_KEY), never a staff token. */
const platformKey = (key: string): RequestInit => ({ headers: { 'X-Dev-Key': key } });

/** The platform console (backend only). */
export const platformApi = {
  /** GET /platform/plans */
  platformPackages: (key: string) => apiGet<PackagePlan[]>('platform/plans', platformKey(key)),
  /** PATCH /platform/plans/:code */
  updatePlatformPackage: (key: string, code: string, body: UpdatePackageRequest) =>
    apiPatch<PackagePlan>(`platform/plans/${seg(code)}`, body, platformKey(key)),
  /** GET /platform/clients */
  platformClients: (key: string) => apiGet<ClientSummary[]>('platform/clients', platformKey(key)),
  /** POST /platform/clients: a new, live client. */
  createPlatformClient: (key: string, body: NewClientRequest) =>
    apiPost<NewClientResult>('platform/clients', body, platformKey(key)),
  /** POST /platform/clients/:id/go-live: a Dev setup demo made a real client. */
  goLivePlatformClient: (key: string, id: string, by: string) =>
    apiPost<ClientDetail>(`platform/clients/${seg(id)}/go-live`, { by }, platformKey(key)),
  /** GET /platform/clients/:id */
  platformClient: (key: string, id: string) =>
    apiGet<ClientDetail>(`platform/clients/${seg(id)}`, platformKey(key)),
  /** PATCH /platform/clients/:id */
  updatePlatformClient: (key: string, id: string, body: UpdateClientRequest) =>
    apiPatch<ClientDetail>(`platform/clients/${seg(id)}`, body, platformKey(key)),
  /** POST /platform/clients/:id/suspend */
  suspendPlatformClient: (key: string, id: string, body: { by: string; reason: string }) =>
    apiPost<ClientDetail>(`platform/clients/${seg(id)}/suspend`, body, platformKey(key)),
  /** POST /platform/clients/:id/resume */
  resumePlatformClient: (key: string, id: string, body: { by: string }) =>
    apiPost<ClientDetail>(`platform/clients/${seg(id)}/resume`, body, platformKey(key)),
  /** POST /platform/clients/:id/payments: a payment (and its receipt) recorded. */
  recordPlatformPayment: (key: string, id: string, body: RecordPaymentRequest) =>
    apiPost<ClientDetail>(`platform/clients/${seg(id)}/payments`, body, platformKey(key)),
  /** POST /platform/clients/:id/payments/:paymentId/remove */
  removePlatformPayment: (
    key: string,
    id: string,
    paymentId: string,
    body: { by: string; reason: string },
  ) =>
    apiPost<ClientDetail>(
      `platform/clients/${seg(id)}/payments/${seg(paymentId)}/remove`,
      body,
      platformKey(key),
    ),
  /** GET /platform/clients/:id/payments/:paymentId/receipt: the photo, as a blob. */
  platformReceipt: (key: string, id: string, paymentId: string) =>
    backendBlob(`platform/clients/${seg(id)}/payments/${seg(paymentId)}/receipt`, platformKey(key)),
  /** POST /platform/clients/:id/reminded: a renewal reminder sent. */
  platformReminded: (key: string, id: string, body: { by: string; daysLeft: number | null }) =>
    apiPost<ClientDetail>(`platform/clients/${seg(id)}/reminded`, body, platformKey(key)),
  /** GET /platform/payments */
  platformPayments: (key: string) =>
    apiGet<PaymentsOverview>('platform/payments', platformKey(key)),
  /** GET /platform/features: the feature catalog. */
  platformFeatures: (key: string) => apiGet<FeatureInfo[]>('platform/features', platformKey(key)),
  createPlatformFeature: (
    key: string,
    body: { by: string; name: string; description: string; group: FeatureGroup },
  ) => apiPost<FeatureInfo>('platform/features', body, platformKey(key)),
  updatePlatformFeature: (
    key: string,
    feature: string,
    body: { by: string; name?: string; description?: string; group?: FeatureGroup },
  ) => apiPatch<FeatureInfo>(`platform/features/${seg(feature)}`, body, platformKey(key)),
  removePlatformFeature: (key: string, feature: string, by: string) =>
    apiPost<void>(`platform/features/${seg(feature)}/remove`, { by }, platformKey(key)),
  orderPlatformFeatures: (key: string, body: { by: string; keys: string[] }) =>
    apiPost<FeatureInfo[]>('platform/features/order', body, platformKey(key)),
  /** POST /platform/plans: a new package, copied from another. */
  createPlatformPackage: (key: string, body: { by: string; name: string; copyFrom: string }) =>
    apiPost<PackagePlan>('platform/plans', body, platformKey(key)),
  orderPlatformPackages: (key: string, body: { by: string; keys: string[] }) =>
    apiPost<PackagePlan[]>('platform/plans/order', body, platformKey(key)),
  removePlatformPackage: (key: string, code: string, by: string) =>
    apiPost<void>(`platform/plans/${seg(code)}/remove`, { by }, platformKey(key)),
  /** GET /platform/addons: the add-on catalog. */
  platformAddons: (key: string) => apiGet<AddonInfo[]>('platform/addons', platformKey(key)),
  createPlatformAddon: (key: string, body: AddonRequest) =>
    apiPost<AddonInfo>('platform/addons', body, platformKey(key)),
  updatePlatformAddon: (key: string, code: string, body: AddonRequest) =>
    apiPatch<AddonInfo>(`platform/addons/${seg(code)}`, body, platformKey(key)),
  orderPlatformAddons: (key: string, body: { by: string; keys: string[] }) =>
    apiPost<AddonInfo[]>('platform/addons/order', body, platformKey(key)),
  /** POST /platform/clients/:id/addons, …/addons/:addonId/remove */
  addClientAddon: (
    key: string,
    id: string,
    body: { by: string; addon: string; quantity: number },
  ) => apiPost<ClientDetail>(`platform/clients/${seg(id)}/addons`, body, platformKey(key)),
  removeClientAddon: (key: string, id: string, addonId: string, by: string) =>
    apiPost<ClientDetail>(
      `platform/clients/${seg(id)}/addons/${seg(addonId)}/remove`,
      { by },
      platformKey(key),
    ),
  /** GET /platform/settings */
  platformSettings: (key: string) =>
    apiGet<PlatformSettings>('platform/settings', platformKey(key)),
  /** PATCH /platform/settings */
  updatePlatformSettings: (key: string, body: UpdatePlatformSettingsRequest) =>
    apiPatch<PlatformSettings>('platform/settings', body, platformKey(key)),
};
