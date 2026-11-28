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

/**
 * Whether the branch's restaurant has a feature (the mock sends none: everything). The server
 * lists only those that work: a part of ordering is off with it.
 */
export const hasFeature = (branch: PlanBranch, feature: PlanFeature): boolean =>
  !branch.features || branch.features.includes(feature);

/** The feature a page belongs to, where it's one a package can leave out. */
export const NAV_FEATURES: Partial<Record<AdminNavId, PlanFeature>> = {
  orders: 'ordering',
  payments: 'ordering',
  // Kitchen messages still reach the floor on Home without the Requests page.
  requests: 'waiterRequests',
  refunds: 'refunds',
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

/** Days before a planned suspension when staff start being warned. */
export const SUSPENDING_WARN_DAYS = 3;
const DAY_MS = 86_400_000;

/** What staff are told about a suspension: a notice, or the platform's own words. */
export type SuspendWhy = Pick<NonNullable<BranchPlan['suspension']>, 'notice' | 'message'>;

export type PlanNotice =
  | { kind: 'ending'; days: number; trial: boolean }
  | { kind: 'grace'; lockAt: string }
  | { kind: 'expired' }
  | ({ kind: 'suspending'; startsAt: string } & SuspendWhy)
  | ({ kind: 'finishing'; until: string } & SuspendWhy)
  | ({ kind: 'suspended' } & SuspendWhy)
  /** This branch is locked: the restaurant is over its package's branches (ADR-056). */
  | { kind: 'branchLocked'; branches: number | null }
  /** A smaller package planned (from ENDING_SOON_DAYS before): `over` it on that day. */
  | { kind: 'changing'; name: string; at: string; over: boolean }
  /** Some branches, logins, tables or dishes are locked now (over the package's limits). */
  | { kind: 'locked'; counts: { branches: number; staff: number; tables: number; dishes: number } };

/**
 * What the banner says about the plan at `now`, if anything. A suspension goes by its times
 * (ADR-055), so the banner moves on with the clock: warned from SUSPENDING_WARN_DAYS before,
 * finishing up until the window ends, then suspended.
 */
export function planNotice(
  plan: BranchPlan | null | undefined,
  now: Date = new Date(),
): PlanNotice | null {
  if (!plan) return null;
  const s = plan.suspension;
  if (s) {
    const why = { notice: s.notice, message: s.message };
    const t = now.getTime();
    const starts = Date.parse(s.startsAt);
    if (t < starts) {
      if (starts - t <= SUSPENDING_WARN_DAYS * DAY_MS) {
        return { kind: 'suspending', startsAt: s.startsAt, ...why };
      }
    } else if (s.finishUntil && t < Date.parse(s.finishUntil)) {
      return { kind: 'finishing', until: s.finishUntil, ...why };
    } else {
      return { kind: 'suspended', ...why };
    }
  }
  if (plan.branchLocked) return { kind: 'branchLocked', branches: plan.limits.branches };
  switch (plan.status) {
    case 'suspended':
      return { kind: 'suspended', notice: null, message: '' };
    case 'expired':
      return { kind: 'expired' };
    case 'grace':
      return plan.lockAt ? { kind: 'grace', lockAt: plan.lockAt } : null;
    default: {
      const change = plan.change;
      if (change && Date.parse(change.at) - now.getTime() <= ENDING_SOON_DAYS * DAY_MS) {
        return {
          kind: 'changing',
          name: change.name,
          at: change.at,
          over: overOn(plan, change.limits),
        };
      }
      if (plan.daysLeft !== null && plan.daysLeft <= ENDING_SOON_DAYS) {
        return { kind: 'ending', days: Math.max(plan.daysLeft, 0), trial: plan.status === 'trial' };
      }
      const locked = plan.locked;
      return locked && locked.branches + locked.staff + locked.tables + locked.dishes > 0
        ? { kind: 'locked', counts: locked }
        : null;
    }
  }
}

/** Whether what the restaurant has goes past these limits (a planned package's). */
export function overOn(plan: BranchPlan, limits: BranchPlan['limits']): boolean {
  return (['staff', 'branches', 'floors', 'tables', 'dishes'] as const).some((k) => {
    const max = limits[k];
    return max !== null && plan.usage[k] > max;
  });
}

/** A WhatsApp link to the platform's number ("98…" in Nepal: +977 added), or undefined. */
export function whatsappLink(number: string, text: string): string | undefined {
  const digits = number.replace(/\D/g, '');
  if (!digits) return undefined;
  const full = digits.length === 10 && digits.startsWith('9') ? `977${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
