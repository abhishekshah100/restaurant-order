import type { Branch, BranchConfig, BranchSummary } from '@/types/branch';

/*
 * A branch comes in two parts: its summary (GET /branches, every branch) and its rules for
 * ordering (GET /branches/:id/config, the guest's own). The mock and the build-time data keep a
 * whole branch and split it here, the same way the backend does; the screens join the two.
 */

export function toBranchSummary(b: Branch): BranchSummary {
  return {
    id: b.id,
    name: b.name,
    shortName: b.shortName,
    city: b.city,
    country: b.country,
    address: b.address,
    ...(b.image ? { image: b.image } : {}),
    mapUrl: b.mapUrl,
    phone: b.phone,
    wifiName: b.wifiName,
    status: b.status,
    ...(b.statusUntil ? { statusUntil: b.statusUntil } : {}),
    modeStatus: b.modeStatus,
    schedule: b.schedule,
    locale: b.locale,
    ...(b.localeFallback ? { localeFallback: b.localeFallback } : {}),
    timezone: b.timezone,
    modes: {
      dineIn: { enabled: b.modes.dineIn.enabled },
      takeaway: { enabled: b.modes.takeaway.enabled },
      delivery: { enabled: b.modes.delivery.enabled },
    },
  };
}

export const toBranchConfig = (b: Branch): BranchConfig => ({
  id: b.id,
  currency: b.currency,
  mobile: b.mobile,
  tax: b.tax,
  payments: b.payments,
  dietary: b.dietary,
  modes: b.modes,
  ordering: b.ordering,
  prepMinutes: b.prepMinutes,
});

/** The whole branch from its two parts (the config's modes carry their rules too). */
export const joinBranch = (
  { modes: _flags, ...summary }: BranchSummary,
  config: BranchConfig,
): Branch => ({
  ...summary,
  ...config,
});

/**
 * The name a branch goes by on screen, in titles and on paper: its name before " — " ("The Olive
 * Table — Thamel" is "The Olive Table"; the short name already says which), or all of it.
 */
export const brandName = (branchName: string): string =>
  branchName.split(' — ')[0]?.trim() || branchName;
