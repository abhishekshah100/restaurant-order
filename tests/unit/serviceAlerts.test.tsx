import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useServiceAlerts } from '@/components/admin/shell/useServiceAlerts';
import { ToastProvider } from '@/context/ToastContext';
import type { AdminBranchService, AdminOrderSummary } from '@/types/admin';
import { ApiTestProvider } from '../apiState';

/* Floor staff alerts: a chime and a vibration for what's new, never for what was already there. */

const playChime = vi.fn(() => true);
vi.mock('@/components/kitchen/shell/kitchenSound', () => ({
  playChime: (...args: unknown[]) => playChime(...(args as [])),
  audioContext: () => null,
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <ApiTestProvider>
    <ToastProvider>{children}</ToastProvider>
  </ApiTestProvider>
);

const order = (id: string, rounds: number[]): AdminOrderSummary => ({
  id,
  mode: 'dineIn',
  table: 6,
  customerName: 'Mr Rao',
  placedAt: '2026-10-28T13:00:00.000Z',
  status: rounds.length > 0 ? 'ready' : 'preparing',
  itemCount: 2,
  total: 617,
  due: 617,
  paymentStatus: 'unpaid',
  readyRounds: rounds.map((round) => ({ round, itemCount: 1, readyAt: '2026-10-28T13:10:00Z' })),
});

const board = (orders: AdminOrderSummary[]): AdminBranchService => ({
  requests: [],
  doneRequests: [],
  orders,
  tables: [],
  counts: { waiterCalls: 0, billRequests: 0, readyToServe: 0, unpaid: 0 },
  generatedAt: '2026-10-28T13:10:00Z',
});

describe('useServiceAlerts', () => {
  beforeEach(() => {
    playChime.mockClear();
  });

  it('stays quiet for what is there on opening, then chimes and vibrates for a new ready round', async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const { rerender } = renderHook(
      ({ service, on }: { service: AdminBranchService; on: boolean }) =>
        useServiceAlerts(service, on),
      { wrapper, initialProps: { service: board([order('UDY-001', [1])]), on: true } },
    );
    await waitFor(() => expect(playChime).not.toHaveBeenCalled());

    rerender({ service: board([order('UDY-001', [1, 2])]), on: true });
    await waitFor(() => expect(playChime).toHaveBeenCalledWith('service'));
    expect(vibrate).toHaveBeenCalledTimes(1);

    // Switched off on this device: nothing, even for something new.
    playChime.mockClear();
    rerender({ service: board([order('UDY-001', [1, 2]), order('UDY-002', [1])]), on: false });
    await waitFor(() => expect(playChime).not.toHaveBeenCalled());
  });
});
