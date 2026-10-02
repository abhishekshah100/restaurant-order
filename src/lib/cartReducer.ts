import type { CartAction, CartLine, CartState } from '@/types/cart';
import { MAX_QUANTITY } from './constants';
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
    case 'increment': {
      const line = state.lines.find((l) => l.key === action.key);
      return line ? withQuantity(state, action.key, line.quantity + 1) : state;
    }
    case 'decrement': {
      const line = state.lines.find((l) => l.key === action.key);
      return line ? withQuantity(state, action.key, line.quantity - 1) : state;
    }
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
      return { ...state, kitchenNote: action.note.slice(0, 120) };
    case 'clear':
      return EMPTY_CART;
    case 'hydrate':
      return action.state;
    default:
      return state;
  }
}

/** Runtime guard for persisted carts. */
export function isCartState(value: unknown): value is CartState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<CartState>;
  return (
    typeof v.kitchenNote === 'string' &&
    Array.isArray(v.lines) &&
    v.lines.every(
      (l) =>
        l &&
        typeof l.key === 'string' &&
        typeof l.dishSlug === 'string' &&
        typeof l.quantity === 'number' &&
        typeof l.unitPrice === 'number' &&
        Array.isArray(l.addOnIds) &&
        Array.isArray(l.instructions) &&
        typeof l.note === 'string' &&
        typeof l.options === 'object',
    )
  );
}
