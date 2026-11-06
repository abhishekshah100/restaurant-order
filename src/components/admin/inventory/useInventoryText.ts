'use client';

import { useMemo } from 'react';
import { useContent } from '@/api/hooks';
import { formatQuantity } from '@/lib/inventory';
import type { InventoryUnit } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';

/** How inventory numbers read at the branch: "2.5 kg", "₹40.00 / kg", "−₹12". */
export function useInventoryText() {
  const t = useContent('common');
  const { branch, money } = useAdminWorkspace();
  return useMemo(() => {
    const unit = (code: InventoryUnit) => t(`adminInventory.units.${code}`);
    return {
      unit,
      /** "2.5 kg" */
      quantity: (n: number, code: InventoryUnit) =>
        `${formatQuantity(n, branch.locale)} ${unit(code)}`,
      /** "+2.5 kg" / "−0.5 kg": a change. */
      change: (n: number, code: InventoryUnit) =>
        `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatQuantity(Math.abs(n), branch.locale)} ${unit(code)}`,
      /** "₹40.00 / kg": a cost per unit, with its decimals. */
      cost: (amount: number, code: InventoryUnit) =>
        t('adminInventory.perUnit', {
          amount: money.formatMinor(Math.round(amount * money.minorUnit)),
          unit: unit(code),
        }),
      /** "₹60.50": an amount with its decimals (a portion's cost). */
      money: (amount: number) => money.formatMinor(Math.round(amount * money.minorUnit)),
      /** "₹1,240": a value. */
      value: (amount: number) => money.format(Math.round(amount)),
      /** "−₹1,240" / "+₹80": a signed value, whole. */
      signedWhole: (amount: number) =>
        `${amount > 0 ? '+' : ''}${money.format(Math.round(amount))}`,
      /** "−₹12": a signed value. */
      signedValue: (amount: number) =>
        money.formatSignedMinor(Math.round(amount * money.minorUnit)),
    };
  }, [t, branch.locale, money]);
}
