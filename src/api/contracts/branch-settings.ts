import type { BranchDetails, BranchSettings, BranchSettingsChoices } from '@/types/branchSettings';

/* ---------- Admin: branch settings ---------- */

/**
 * `GET /admin/branches/:branchId/settings` — the branch's settings as staff edit them, one
 * section per Settings page (details with the region, services, opening hours, tax & service
 * charge, payment methods, delivery zones, pickup), and what the pages may choose from (the
 * payment methods the branch's country offers on each screen). Authorised like GET
 * /admin/branches. 200 → `BranchSettingsResponse`. Errors: 401, 403.
 *
 * `PATCH /admin/branches/:branchId/settings` — replaces the sections sent (each whole; the
 * others stay), each checked against the branch as the sections before it left it. Everything
 * reads the branch through GET /branches, so guests' screens, prices, checkout and the server's
 * own checks follow at once: the region (another country brings its phone rules, taxes and
 * payment methods: config/regions), which services are on, today's hours and closed days, taxes
 * and the service charge on new bills, the methods offered at checkout and on the bill, delivery
 * zones, fees and minimums, pickup slots. Orders already placed keep what they were priced
 * with. 200 → `BranchSettingsResponse`. Errors: 400 invalid_request (lib/branchSettings ›
 * detailsErrors, servicesErrors, hoursErrors, taxErrors, paymentErrors, deliveryErrors,
 * pickupErrors), 401, 403.
 */
export interface BranchSettingsResponse {
  settings: BranchSettings;
  choices: BranchSettingsChoices;
}

export type UpdateBranchSettingsRequest = Partial<BranchSettings>;

/**
 * `POST /admin/branches` — opens a new branch (Settings › Branches) with these details, including
 * its region (country, time zone, locale, currency). Its opening hours, delivery zones and
 * pickup, menu, promotions and floor plan start as a copy of `copyFrom` (one of the admin's
 * branches), and so do its taxes and payment methods unless `details.country` differs, when it
 * takes that country's (config/regions). Staff change them in Settings afterwards. The admin
 * manages it at once (GET /admin/branches lists it), guests can choose it on the start screen,
 * and it's open. 201 → `AdminBranch`. Errors: 400 invalid_request (details as for PATCH
 * …/settings, or an unknown `copyFrom`), 401, 403 (`copyFrom` isn't the admin's).
 *
 * `DELETE /admin/branches/:branchId` — removes a branch: it leaves GET /branches and GET
 * /admin/branches, so guests can't choose it and staff can't open it. The admin keeps at least
 * one branch, and a branch with orders today still to finish or pay stays until they're done.
 * 204. Errors: 401, 403, 409 last_branch / branch_in_use.
 */
export interface CreateBranchRequest {
  details: BranchDetails;
  copyFrom: string;
}
