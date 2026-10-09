import { useTableContext } from '@/context/GuestSessionContext';

export { useTableContext as useTable };

/** Shown in place of the table number until the session is read ("Table —"). */
export const UNKNOWN_TABLE = '—';

/** The table number for display: a placeholder until the session is read, never a wrong table. */
export type TableLabel = number | typeof UNKNOWN_TABLE;

export function useTableLabel(): TableLabel {
  return useTableContext() ?? UNKNOWN_TABLE;
}
