'use client';

import { useHydrated } from '@/hooks/useHydrated';
import { useQueryParam } from '@/hooks/useQueryParam';

/**
 * The order id of an order page (`?id=A105`, see `orderPath`). Undefined while the prerendered
 * HTML hydrates (it has no query string), null when the URL has no id.
 */
export function useOrderId(): string | null | undefined {
  const hydrated = useHydrated();
  const id = useQueryParam('id');
  return hydrated ? id || null : undefined;
}
