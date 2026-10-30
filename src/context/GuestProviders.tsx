'use client';

import type { ReactNode } from 'react';
import { useBrandName, useBrandTitle } from '@/hooks/useBrandName';
import { StartRedirect } from '@/components/start/StartRedirect';
import { CartProvider } from './CartContext';
import { CheckoutProvider } from './CheckoutContext';
import { FiltersProvider } from './FiltersContext';
import { GuestSessionProvider } from './GuestSessionContext';
import { QuickAddProvider } from './QuickAddContext';
import { SearchProvider } from './SearchContext';
import { ServiceRequestProvider } from './ServiceRequestContext';

/**
 * What the guest pages share: the guest's session and branch, cart, checkout, menu filters and
 * search, waiter and bill requests. Only the guest pages (app/(guest)) mount it, so staff pages
 * never read the guest's menu or session.
 */
export function GuestProviders({ children }: { children: ReactNode }) {
  return (
    <GuestSessionProvider>
      <CartProvider>
        <CheckoutProvider>
          <FiltersProvider>
            <SearchProvider>
              <ServiceRequestProvider>
                <QuickAddProvider>
                  {children}
                  <StartRedirect />
                  <BrandTitle />
                </QuickAddProvider>
              </ServiceRequestProvider>
            </SearchProvider>
          </FiltersProvider>
        </CheckoutProvider>
      </CartProvider>
    </GuestSessionProvider>
  );
}

/** The tab's title carries the name of the guest's branch. */
function BrandTitle() {
  useBrandTitle(useBrandName());
  return null;
}
