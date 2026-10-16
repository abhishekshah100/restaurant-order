'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { isApiError } from '@/api/client';
import { useBranch, useContent, useRegion } from '@/api/hooks';
import { branchMenuQuery, branchesQuery } from '@/api/queries';
import { useToast } from '@/context/ToastContext';
import { promoError } from './useFulfilment';

/**
 * Handles the server turning an order (or its payment) down because of how it's fulfilled — a
 * pickup slot that's gone, an area it doesn't deliver to, a total below the minimum — because a
 * dish in it just sold out (the menu is read again), because staff paused or closed ordering or
 * took the table out of service,
 * or because its promo code no longer applies, with an error toast and the step where it can be fixed (the cart shows why the code
 * doesn't apply). Returns false for any other error.
 */
export function useOrderRejected(): (error: unknown) => boolean {
  const router = useRouter();
  const { showToast } = useToast();
  const { money } = useRegion();
  const branch = useBranch();
  const client = useQueryClient();
  const list = useMemo(
    () => new Intl.ListFormat(branch.locale, { type: 'conjunction' }),
    [branch.locale],
  );
  const t = useContent('checkout');
  const cart = useContent('cart');
  return useCallback(
    (error: unknown) => {
      const fix = (message: string, href: string) => {
        showToast(message, { tone: 'error' });
        router.replace(href);
        return true;
      };
      if (isApiError(error, 'pickup_unavailable')) {
        return fix(t('details.pickup.unavailable'), '/checkout/details/');
      }
      if (isApiError(error, 'area_not_served')) {
        return fix(t('details.address.notServed'), '/checkout/details/');
      }
      const promo = promoError(error);
      if (promo && promo.error !== 'below_minimum') {
        return fix(cart('promo.rejected'), '/cart/');
      }
      if (isApiError(error, 'ordering_unavailable')) {
        // Staff paused or closed ordering: read the branch again (its screen shows why).
        void client.invalidateQueries({ queryKey: branchesQuery().queryKey, exact: true });
        return fix(t('orderingUnavailable'), '/cart/');
      }
      if (isApiError(error, 'table_disabled')) {
        // Staff took the table out of service: read the branch again (its tables say so).
        void client.invalidateQueries({ queryKey: branchesQuery().queryKey, exact: true });
        return fix(t('tableDisabled'), '/cart/');
      }
      if (isApiError(error, 'item_unavailable')) {
        // Staff took something off since the guest's menu was read: read it again.
        void client.invalidateQueries({ queryKey: branchMenuQuery(branch.id).queryKey });
        return fix(t('unavailable', { items: list.format(error.body?.items ?? []) }), '/cart/');
      }
      if (isApiError(error, 'below_minimum')) {
        const amount = money.format(error.body?.shortBy ?? 0);
        return fix(t('details.address.belowMinimum', { amount }), '/cart/');
      }
      return false;
    },
    [router, showToast, money, t, cart, client, branch.id, list],
  );
}
