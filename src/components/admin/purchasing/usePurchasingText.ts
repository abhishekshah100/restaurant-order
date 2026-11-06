'use client';

import { useMemo } from 'react';
import { useContent } from '@/api/hooks';
import { formatQuantity } from '@/lib/inventory';
import type { PackView } from '@/types/purchasing';
import { useInventoryText } from '../inventory/useInventoryText';
import { useAdminWorkspace } from '../shell/AdminWorkspace';

/** "PO-0007", "GRN-0012", "RTN-0003": a branch's numbers as staff say them. */
export const docNumber = (prefix: 'PO' | 'GRN' | 'RTN', n: number) =>
  `${prefix}-${String(n).padStart(4, '0')}`;

/** How purchasing reads: packs ("3 × block (1 kg)"), prices with decimals, numbers. */
export function usePurchasingText() {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const text = useInventoryText();
  return useMemo(() => {
    const isUnit = (pack: PackView) => pack.name === pack.unit && pack.size === 1;
    /** "block (1 kg)", or just "kg" for a pack that is one unit. */
    const pack = (p: PackView) =>
      isUnit(p)
        ? text.unit(p.unit)
        : t('adminPurchasing.pack', { name: p.name, size: text.quantity(p.size, p.unit) });
    return {
      ...text,
      pack,
      /** "3 × block (1 kg)" or "2.5 kg". */
      packs: (n: number, p: PackView) =>
        isUnit(p) ? text.quantity(n, p.unit) : `${formatQuantity(n, branch.locale)} × ${pack(p)}`,
      /** "₹420.00 / block". */
      perPack: (price: number, p: PackView) =>
        t('adminInventory.perUnit', {
          amount: text.money(price),
          unit: isUnit(p) ? text.unit(p.unit) : p.name,
        }),
    };
  }, [t, text, branch.locale]);
}
