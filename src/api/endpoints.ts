/*
 * One typed function per server-owned endpoint (contracts in api/contracts), one file per area in
 * ./endpoints. Components never call these directly: they use the hooks in api/hooks and
 * api/mutations.
 */

import { staffApi } from './endpoints/staff';
import { branchesApi } from './endpoints/branches';
import { tablesApi } from './endpoints/tables';
import { shiftsApi } from './endpoints/shifts';
import { menuApi } from './endpoints/menu';
import { cashApi } from './endpoints/cash';
import { inventoryApi } from './endpoints/inventory';
import { purchasingApi } from './endpoints/purchasing';
import { billingApi } from './endpoints/billing';
import { reservationsApi } from './endpoints/reservations';
import { staffOrdersApi } from './endpoints/staff-orders';
import { auditApi } from './endpoints/audit';
import { guestsApi } from './endpoints/guests';
import { reportsApi } from './endpoints/reports';
import { devSetupApi } from './endpoints/dev-setup';
import { platformApi } from './endpoints/platform';

/** Every request the app makes, by area (./endpoints): `api.placeOrder(…)`. */
export const api = {
  ...staffApi,
  ...branchesApi,
  ...tablesApi,
  ...shiftsApi,
  ...menuApi,
  ...cashApi,
  ...inventoryApi,
  ...purchasingApi,
  ...billingApi,
  ...reservationsApi,
  ...staffOrdersApi,
  ...auditApi,
  ...guestsApi,
  ...reportsApi,
  ...devSetupApi,
  ...platformApi,
};
