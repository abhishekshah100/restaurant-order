'use client';

import type { ReactNode } from 'react';
import { useOrderingAvailability } from '@/hooks/useRestaurantStatus';
import { StatusScreen } from './StatusScreen';

/**
 * Shows the restaurant state screen (closed, paused or offline) instead of its
 * children while an order can't be placed. Wraps the welcome page and checkout.
 */
export function OrderingGate({ children }: { children: ReactNode }) {
  const { state } = useOrderingAvailability();
  if (state === 'open') return children;
  return <StatusScreen state={state} />;
}
