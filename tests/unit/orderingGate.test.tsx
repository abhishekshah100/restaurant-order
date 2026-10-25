import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, hydrate } from '@tanstack/react-query';
import { useBranchStatusKnown } from '@/api/hooks';
import { branchesQuery, sessionOrdersQuery } from '@/api/queries';
import { getQueryClient } from '@/api/queryClient';
import { useCartItemTotal } from '@/hooks/useOffers';
import { useOpenTab } from '@/hooks/useRunningOrder';
import { TestProviders, createApiState, seedGuestSession } from '../apiState';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

/*
 * The welcome page and checkout wait for this visit's read of the branch's status (OrderingGate):
 * the copy built into the page can be hours old, so "View menu" never shows for a branch that's
 * closed now. And the header's cart total never downloads the menu for an empty cart.
 */

/** The API data, with the branch list as built into the page (read at time 0) or just read. */
function withBranches(builtIn: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  hydrate(client, createApiState());
  const { queryKey } = branchesQuery();
  if (builtIn) {
    const branches = client.getQueryData(queryKey) ?? [];
    client.setQueryData(queryKey, branches, { updatedAt: 0 });
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return wrapper;
}

describe('useBranchStatusKnown', () => {
  it('waits while only the copy built into the page is known', () => {
    const { result } = renderHook(() => useBranchStatusKnown(), { wrapper: withBranches(true) });
    expect(result.current).toBe(false);
  });

  it('goes on once the list has been read this visit', () => {
    const { result } = renderHook(() => useBranchStatusKnown(), { wrapper: withBranches(false) });
    expect(result.current).toBe(true);
  });
});

describe('useCartItemTotal', () => {
  it('is 0 for an empty cart, without reading the menu', () => {
    const { result } = renderHook(() => useCartItemTotal(), { wrapper: TestProviders });
    expect(result.current).toBe(0);
  });
});

describe('useOpenTab', () => {
  it("doesn't ask for the guest's orders while the cart is empty", async () => {
    const session = seedGuestSession();
    const { result } = renderHook(() => useOpenTab(), { wrapper: TestProviders });
    // Not read: whether there's a running order only matters once there's a dish to send.
    await waitFor(() => expect(result.current).toBeUndefined());
    const state = getQueryClient().getQueryState(sessionOrdersQuery(session.id).queryKey);
    expect(state?.dataUpdatedAt ?? 0).toBe(0);
    expect(state?.fetchStatus ?? 'idle').toBe('idle');
  });
});
