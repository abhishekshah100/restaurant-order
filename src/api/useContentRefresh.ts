'use client';

import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/** A tab back in view after this long reads its words again. */
export const CONTENT_RECHECK_MS = 10 * 60_000;
/** A screen that never leaves view (a kitchen display) reads them again this often. */
export const CONTENT_REFRESH_MS = 30 * 60_000;

/** Reads every loaded content namespace again (unchanged files answer 304, so it's cheap). */
const refreshContent = (client: QueryClient) => client.invalidateQueries({ queryKey: ['content'] });

/**
 * The app's words are read once per page load (contentQuery: they change only with a deploy).
 * A tab left open across a deploy would keep the old ones, and words added since would show as
 * their keys: so they're read again when the tab comes back into view after a while, and
 * every so often while it stays in view.
 */
export function useContentRefresh(): void {
  const client = useQueryClient();
  useEffect(() => {
    let checkedAt = Date.now();
    const refresh = () => {
      checkedAt = Date.now();
      void refreshContent(client);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - checkedAt >= CONTENT_RECHECK_MS) {
        refresh();
      }
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, CONTENT_REFRESH_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [client]);
}
