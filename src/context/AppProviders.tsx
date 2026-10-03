'use client';

import type { DehydratedState } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/api/QueryProvider';
import { CartProvider } from './CartContext';
import { CheckoutProvider } from './CheckoutContext';
import { FiltersProvider } from './FiltersContext';
import { GuestSessionProvider } from './GuestSessionContext';
import { OrdersProvider } from './OrdersContext';
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
            <OrdersProvider>
              <CheckoutProvider>
                <FiltersProvider>
                  <SearchProvider>
                    <ServiceRequestProvider>
                      <QuickAddProvider>{children}</QuickAddProvider>
                    </ServiceRequestProvider>
                  </SearchProvider>
                </FiltersProvider>
              </CheckoutProvider>
            </OrdersProvider>
          </CartProvider>
        </GuestSessionProvider>
      </ToastProvider>
    </QueryProvider>
  );
}
