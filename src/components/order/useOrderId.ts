'use client';

import { useSearchParams } from 'next/navigation';

/**
 * The order id of an order page (`?id=A105`, see `orderPath`); null when the URL has none. Read
 * with Next's useSearchParams, which knows the address being opened before the browser shows it
 * (checkout moving on to the confirmation), so a page never says "not found" on its way. The
 * statically exported page renders its loading view until then: the order pages wrap their
 * content in Suspense with it as the fallback, so the HTML itself already shows it.
 */
export function useOrderId(): string | null {
  return useSearchParams().get('id') || null;
}
