import type { OrderMode } from '@/types/branch';
import type { AutoOffer } from '@/types/promotion';

/* ---------- Settings › Offers ---------- */

/**
 * `GET /admin/branches/:branchId/offers` → `AutoOffer[]`: every automatic offer, paused ones
 * too, in list order (`branch.settings.manage`).
 *
 * `POST /admin/branches/:branchId/offers` (`OfferRequest` → 201 `AutoOffer`: its id comes from its
 * name), `PATCH …/offers/:offerId` (`OfferRequest` → `AutoOffer`, replaced in full) and
 * `DELETE …/offers/:offerId` (204). 400 invalid_request (a percent over 100, ends when it starts,
 * dates the wrong way round, no day, no way of ordering, nothing covered), 404 (no such offer),
 * 422 offer_scope_unknown (`unknown`: categories or dishes the branch's menu lacks).
 */
export interface OfferRequest {
  name: string;
  active: boolean;
  days: AutoOffer['days'];
  from: string;
  to: string;
  startsOn?: string;
  endsOn?: string;
  modes: OrderMode[];
  scope: { categories: string[]; dishes: string[] };
  type: AutoOffer['type'];
  value: number;
}
