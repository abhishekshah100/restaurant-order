'use client';

import { useMemo } from 'react';
import { useInventoryStock, useInventoryUsage } from '@/api/hooks';
import { useNow } from '@/hooks/useNow';
import { shiftDay } from '@/lib/dayRange';
import { daysLeftById, RATE_DAYS } from '@/lib/inventoryPlanning';
import { useAdminWorkspace } from '../shell/AdminWorkspace';

/**
 * Each item's days left at the rate it was used over the last two weeks, and how much it uses a
 * day (from the usage report; staff who can see stock only). Empty until both are read.
 */
export function useDaysLeft() {
  const { branch, clock, can } = useAdminWorkspace();
  const viewer = can('inventory.view');
  const now = useNow();
  const today = now ? clock.dayKey(now) : null;
  const stock = useInventoryStock(branch.id, viewer).data;
  const usage = useInventoryUsage(
    branch.id,
    today ? { from: shiftDay(today, -(RATE_DAYS - 1)), to: today } : {},
    viewer && today !== null,
  ).data;
  return useMemo(() => {
    const rows = usage?.rows ?? [];
    const perDay = new Map(rows.map((r) => [r.ingredientId, r.quantity.actual / RATE_DAYS]));
    return {
      left: stock && usage ? daysLeftById(stock.items, rows) : new Map<string, number>(),
      perDay,
    };
  }, [stock, usage]);
}
