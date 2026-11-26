import { apiDelete, apiGet, apiPost } from '../client';
import type {
  MenuCheckResponse,
  MenuLoadRequest,
  MenuLoadResponse,
  SetupCheckResponse,
  SetupClient,
  SetupImportRequest,
  SetupImportResponse,
  SetupRestaurant,
  SetupTemplates,
} from '../contracts';
import { seg } from './shared';

/** How long an import may take: a whole restaurant written over a slow link to the database. */
const IMPORT_TIMEOUT_MS = 90_000;

/** Developer setup requests carry the developer key, never a staff token. */
const devKey = (key: string, init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: { 'X-Dev-Key': key },
});

/** The developer setup page (backend only). */
export const devSetupApi = {
  /** POST /dev/setup/check: the client's JSON checked, nothing written. */
  checkSetup: (key: string, data: unknown) =>
    apiPost<SetupCheckResponse>('dev/setup/check', { data }, devKey(key)),
  /** POST /dev/setup/import: the restaurant made in one go. */
  importSetup: (key: string, body: SetupImportRequest) =>
    apiPost<SetupImportResponse>(
      'dev/setup/import',
      body,
      devKey(key, { signal: AbortSignal.timeout(IMPORT_TIMEOUT_MS) }),
    ),
  /** GET /dev/setup/templates: the sample JSON and the prompt for Claude. */
  setupTemplates: (key: string) => apiGet<SetupTemplates>('dev/setup/templates', devKey(key)),
  /** GET /dev/setup/restaurants: those made there. */
  setupRestaurants: (key: string) =>
    apiGet<SetupRestaurant[]>('dev/setup/restaurants', devKey(key)),
  /** POST /dev/setup/restaurants/:id/reset: the rehearsal's orders and the rest gone. */
  resetSetupRestaurant: (key: string, restaurantId: string) =>
    apiPost<void>(
      `dev/setup/restaurants/${seg(restaurantId)}/reset`,
      {},
      devKey(key, { signal: AbortSignal.timeout(IMPORT_TIMEOUT_MS) }),
    ),
  /** DELETE /dev/setup/restaurants/:id: the restaurant and everything it has gone. */
  deleteSetupRestaurant: (key: string, restaurantId: string) =>
    apiDelete(
      `dev/setup/restaurants/${seg(restaurantId)}`,
      devKey(key, { signal: AbortSignal.timeout(IMPORT_TIMEOUT_MS) }),
    ),
  /** GET /dev/setup/clients: every client and its branches (for Load a menu into a branch). */
  setupClients: (key: string) => apiGet<SetupClient[]>('dev/setup/clients', devKey(key)),
  /** POST /dev/setup/menu/check: a menu checked against the branch, nothing written. */
  checkMenu: (key: string, branchId: string, data: unknown) =>
    apiPost<MenuCheckResponse>('dev/setup/menu/check', { branchId, data }, devKey(key)),
  /** POST /dev/setup/menu/import: the branch's menu loaded in one go. */
  loadMenu: (key: string, body: MenuLoadRequest) =>
    apiPost<MenuLoadResponse>(
      'dev/setup/menu/import',
      body,
      devKey(key, { signal: AbortSignal.timeout(IMPORT_TIMEOUT_MS) }),
    ),
};
