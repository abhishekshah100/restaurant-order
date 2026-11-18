import type { AdminBranch } from '@/types/admin';
import type { FeaturesResponse } from '@/types/admin';
import type { AutoOffer } from '@/types/promotion';
import { apiDelete, apiGet, apiPatch, apiPost } from '../client';
import type {
  AdminBranchesResponse,
  BranchSettingsResponse,
  CreateBranchRequest,
  OfferRequest,
  SetBranchStatusRequest,
  UpdateBranchSettingsRequest,
} from '../contracts';
import { bearer, seg } from './shared';

/** Branches, their status and settings, modules and offers. */
export const branchesApi = {
  adminBranches: (token: string) => apiGet<AdminBranchesResponse>('admin/branches', bearer(token)),
  setBranchStatus: (token: string, branchId: string, body: SetBranchStatusRequest) =>
    apiPatch<AdminBranch>(`admin/branches/${seg(branchId)}/status`, body, bearer(token)),
  createBranch: (token: string, body: CreateBranchRequest) =>
    apiPost<AdminBranch>('admin/branches', body, bearer(token)),
  removeBranch: (token: string, branchId: string) =>
    apiDelete(`admin/branches/${seg(branchId)}`, bearer(token)),
  branchSettings: (token: string, branchId: string) =>
    apiGet<BranchSettingsResponse>(`admin/branches/${seg(branchId)}/settings`, bearer(token)),
  updateBranchSettings: (token: string, branchId: string, body: UpdateBranchSettingsRequest) =>
    apiPatch<BranchSettingsResponse>(
      `admin/branches/${seg(branchId)}/settings`,
      body,
      bearer(token),
    ),
  features: (token: string, branchId: string) =>
    apiGet<FeaturesResponse>(`admin/branches/${seg(branchId)}/features`, bearer(token)),
  setFeatures: (token: string, branchId: string, body: { inventory: boolean }) =>
    apiPatch<FeaturesResponse>(`admin/branches/${seg(branchId)}/features`, body, bearer(token)),
  offers: (token: string, branchId: string) =>
    apiGet<AutoOffer[]>(`admin/branches/${seg(branchId)}/offers`, bearer(token)),
  createOffer: (token: string, branchId: string, body: OfferRequest) =>
    apiPost<AutoOffer>(`admin/branches/${seg(branchId)}/offers`, body, bearer(token)),
  updateOffer: (token: string, branchId: string, id: string, body: OfferRequest) =>
    apiPatch<AutoOffer>(`admin/branches/${seg(branchId)}/offers/${seg(id)}`, body, bearer(token)),
  removeOffer: (token: string, branchId: string, id: string) =>
    apiDelete(`admin/branches/${seg(branchId)}/offers/${seg(id)}`, bearer(token)),
};
