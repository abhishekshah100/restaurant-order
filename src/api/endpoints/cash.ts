import { apiGet, apiPatch, apiPost } from '../client';
import type {
  CashDaySummary,
  CashMovementRequest,
  CashRegisterResponse,
  CashReport,
  CashSession,
  CloseRegisterRequest,
  OpenRegisterRequest,
} from '../contracts';
import { bearer, searchOf, seg } from './shared';

/** The cash register. */
export const cashApi = {
  cashRegister: (token: string, branchId: string) =>
    apiGet<CashRegisterResponse>(`admin/branches/${seg(branchId)}/cash-register`, bearer(token)),
  cashSession: (token: string, branchId: string, id: string) =>
    apiGet<CashSession>(
      `admin/branches/${seg(branchId)}/cash-register/sessions/${seg(id)}`,
      bearer(token),
    ),
  openRegister: (token: string, branchId: string, body: OpenRegisterRequest) =>
    apiPost<CashSession>(`admin/branches/${seg(branchId)}/cash-register/open`, body, bearer(token)),
  moveCash: (token: string, branchId: string, body: CashMovementRequest) =>
    apiPost<CashSession>(
      `admin/branches/${seg(branchId)}/cash-register/movements`,
      body,
      bearer(token),
    ),
  closeRegister: (token: string, branchId: string, body: CloseRegisterRequest) =>
    apiPost<CashSession>(
      `admin/branches/${seg(branchId)}/cash-register/close`,
      body,
      bearer(token),
    ),
  cashDay: (token: string, branchId: string, day: string) =>
    apiGet<CashDaySummary>(
      `admin/branches/${seg(branchId)}/cash-register/days/${seg(day)}`,
      bearer(token),
    ),
  signOffCashDay: (token: string, branchId: string, day: string, note?: string) =>
    apiPost<CashDaySummary>(
      `admin/branches/${seg(branchId)}/cash-register/days/${seg(day)}/sign-off`,
      note ? { note } : {},
      bearer(token),
    ),
  /** A drawer that needed a check, checked by a manager (what they found, optional). */
  checkCashSession: (token: string, branchId: string, id: string, note?: string) =>
    apiPost<CashSession>(
      `admin/branches/${seg(branchId)}/cash-register/sessions/${seg(id)}/check`,
      note ? { note } : {},
      bearer(token),
    ),
  cashReport: (token: string, branchId: string, range: { from: string; to: string }) =>
    apiGet<CashReport>(
      `admin/branches/${seg(branchId)}/cash-register/report${searchOf(range)}`,
      bearer(token),
    ),
  setCashLimit: (token: string, branchId: string, differenceLimit: number) =>
    apiPatch<{ differenceLimit: number }>(
      `admin/branches/${seg(branchId)}/cash-register/limit`,
      { differenceLimit },
      bearer(token),
    ),
};
