'use client';

import { useCallback } from 'react';
import { useContent } from '@/api/hooks';
import { useVisit } from '@/context/GuestSessionContext';
import type { OrderMode } from '@/types/branch';

interface VisitLike {
  mode: OrderMode;
  table?: number | null;
}

/**
 * How an order or a visit is described in a line of copy: "Table 12" when dine-in (as it always
 * was), else the mode: "Takeaway", "Delivery".
 */
export function useVisitWords(): (visit: VisitLike) => string {
  const t = useContent('common');
  return useCallback(
    ({ mode, table }: VisitLike) =>
      mode === 'dineIn' && table != null ? t('visit.table', { table }) : t(`modes.${mode}`),
    [t],
  );
}

/** The guest's current visit in words: "Table 12", "Takeaway" or "Delivery". */
export function useVisitLabel(): string {
  const visit = useVisit();
  return useVisitWords()(visit);
}
