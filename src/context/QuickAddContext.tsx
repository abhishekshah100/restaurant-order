'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { QuickAddDialog } from '@/components/menu/QuickAddDialog';
import type { Dish } from '@/types/menu';
import { useCartContext } from './CartContext';

interface QuickAddContextValue {
  /** Open quick-add for a dish; pass a cart line key to edit that line. */
  openQuickAdd: (dish: Dish, editKey?: string) => void;
}

const QuickAddContext = createContext<QuickAddContextValue | null>(null);

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{ dish: Dish; editKey?: string } | null>(null);
  const { lines } = useCartContext();
  const openQuickAdd = useCallback(
    (dish: Dish, editKey?: string) => setTarget({ dish, editKey }),
    [],
  );
  const value = useMemo(() => ({ openQuickAdd }), [openQuickAdd]);
  const editing = target?.editKey ? lines.find((l) => l.key === target.editKey) : undefined;

  return (
    <QuickAddContext.Provider value={value}>
      {children}
      {target && (
        <QuickAddDialog
          key={`${target.dish.slug}-${target.editKey ?? 'new'}`}
          dish={target.dish}
          editing={editing}
          onClose={() => setTarget(null)}
        />
      )}
    </QuickAddContext.Provider>
  );
}

export function useQuickAdd(): QuickAddContextValue {
  const ctx = useContext(QuickAddContext);
  if (!ctx) throw new Error('useQuickAdd must be used inside <QuickAddProvider>');
  return ctx;
}
