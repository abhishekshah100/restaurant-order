import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useOrderingAvailability } from '@/hooks/useRestaurantStatus';
import { ApiTestProvider } from '../apiState';

const PREVIEW_KEY = 'olive.status-preview.v1';

function setOnline(online: boolean) {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(online);
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('useOrderingAvailability', () => {
  it('is open by default (status from GET /restaurant)', () => {
    const { result } = renderHook(() => useOrderingAvailability(), { wrapper: ApiTestProvider });
    expect(result.current).toMatchObject({ state: 'open', canAdd: true, canCheckout: true });
  });

  it('follows ?status= and remembers it for the tab', async () => {
    window.history.replaceState(null, '', '/menu/?status=paused');
    const { result } = renderHook(() => useOrderingAvailability(), { wrapper: ApiTestProvider });
    expect(result.current.state).toBe('paused');
    await waitFor(() => expect(window.sessionStorage.getItem(PREVIEW_KEY)).toBe('"paused"'));

    // Still paused on a page without the parameter.
    act(() => window.history.pushState(null, '', '/cart/'));
    await waitFor(() => expect(result.current.state).toBe('paused'));

    // ?status=open clears the preview.
    act(() => window.history.pushState(null, '', '/menu/?status=open'));
    await waitFor(() => expect(window.sessionStorage.getItem(PREVIEW_KEY)).toBeNull());
    expect(result.current.state).toBe('open');
  });

  it('goes offline with the connection and back with "Try again"', () => {
    const { result } = renderHook(() => useOrderingAvailability(), { wrapper: ApiTestProvider });
    act(() => setOnline(false));
    expect(result.current).toMatchObject({ state: 'offline', canCheckout: false });

    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
    act(() => result.current.retry());
    expect(result.current.state).toBe('open');
  });

  it('"Try again" ends an offline preview and drops it from the URL', async () => {
    window.history.replaceState(null, '', '/menu/?status=offline');
    const { result } = renderHook(() => useOrderingAvailability(), { wrapper: ApiTestProvider });
    expect(result.current.state).toBe('offline');

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state).toBe('open'));
    expect(window.location.search).toBe('');
    expect(window.sessionStorage.getItem(PREVIEW_KEY)).toBeNull();
  });
});
