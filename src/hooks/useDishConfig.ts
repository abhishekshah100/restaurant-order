'use client';

import { useMemo, useState } from 'react';
import type { LineConfig } from '@/types/cart';
import type { Dish } from '@/types/menu';
import { defaultConfig, isValidConfig, unitPrice } from '@/lib/cartLine';
import { MAX_QUANTITY } from '@/lib/constants';

export interface DishConfigState {
  config: LineConfig;
  quantity: number;
  unitPrice: number;
  /** unitPrice × quantity — the live price on the Add button. */
  total: number;
  valid: boolean;
  setVariant: (id: string) => void;
  setAddOns: (ids: string[]) => void;
  setOption: (groupId: string, choice: string) => void;
  toggleInstruction: (text: string) => void;
  setNote: (note: string) => void;
  setQuantity: (n: number) => void;
}

/** Local state for the food-detail page and quick-add dialog. */
export function useDishConfig(
  dish: Dish,
  initial?: { config: LineConfig; quantity: number },
): DishConfigState {
  const [config, setConfig] = useState<LineConfig>(() => initial?.config ?? defaultConfig(dish));
  const [quantity, setQty] = useState(initial?.quantity ?? 1);

  return useMemo(() => {
    const unit = unitPrice(dish, config);
    return {
      config,
      quantity,
      unitPrice: unit,
      total: unit * quantity,
      valid: isValidConfig(dish, config),
      setVariant: (variantId) => setConfig((c) => ({ ...c, variantId })),
      setAddOns: (ids) =>
        setConfig((c) => ({
          ...c,
          addOnIds: dish.maxAddOns === undefined ? ids : ids.slice(0, dish.maxAddOns),
        })),
      setOption: (groupId, choice) =>
        setConfig((c) => ({ ...c, options: { ...c.options, [groupId]: choice } })),
      toggleInstruction: (text) =>
        setConfig((c) => ({
          ...c,
          instructions: c.instructions.includes(text)
            ? c.instructions.filter((t) => t !== text)
            : [...c.instructions, text],
        })),
      setNote: (note) => setConfig((c) => ({ ...c, note: note.slice(0, 140) })),
      setQuantity: (n) => setQty(Math.max(1, Math.min(MAX_QUANTITY, n))),
    };
  }, [dish, config, quantity]);
}
