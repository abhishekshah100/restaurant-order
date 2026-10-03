import { QueryClient, isServer } from '@tanstack/react-query';

/** Shared defaults: data stays fresh for a minute, failed requests retry once. */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1,
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
