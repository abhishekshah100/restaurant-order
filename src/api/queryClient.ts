import { QueryClient, isServer } from '@tanstack/react-query';
import { ApiError } from './client';

/** Retry once, but not when the server said no (a 4xx such as an unknown order). */
const retryOnce = (failures: number, error: Error) =>
  failures < 1 && !(error instanceof ApiError && error.status < 500);

/** Shared defaults: data stays fresh for a minute, failed requests retry once. */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: retryOnce,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

/** A fresh client per server render; one client for the lifetime of the browser tab. */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}
