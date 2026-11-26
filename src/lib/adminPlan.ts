import type { PlanFeature, PlanLimit } from '@/api/contracts/platform';
import type { AdminBranch, BranchPlan } from '@/types/admin';
import type { AdminNavId } from './adminNav';

/*
 * What the restaurant's package means on its own screens (restaurant-backend › ADR-051): pages
 * and settings of features it doesn't have are hidden (opened by their link, they go back to
 * where staff start); limits shown as "4 of 5" with Add off at the limit; a banner as the plan's
 * end nears, and the locked screens after it.
 */

type PlanBranch = Pick<AdminBranch, 'features' | 'plan'>;

/** Whether the branch's restaurant has a feature (the mock sends none: everything). */
export const hasFeature = (branch: PlanBranch, feature: PlanFeature): boolean =>
  !branch.features || branch.features.includes(feature);

/** The feature a page belongs to, where it's one a package can leave out. */
export const NAV_FEATURES: Partial<Record<AdminNavId, PlanFeature>> = {
  orders: 'ordering',
  payments: 'ordering',
  reservations: 'reservations',
  inventory: 'inventory',
  purchasing: 'inventory',
  team: 'shifts',
  sales: 'reports',
  audit: 'activityLog',
};

/**
 * The feature a page needs that the package leaves out (the page is hidden from everyone), or
 * undefined: the page is there as usual.
 */
export function offFeature(
  branch: PlanBranch,
  id: AdminNavId | undefined,
): PlanFeature | undefined {
  const feature = id ? NAV_FEATURES[id] : undefined;
  return feature && !hasFeature(branch, feature) ? feature : undefined;
}

/** A limit's room: what's used of it, and whether one more fits (null max: unlimited). */
export function roomFor(
  plan: BranchPlan | null | undefined,
  limit: Exclude<PlanLimit, 'reportDays'>,
) {
  if (!plan) return { used: 0, max: null, full: false };
  const max = plan.limits[limit];
  const used = plan.usage[limit];
  return { used, max, full: max !== null && used >= max };
}

/** Days before the end when the banner starts saying so. */
export const ENDING_SOON_DAYS = 15;

export type PlanNotice =
  | { kind: 'ending'; days: number; trial: boolean }
  | { kind: 'grace'; lockAt: string }
  | { kind: 'expired' }
  | { kind: 'suspended' };

/** What the banner says about the plan now, if anything. */
export function planNotice(plan: BranchPlan | null | undefined): PlanNotice | null {
  if (!plan) return null;
  switch (plan.status) {
    case 'suspended':
      return { kind: 'suspended' };
    case 'expired':
      return { kind: 'expired' };
    case 'grace':
      return plan.lockAt ? { kind: 'grace', lockAt: plan.lockAt } : null;
    default:
      return plan.daysLeft !== null && plan.daysLeft <= ENDING_SOON_DAYS
        ? { kind: 'ending', days: Math.max(plan.daysLeft, 0), trial: plan.status === 'trial' }
        : null;
  }
}

/** A WhatsApp link to the platform's number ("98…" in Nepal: +977 added), or undefined. */
export function whatsappLink(number: string, text: string): string | undefined {
  const digits = number.replace(/\D/g, '');
  if (!digits) return undefined;
  const full = digits.length === 10 && digits.startsWith('9') ? `977${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
