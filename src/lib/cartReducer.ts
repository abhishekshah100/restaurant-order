import type { CartAction, CartLine, CartState } from '@/types/cart';
import { KITCHEN_NOTE_MAX, MAX_QUANTITY } from './constants';
import { lineKey } from './cartLine';

export const EMPTY_CART: CartState = { lines: [], kitchenNote: '' };

const clampQty = (n: number) => Math.max(0, Math.min(MAX_QUANTITY, Math.floor(n)));

function withQuantity(state: CartState, key: string, quantity: number): CartState {
  const q = clampQty(quantity);
  if (q === 0) return { ...state, lines: state.lines.filter((l) => l.key !== key) };
  return {
    ...state,
    lines: state.lines.map((l) => (l.key === key ? { ...l, quantity: q } : l)),
  };
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const key = lineKey(action.config);
      const existing = state.lines.find((l) => l.key === key);
      if (existing) return withQuantity(state, key, existing.quantity + action.quantity);
      const quantity = clampQty(action.quantity);
      if (quantity === 0) return state;
      const line: CartLine = { ...action.config, key, quantity, unitPrice: action.unitPrice };
      return { ...state, lines: [...state.lines, line] };
    }
    case 'setQuantity':
      return withQuantity(state, action.key, action.quantity);
    case 'remove':
      return { ...state, lines: state.lines.filter((l) => l.key !== action.key) };
    case 'restore': {
      if (state.lines.some((l) => l.key === action.line.key)) {
        return withQuantity(
          state,
          action.line.key,
          (state.lines.find((l) => l.key === action.line.key)?.quantity ?? 0) +
            action.line.quantity,
        );
      }
      const lines = [...state.lines];
      lines.splice(Math.min(action.index, lines.length), 0, action.line);
      return { ...state, lines };
    }
    case 'edit': {
      const index = state.lines.findIndex((l) => l.key === action.key);
      if (index === -1) return state;
      const key = lineKey(action.config);
      const quantity = clampQty(action.quantity);
      const others = state.lines.filter((l) => l.key !== action.key);
      const clash = others.find((l) => l.key === key);
      if (clash) {
        // The edited line now matches another line — merge them.
        return withQuantity({ ...state, lines: others }, key, clash.quantity + quantity);
      }
      if (quantity === 0) return { ...state, lines: others };
      const lines = [...state.lines];
      lines[index] = { ...action.config, key, quantity, unitPrice: action.unitPrice };
      return { ...state, lines };
    }
    case 'setKitchenNote':
      return { ...state, kitchenNote: action.note.slice(0, KITCHEN_NOTE_MAX) };
    case 'clear':
      return EMPTY_CART;
    case 'hydrate':
      return action.state;
    default:
      return state;
  }
}

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

const isStringRecord = (v: unknown): v is Record<string, string> =>
  typeof v === 'object' &&
  v !== null &&
  !Array.isArray(v) &&
  Object.values(v).every((x) => typeof x === 'string');

/** Runtime guard for one persisted cart line. */
function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false;
  const l = value as Record<string, unknown>;
  return (
    typeof l.key === 'string' &&
    typeof l.dishSlug === 'string' &&
    (l.variantId === undefined || typeof l.variantId === 'string') &&
    typeof l.quantity === 'number' &&
    Number.isInteger(l.quantity) &&
    l.quantity >= 1 &&
    l.quantity <= MAX_QUANTITY &&
    typeof l.unitPrice === 'number' &&
    Number.isFinite(l.unitPrice) &&
    isStringArray(l.addOnIds) &&
    isStringArray(l.instructions) &&
    isStringArray(l.removals) &&
    typeof l.note === 'string' &&
    isStringRecord(l.options)
  );
}

/** Reads a persisted cart. Malformed lines are dropped rather than rejecting the whole cart. */
export function parseCart(value: unknown): CartState | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.kitchenNote !== 'string' || !Array.isArray(v.lines)) return null;
  const lines = v.lines.filter(isCartLine);
  return { kitchenNote: v.kitchenNote.slice(0, KITCHEN_NOTE_MAX), lines };
}
