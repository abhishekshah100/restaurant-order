import { MutationCache, QueryCache, QueryClient, isServer } from '@tanstack/react-query';
import { signOutAdmin } from '@/lib/adminAuth';
import { ApiError, isApiError } from './client';

/**
 * Retry once when it may help: no answer came back (offline, timed out) or the server failed
 * (5xx). Never when the server said no (a 4xx such as an unknown order).
 */
const retryOnce = (failures: number, error: Error) =>
  failures < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500);

/**
 * The staff session is over (expired, signed out elsewhere, or the account deactivated): forget
 * it here too, wherever the request came from. The admin pages' guard (AdminAccess) then sends
 * the user to sign in again.
 */
function endStaffSessionOn(error: Error) {
  if (isApiError(error, 'unauthorized')) signOutAdmin();
}

/** Shared defaults: data stays fresh for a minute, failed requests retry once. */
export function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: endStaffSessionOn }),
    mutationCache: new MutationCache({ onError: endStaffSessionOn }),
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
