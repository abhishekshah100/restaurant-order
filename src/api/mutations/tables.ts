'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminToken } from '@/hooks/useAdminSession';
import type { UpdateFloorsRequest } from '../contracts';
import { api } from '../endpoints';
import { branchOf, refreshAfter } from '../refreshAfter';
import { floorLayoutQuery } from '../queries';
import { requireToken } from './shared';

/* ---------- Tables ---------- */

/**
 * PATCH /admin/branches/:branchId/floors: saves the floor plan. Everything that reads it is read
 * again: the staff pages (floor plan, tables, QR codes, reservations) and the branches (the
 * tables guests can scan).
 */
export function useUpdateFloors() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: UpdateFloorsRequest }) =>
      api.updateFloors(requireToken(token), branchId, body),
    onSuccess: (layout, { branchId }) =>
      client.setQueryData(floorLayoutQuery(token, branchId).queryKey, layout),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'floorPlanChanged', branchOf(variables)),
  });
}

/** POST /admin/branches/:branchId/tables/:table/free: the guests left, the table is free. */
/**
 * POST …/tables/:table/move: the guests, with their orders, calls, phones and note, to a free
 * table. The floor and the guests' orders are read again.
 */
export function useMoveTable() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, table, to }: { branchId: string; table: number; to: number }) =>
      api.moveTable(requireToken(token), branchId, table, to),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'tableChanged', branchOf(variables)),
  });
}

export function useFreeTable() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId, table }: { branchId: string; table: number }) =>
      api.freeTable(requireToken(token), branchId, table),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'tableChanged', branchOf(variables)),
  });
}

/**
 * PATCH …/tables/sections: tables given to a waiter (or released); DELETE: clear all. The floor
 * (and who covers what) is read again.
 */
export function useAssignTables() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      tables,
      waiterId,
    }: {
      branchId: string;
      tables: number[];
      /** A waiter's id, "me" (the signed-in staff member) or null (nobody). */
      waiterId: string | null;
    }) => api.assignTables(requireToken(token), branchId, { tables, waiterId }),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'tableChanged', branchOf(variables)),
  });
}

/** PATCH …/tables/:table/note: the guests' note for the visit; the floor and orders read again. */
export function useSetTableNote() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({
      branchId,
      table,
      text,
      tags,
    }: {
      branchId: string;
      table: number;
      text: string;
      tags: string[];
    }) => api.setTableNote(requireToken(token), branchId, table, { text, tags }),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'tableChanged', branchOf(variables)),
  });
}

export function useClearSections() {
  const client = useQueryClient();
  const token = useAdminToken();
  return useMutation({
    mutationFn: ({ branchId }: { branchId: string }) =>
      api.clearSections(requireToken(token), branchId),
    onSettled: (_data, _error, variables) =>
      refreshAfter(client, 'tableChanged', branchOf(variables)),
  });
}
