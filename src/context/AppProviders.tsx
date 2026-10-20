'use client';

import type { DehydratedState } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/api/QueryProvider';
import { ToastProvider } from './ToastContext';

/**
 * What every page shares, staff and guest alike: the data cache and toasts. The guest pages add
 * their own providers (GuestProviders, in app/(guest)/layout.tsx).
 */
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
      <ToastProvider>{children}</ToastProvider>
    </QueryProvider>
  );
}
