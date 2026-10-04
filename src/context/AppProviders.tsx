'use client';

import type { DehydratedState } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/api/QueryProvider';
import { StartRedirect } from '@/components/start/StartRedirect';
import { CartProvider } from './CartContext';
import { CheckoutProvider } from './CheckoutContext';
import { FiltersProvider } from './FiltersContext';
import { GuestSessionProvider } from './GuestSessionContext';
import { QuickAddProvider } from './QuickAddContext';
import { SearchProvider } from './SearchContext';
import { ServiceRequestProvider } from './ServiceRequestContext';
import { ToastProvider } from './ToastContext';

export function AppProviders({
  state,
  children,
}: {
  /** Data fetched at build time by the root layout. */
  state: DehydratedState;
  children: ReactNode;
}) {
  return (
    <QueryProvider state={state}>
      <ToastProvider>
        <GuestSessionProvider>
          <CartProvider>
            <CheckoutProvider>
              <FiltersProvider>
                <SearchProvider>
                  <ServiceRequestProvider>
                    <QuickAddProvider>
                      {children}
                      <StartRedirect />
                    </QuickAddProvider>
                  </ServiceRequestProvider>
                </SearchProvider>
              </FiltersProvider>
            </CheckoutProvider>
          </CartProvider>
        </GuestSessionProvider>
      </ToastProvider>
    </QueryProvider>
  );
}
