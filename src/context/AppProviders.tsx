'use client';

import type { ReactNode } from 'react';
import { CartProvider } from './CartContext';
import { CheckoutProvider } from './CheckoutContext';
import { FiltersProvider } from './FiltersContext';
import { OrdersProvider } from './OrdersContext';
import { QuickAddProvider } from './QuickAddContext';
import { SearchProvider } from './SearchContext';
import { TableProvider } from './TableContext';
import { ToastProvider } from './ToastContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <TableProvider>
        <CartProvider>
          <OrdersProvider>
            <CheckoutProvider>
              <FiltersProvider>
                <SearchProvider>
                  <QuickAddProvider>{children}</QuickAddProvider>
                </SearchProvider>
              </FiltersProvider>
            </CheckoutProvider>
          </OrdersProvider>
        </CartProvider>
      </TableProvider>
    </ToastProvider>
  );
}
