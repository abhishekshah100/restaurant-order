'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { isApiError } from '@/api/client';
import { useContent, useRegion } from '@/api/hooks';
import { useToast } from '@/context/ToastContext';

/**
 * Handles the server turning an order (or its payment) down because of how it's fulfilled — a
 * pickup slot that's gone, an area it doesn't deliver to, a total below the minimum — with an
 * error toast and the step where it can be fixed. Returns false for any other error.
 */
export function useOrderRejected(): (error: unknown) => boolean {
  const router = useRouter();
  const { showToast } = useToast();
  const { money } = useRegion();
  const t = useContent('checkout');
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
      if (isApiError(error, 'below_minimum')) {
        const amount = money.format(error.body?.shortBy ?? 0);
        return fix(t('details.address.belowMinimum', { amount }), '/cart/');
      }
      return false;
    },
    [router, showToast, money, t],
  );
}
