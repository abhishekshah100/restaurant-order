'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useBranch } from '@/api/hooks';
import { useActiveOffers } from '@/hooks/useOffers';
import { useOrderingAvailability } from '@/hooks/useRestaurantStatus';
import { createMoney, type Money } from '@/lib/money';
import type { AutoOffer } from '@/types/promotion';

/**
 * What every dish card on a page shares: how the branch writes prices, the offers on now and
 * whether guests can order. Worked out once here instead of in each card, so a menu of 60 dishes
 * doesn't keep hundreds of subscriptions to the branch, and a branch change that doesn't touch
 * prices or ordering (its live status read again, say) doesn't redraw every card.
 */
export interface DishCardShared {
  money: Money;
  /** The branch's automatic offers on now, for how the guest is ordering. */
  offers: readonly AutoOffer[];
  /** False while the restaurant (or the guest's way of ordering) is closed or paused. */
  canAdd: boolean;
}

const DishCardContext = createContext<DishCardShared | null>(null);

export function DishCardProvider({ children }: { children: ReactNode }) {
  const { locale, localeFallback, currency } = useBranch();
  const money = useMemo(
    () => createMoney({ locale, localeFallback, currency }),
    [locale, localeFallback, currency],
  );
  const offers = useActiveOffers();
  const { canAdd } = useOrderingAvailability();
  const value = useMemo(() => ({ money, offers, canAdd }), [money, offers, canAdd]);
  return <DishCardContext.Provider value={value}>{children}</DishCardContext.Provider>;
}

/** The dish cards' shared values (inside the guest pages' DishCardProvider). */
export function useDishCardShared(): DishCardShared {
  const shared = useContext(DishCardContext);
  if (!shared) throw new Error('useDishCardShared must be used inside <DishCardProvider>');
  return shared;
}
