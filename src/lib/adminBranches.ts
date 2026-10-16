import type { AdminBranch } from '@/types/admin';

/*
 * The admin's branches: searching and ordering them in the branch picker, and where an admin
 * goes after signing in or when they open an admin page. Pure: the branches come in as
 * arguments (from GET /admin/branches).
 */

export const ADMIN_PATHS = {
  login: '/admin/login/',
  selectBranch: '/admin/select-branch/',
  dashboard: '/admin/dashboard/',
  /** The kitchen's own workspace (lib/kitchenNav), for the same staff accounts. */
  kitchen: '/admin/kitchen-dashboard/',
} as const;

/** The branch picker shows a search field from this many branches. */
export const BRANCH_SEARCH_MIN = 5;

/** Lower case, accents and extra spaces removed, so "Thamel " finds "thamel". */
const normalise = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

type SearchableBranch = Pick<AdminBranch, 'name' | 'shortName' | 'city' | 'address'>;

/** The branches whose name, area (short name), city or address contain every word of the query. */
export function filterAdminBranches<T extends SearchableBranch>(
  branches: readonly T[],
  query: string,
): T[] {
  const words = normalise(query).split(' ').filter(Boolean);
  if (words.length === 0) return [...branches];
  return branches.filter((branch) => {
    const text = normalise([branch.shortName, branch.name, branch.city, branch.address].join(' '));
    return words.every((word) => text.includes(word));
  });
}

/** The last-used branch first, the rest in the order the server listed them. */
export function sortAdminBranches<T extends { id: string }>(
  branches: readonly T[],
  lastUsedId: string | null | undefined,
): T[] {
  const lastUsed = branches.find((branch) => branch.id === lastUsedId);
  return lastUsed ? [lastUsed, ...branches.filter((b) => b !== lastUsed)] : [...branches];
}

/** Where to go next, and the branch to select on the way when there's no choice to make. */
export interface AdminLanding {
  to: string;
  select?: string;
}

/** After signing in: straight to the dashboard of the only branch, else the branch picker. */
export function adminLanding(branches: readonly { id: string }[]): AdminLanding {
  return branches.length === 1
    ? { to: ADMIN_PATHS.dashboard, select: branches[0].id }
    : { to: ADMIN_PATHS.selectBranch };
}

export type AdminPage = 'selectBranch' | 'dashboard' | 'other';

/**
 * Which admin area a pathname is in (with or without its trailing slash). The kitchen dashboard
 * works in a branch like the admin dashboard, so it's guarded the same way.
 */
export function adminPage(pathname: string): AdminPage {
  const path = `${pathname.replace(/\/+$/, '')}/`;
  if (path === ADMIN_PATHS.selectBranch) return 'selectBranch';
  if (path.startsWith(ADMIN_PATHS.dashboard) || path.startsWith(ADMIN_PATHS.kitchen)) {
    return 'dashboard';
  }
  return 'other';
}

export interface AdminAccessInput {
  page: AdminPage;
  signedIn: boolean;
  /** GET /admin/branches; undefined while loading or after a failure. */
  branches: readonly { id: string }[] | undefined;
  /** The request failed (401s aside). */
  failed: boolean;
  /** The server answered 401: the session is gone. */
  unauthorized: boolean;
  selectedId: string | null;
}

export type AdminAccessDecision =
  | { kind: 'allow' }
  | { kind: 'wait' }
  /** Select this branch and stay (the dashboard of an admin with one branch). */
  | { kind: 'select'; branchId: string }
  | { kind: 'redirect'; to: string; select?: string; signOut?: boolean };

/**
 * Whether an admin page may show. Signed out (or a session the server refused): sign in.
 * The branch picker: always, unless there's only one branch to pick. The dashboard: with a
 * selected branch the admin manages; one branch is selected for them; otherwise pick one.
 */
export function adminAccess(input: AdminAccessInput): AdminAccessDecision {
  const { page, signedIn, branches, failed, unauthorized, selectedId } = input;
  if (!signedIn || unauthorized) {
    return { kind: 'redirect', to: ADMIN_PATHS.login, signOut: signedIn };
  }
  if (page === 'selectBranch') {
    return branches?.length === 1
      ? { kind: 'redirect', ...adminLanding(branches) }
      : { kind: 'allow' };
  }
  if (page !== 'dashboard') return { kind: 'allow' };
  if (!branches) {
    // Keep working in the selected branch through a failed refresh; without one, the picker
    // shows the error and Try again.
    if (failed)
      return selectedId ? { kind: 'allow' } : { kind: 'redirect', to: ADMIN_PATHS.selectBranch };
    return { kind: 'wait' };
  }
  if (branches.some((branch) => branch.id === selectedId)) return { kind: 'allow' };
  if (branches.length === 1) return { kind: 'select', branchId: branches[0].id };
  return { kind: 'redirect', to: ADMIN_PATHS.selectBranch };
}
