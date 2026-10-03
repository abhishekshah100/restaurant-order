'use client';

import {
  HydrationBoundary,
  QueryClientProvider,
  type DehydratedState,
} from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getQueryClient } from './queryClient';

/**
 * TanStack Query for the whole app. `state` is the data the root layout fetched at build
 * time, so pages render with their content straight away and the client reuses that cache.
 */
export function QueryProvider({
  state,
  children,
}: {
  state: DehydratedState;
  children: ReactNode;
}) {
  const client = getQueryClient();
  return (
    <QueryClientProvider client={client}>
      <HydrationBoundary state={state}>{children}</HydrationBoundary>
    </QueryClientProvider>
  );
}
