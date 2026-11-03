import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CONTENT_RECHECK_MS, CONTENT_REFRESH_MS, useContentRefresh } from '@/api/useContentRefresh';

/* A long-open tab reads its words again: back in view after a while, and now and then. */

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
};

afterEach(() => {
  vi.useRealTimers();
  setVisibility('visible');
});

describe('useContentRefresh', () => {
  it('reads the words again when the tab is back after a while, and now and then', () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    renderHook(() => useContentRefresh(), { wrapper });

    // Away for a moment: nothing to read.
    setVisibility('hidden');
    vi.advanceTimersByTime(60_000);
    setVisibility('visible');
    expect(invalidate).not.toHaveBeenCalled();

    // Away a while: read again.
    setVisibility('hidden');
    vi.advanceTimersByTime(CONTENT_RECHECK_MS);
    setVisibility('visible');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['content'] });

    // Left in view (a kitchen screen): read again every so often.
    invalidate.mockClear();
    vi.advanceTimersByTime(CONTENT_REFRESH_MS);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
