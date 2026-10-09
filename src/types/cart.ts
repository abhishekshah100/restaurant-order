import type { Price } from './menu';

/** The configuration that makes a cart line unique. */
export interface LineConfig {
  dishSlug: string;
  variantId?: string;
  addOnIds: string[];
  /** Selected choice per option group, e.g. { spice: 'Medium' }. */
  options: Record<string, string>;
  /** Removable ingredient ids the guest asked to leave out. */
  removals: string[];
  /** Quick-instruction chips plus free text. */
  instructions: string[];
  note: string;
}

export interface CartLine extends LineConfig {
  /** Stable key derived from the config — see lib/cartLine. */
  key: string;
  quantity: number;
  /** Price of one unit, including variant and add-ons. */
  unitPrice: Price;
}

/** The order (round) the cart is changing, while the guest edits it. */
export interface CartEditing {
  orderId: string;
  /** The round being changed: the order's latest. */
  round: number;
  /** The cart as it was before editing started; put back when editing ends. */
  stash: { lines: CartLine[]; kitchenNote: string; promoCode?: string };
}

export interface CartState {
  lines: CartLine[];
  kitchenNote: string;
  /** The promo code the guest applied (the server prices it: POST /promos/validate). */
  promoCode?: string;
  /** Set while the cart holds an order being changed ("Editing order #A105"). */
  editing?: CartEditing;
}

export type CartAction =
  | { type: 'add'; config: LineConfig; unitPrice: Price; quantity: number }
  | { type: 'setQuantity'; key: string; quantity: number }
  | { type: 'remove'; key: string }
  | { type: 'restore'; line: CartLine; index: number }
  | { type: 'edit'; key: string; config: LineConfig; unitPrice: Price; quantity: number }
  | { type: 'setKitchenNote'; note: string }
  | { type: 'setPromoCode'; code: string | undefined }
  | { type: 'clear' }
  | { type: 'startEditing'; orderId: string; round: number; lines: CartLine[]; kitchenNote: string }
  | { type: 'stopEditing' }
  | { type: 'hydrate'; state: CartState };
