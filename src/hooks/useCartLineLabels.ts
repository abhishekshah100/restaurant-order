'use client';

import { useMemo } from 'react';
import { useContent } from '@/api/hooks';
import type { ContentMap } from '@/api/queries';
import type { Translator } from '@/api/translator';
import type { CartLineLabels } from '@/lib/cartLine';

/** The cart-line description words (lib/cartLine) from the cart content (cart › lineLabels). */
export function cartLineLabels(t: Translator<ContentMap['cart']>): CartLineLabels {
  return {
    mediumSpicy: t('lineLabels.mediumSpicy'),
    removal: (name) => t('lineLabels.removal', { name }),
    versions: (count) => t('lineLabels.versions', { count }),
    meal: t('lineLabels.meal'),
    customised: t('lineLabels.customised'),
    addOns: (count) => t.plural('lineLabels.addOns', count),
  };
}

/** Cart-line description words for components: pass them to describeOptions & co. */
export function useCartLineLabels(): CartLineLabels {
  const t = useContent('cart');
  return useMemo(() => cartLineLabels(t), [t]);
}
