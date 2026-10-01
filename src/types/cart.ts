import type { Rupees } from './menu';

/** The configuration that makes a cart line unique. */
export interface LineConfig {
  dishSlug: string;
  variantId?: string;
  addOnIds: string[];
  /** Selected choice per option group, e.g. { spice: 'Medium' }. */
  options: Record<string, string>;
  /** Quick-instruction chips plus free text. */
  instructions: string[];
  note: string;
}

export interface CartLine extends LineConfig {
  /** Stable key derived from the config — see lib/cartLine. */
  key: string;
  quantity: number;
  /** Price of one unit, including variant and add-ons. */
  unitPrice: Rupees;
}

export interface CartState {
  lines: CartLine[];
  kitchenNote: string;
}

export type CartAction =
  | { type: 'add'; config: LineConfig; unitPrice: Rupees; quantity: number }
  | { type: 'setQuantity'; key: string; quantity: number }
  | { type: 'increment'; key: string }
  | { type: 'decrement'; key: string }
  | { type: 'remove'; key: string }
  | { type: 'restore'; line: CartLine; index: number }
  | { type: 'edit'; key: string; config: LineConfig; unitPrice: Rupees; quantity: number }
  | { type: 'setKitchenNote'; note: string }
  | { type: 'clear' }
  | { type: 'hydrate'; state: CartState };
