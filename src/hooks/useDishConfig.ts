'use client';

import { useMemo, useState } from 'react';
import type { LineConfig } from '@/types/cart';
import type { Dish } from '@/types/menu';
import { defaultConfig, isValidConfig, unitPrice } from '@/lib/cartLine';
import { normaliseConfig } from '@/lib/options';
import { ITEM_NOTE_MAX, MAX_QUANTITY } from '@/lib/constants';

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
  /** Leave an ingredient out / put it back ("No onion"). */
  toggleRemoval: (id: string) => void;
  setNote: (note: string) => void;
  setQuantity: (n: number) => void;
}

/** Local state for the food-detail page and quick-add dialog. */
export function useDishConfig(
  dish: Dish,
  initial?: { config: LineConfig; quantity: number },
): DishConfigState {
  const [config, setConfig] = useState<LineConfig>(() =>
    initial ? normaliseConfig(dish, initial.config) : defaultConfig(dish),
  );
  const [quantity, setQty] = useState(initial?.quantity ?? 1);

  return useMemo(() => {
    const unit = unitPrice(dish, config);
    return {
      config,
      quantity,
      unitPrice: unit,
      total: unit * quantity,
      valid: isValidConfig(dish, config),
      // Changing size re-checks which add-ons and choices that size offers.
      setVariant: (variantId) => setConfig((c) => normaliseConfig(dish, { ...c, variantId })),
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
      toggleRemoval: (id) =>
        setConfig((c) => ({
          ...c,
          removals: c.removals.includes(id)
            ? c.removals.filter((r) => r !== id)
            : [...c.removals, id],
        })),
      setNote: (note) => setConfig((c) => ({ ...c, note: note.slice(0, ITEM_NOTE_MAX) })),
      setQuantity: (n) => setQty(Math.max(1, Math.min(MAX_QUANTITY, n))),
    };
  }, [dish, config, quantity]);
}
