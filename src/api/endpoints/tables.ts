import type { AdminTableDetail, FloorPlanLayout } from '@/types/admin';
import type { SectionWaiter } from '@/types/admin';
import { apiDelete, apiGet, apiPatch, apiPost } from '../client';
import type {
  BranchServiceResponse,
  FloorPlanResponse,
  FreeTableResponse,
  TableDetailResponse,
  TableQrCodesResponse,
  TableQrCodeResponse,
  UpdateFloorsRequest,
} from '../contracts';
import { bearer, seg } from './shared';

/** Why guests change tables (the server's MOVE_REASONS). */
export const MOVE_REASONS = ['guestAsked', 'moreGuests', 'comfort', 'forBooking', 'other'] as const;
export type MoveReason = (typeof MOVE_REASONS)[number];

/** The floor: tables, sections, notes, QR codes, moves. */
export const tablesApi = {
  branchService: (token: string, branchId: string) =>
    apiGet<BranchServiceResponse>(`admin/branches/${seg(branchId)}/service`, bearer(token)),
  floorPlan: (token: string, branchId: string) =>
    apiGet<FloorPlanResponse>(`admin/branches/${seg(branchId)}/tables`, bearer(token)),
  /** Table sections: who can cover tables, with what each covers now. */
  sectionWaiters: (token: string, branchId: string) =>
    apiGet<SectionWaiter[]>(`admin/branches/${seg(branchId)}/tables/waiters`, bearer(token)),
  /** These tables to this waiter, or to nobody (`waiterId` null). */
  assignTables: (
    token: string,
    branchId: string,
    body: { tables: number[]; waiterId: string | null },
  ) =>
    apiPatch<FloorPlanResponse>(
      `admin/branches/${seg(branchId)}/tables/sections`,
      body,
      bearer(token),
    ),
  /** The guests' note at a table for the visit (both empty: cleared). */
  setTableNote: (
    token: string,
    branchId: string,
    table: number,
    body: { text: string; tags: string[] },
  ) =>
    apiPatch<TableDetailResponse>(
      `admin/branches/${seg(branchId)}/tables/${String(table)}/note`,
      body,
      bearer(token),
    ),
  /** Clear all: nobody covers any table. */
  clearSections: (token: string, branchId: string) =>
    apiDelete(`admin/branches/${seg(branchId)}/tables/sections`, bearer(token)),
  floorLayout: (token: string, branchId: string) =>
    apiGet<FloorPlanLayout>(`admin/branches/${seg(branchId)}/floors`, bearer(token)),
  updateFloors: (token: string, branchId: string, body: UpdateFloorsRequest) =>
    apiPatch<FloorPlanLayout>(`admin/branches/${seg(branchId)}/floors`, body, bearer(token)),
  tableDetail: (token: string, branchId: string, table: number) =>
    apiGet<TableDetailResponse>(`admin/branches/${seg(branchId)}/tables/${table}`, bearer(token)),
  tableQrCodes: (token: string, branchId: string) =>
    apiGet<TableQrCodesResponse>(`admin/branches/${seg(branchId)}/tables/qr-codes`, bearer(token)),
  tableQrCode: (token: string, branchId: string, table: number) =>
    apiGet<TableQrCodeResponse>(
      `admin/branches/${seg(branchId)}/tables/${table}/qr`,
      bearer(token),
    ),
  /**
   * POST …/tables/:table/move {to, reason?, note?}: the guests to a free table, and why (the
   * activity log says it); backend only. Answers the new table.
   */
  moveTable: (
    token: string,
    branchId: string,
    table: number,
    to: number,
    why: { reason?: MoveReason; note?: string } = {},
  ) =>
    apiPost<AdminTableDetail>(
      `admin/branches/${seg(branchId)}/tables/${table}/move`,
      { to, ...why },
      bearer(token),
    ),
  freeTable: (token: string, branchId: string, table: number) =>
    apiPost<FreeTableResponse>(
      `admin/branches/${seg(branchId)}/tables/${table}/free`,
      undefined,
      bearer(token),
    ),
};
