import type {
  MyRotaResponse,
  RotaRequestsResponse,
  RotaShift,
  RotaWeekResponse,
  SwapView,
  TimeOffView,
  SaveRotaShiftRequest,
  ShiftListResponse,
  FixShiftRequest,
  AddShiftRequest,
  ShiftType,
  ShiftTypeRequest,
  StaffShift,
} from '@/types/admin';
import { apiDelete, apiGet, apiPatch, apiPost } from '../client';
import { bearer, seg } from './shared';

/** Shifts, attendance and the rota. */
export const shiftsApi = {
  /** My open shift at the branch, or null. */
  currentShift: (token: string, branchId: string) =>
    apiGet<StaffShift | null>(`admin/branches/${seg(branchId)}/shifts/current`, bearer(token)),
  /** Start shift (an open one already: that one). */
  startShift: (token: string, branchId: string) =>
    apiPost<StaffShift>(`admin/branches/${seg(branchId)}/shifts/start`, {}, bearer(token)),
  /** Clock out: my tables are released. */
  endShift: (token: string, branchId: string) =>
    apiPost<StaffShift>(`admin/branches/${seg(branchId)}/shifts/end`, {}, bearer(token)),
  /** Team › Shifts: the shifts started on those days, with what each person did. */
  shifts: (token: string, branchId: string, range: { from: string; to: string }) =>
    apiGet<ShiftListResponse>(
      `admin/branches/${seg(branchId)}/shifts?from=${range.from}&to=${range.to}`,
      bearer(token),
    ),
  /** Attendance: a shift's times fixed by hand. */
  fixShift: (token: string, branchId: string, id: string, body: FixShiftRequest) =>
    apiPatch<StaffShift>(`admin/branches/${seg(branchId)}/shifts/${seg(id)}`, body, bearer(token)),
  /** Attendance: a shift someone forgot, added by hand. */
  addShift: (token: string, branchId: string, body: AddShiftRequest) =>
    apiPost<StaffShift>(`admin/branches/${seg(branchId)}/shifts`, body, bearer(token)),
  /** Rota: a week (the one holding `week`), to plan. */
  rotaWeek: (token: string, branchId: string, week: string) =>
    apiGet<RotaWeekResponse>(`admin/branches/${seg(branchId)}/rota?week=${week}`, bearer(token)),
  /** Rota: my published shifts, yesterday to 6 days on. */
  myRota: (token: string, branchId: string) =>
    apiGet<MyRotaResponse>(`admin/branches/${seg(branchId)}/rota/mine`, bearer(token)),
  addShiftType: (token: string, branchId: string, body: ShiftTypeRequest) =>
    apiPost<ShiftType>(`admin/branches/${seg(branchId)}/rota/types`, body, bearer(token)),
  updateShiftType: (token: string, branchId: string, id: string, body: Partial<ShiftTypeRequest>) =>
    apiPatch<ShiftType>(
      `admin/branches/${seg(branchId)}/rota/types/${seg(id)}`,
      body,
      bearer(token),
    ),
  /** Archived (shifts planned with it keep their hours). */
  archiveShiftType: (token: string, branchId: string, id: string) =>
    apiDelete(`admin/branches/${seg(branchId)}/rota/types/${seg(id)}`, bearer(token)),
  saveRotaShift: (token: string, branchId: string, body: SaveRotaShiftRequest) =>
    apiPost<RotaShift>(`admin/branches/${seg(branchId)}/rota/shifts`, body, bearer(token)),
  removeRotaShift: (token: string, branchId: string, id: string) =>
    apiDelete(`admin/branches/${seg(branchId)}/rota/shifts/${seg(id)}`, bearer(token)),
  /** Copy last week (into empty days), clear the week, or publish it. */
  rotaWeekAction: (
    token: string,
    branchId: string,
    action: 'copy' | 'clear' | 'publish',
    week: string,
  ) =>
    apiPost<RotaWeekResponse>(
      `admin/branches/${seg(branchId)}/rota/${action}`,
      { week },
      bearer(token),
    ),
  /** Rota settings: the weekly hours warning (null: none). */
  rotaSettings: (token: string, branchId: string, weekHoursLimit: number | null) =>
    apiPatch<RotaWeekResponse>(
      `admin/branches/${seg(branchId)}/rota/settings`,
      { weekHoursLimit },
      bearer(token),
    ),
  rotaRequests: (token: string, branchId: string) =>
    apiGet<RotaRequestsResponse>(`admin/branches/${seg(branchId)}/rota/requests`, bearer(token)),
  rotaColleagues: (token: string, branchId: string) =>
    apiGet<{ id: string; name: string; role: string }[]>(
      `admin/branches/${seg(branchId)}/rota/colleagues`,
      bearer(token),
    ),
  askTimeOff: (
    token: string,
    branchId: string,
    body: { from: string; to: string; reason: string },
  ) => apiPost<TimeOffView>(`admin/branches/${seg(branchId)}/rota/time-off`, body, bearer(token)),
  /** cancel (one's own) or decide (a planner: {approve, note}). */
  timeOffAction: (
    token: string,
    branchId: string,
    id: string,
    action: 'cancel' | 'decide',
    body: object = {},
  ) =>
    apiPost<TimeOffView>(
      `admin/branches/${seg(branchId)}/rota/time-off/${seg(id)}/${action}`,
      body,
      bearer(token),
    ),
  askSwap: (
    token: string,
    branchId: string,
    body: { shiftId: string; toStaffId: string; note?: string },
  ) => apiPost<SwapView>(`admin/branches/${seg(branchId)}/rota/swaps`, body, bearer(token)),
  /** respond (the colleague: {accept}), cancel (the asker) or decide (a planner: {approve, note}). */
  swapAction: (
    token: string,
    branchId: string,
    id: string,
    action: 'respond' | 'cancel' | 'decide',
    body: object = {},
  ) =>
    apiPost<SwapView>(
      `admin/branches/${seg(branchId)}/rota/swaps/${seg(id)}/${action}`,
      body,
      bearer(token),
    ),
};
