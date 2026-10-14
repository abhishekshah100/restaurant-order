import { describe, expect, it } from 'vitest';
import {
  ADMIN_PATHS,
  adminAccess,
  adminLanding,
  adminPage,
  filterAdminBranches,
  sortAdminBranches,
  type AdminAccessInput,
} from '@/lib/adminBranches';

const branch = (id: string, shortName: string, city: string, address = '') => ({
  id,
  name: `The Olive Table — ${shortName}`,
  shortName,
  city,
  address,
});

const BRANCHES = [
  branch('blr-indiranagar', 'Indiranagar', 'Bengaluru', '100 Feet Road, Indiranagar'),
  branch('ktm-thamel', 'Thamel', 'Kathmandu', 'Chaksibari Marg, Thamel'),
  branch('blr-koramangala', 'Koramangala', 'Bengaluru', '80 Feet Road, Koramangala'),
  branch('pkr-lakeside', 'Lakeside', 'Pokhara', 'Lakeside Road'),
];

describe('filterAdminBranches', () => {
  const ids = (query: string) => filterAdminBranches(BRANCHES, query).map((b) => b.id);

  it('returns every branch for an empty query', () => {
    expect(ids('')).toEqual(BRANCHES.map((b) => b.id));
    expect(ids('   ')).toHaveLength(4);
  });

  it('matches the area, city, name or address in any case', () => {
    expect(ids('thamel')).toEqual(['ktm-thamel']);
    expect(ids('BENGALURU')).toEqual(['blr-indiranagar', 'blr-koramangala']);
    expect(ids('feet road')).toEqual(['blr-indiranagar', 'blr-koramangala']);
    expect(ids('olive')).toHaveLength(4);
  });

  it('needs every word, in any order, ignoring extra spaces and accents', () => {
    expect(ids('  bengaluru   kora ')).toEqual(['blr-koramangala']);
    expect(ids('kora bengaluru')).toEqual(['blr-koramangala']);
    expect(ids('Pókhara')).toEqual(['pkr-lakeside']);
  });

  it('finds nothing for an unknown place', () => {
    expect(ids('delhi')).toEqual([]);
  });
});

describe('sortAdminBranches', () => {
  it('puts the last-used branch first and keeps the server order otherwise', () => {
    expect(sortAdminBranches(BRANCHES, 'blr-koramangala').map((b) => b.id)).toEqual([
      'blr-koramangala',
      'blr-indiranagar',
      'ktm-thamel',
      'pkr-lakeside',
    ]);
  });

  it('keeps the server order without a (known) last-used branch', () => {
    const order = BRANCHES.map((b) => b.id);
    expect(sortAdminBranches(BRANCHES, null).map((b) => b.id)).toEqual(order);
    expect(sortAdminBranches(BRANCHES, 'gone').map((b) => b.id)).toEqual(order);
  });

  it('never changes its input', () => {
    const copy = [...BRANCHES];
    sortAdminBranches(BRANCHES, 'pkr-lakeside');
    expect(BRANCHES).toEqual(copy);
  });
});

describe('adminLanding (after sign-in)', () => {
  it('opens the dashboard of the only branch, selecting it', () => {
    expect(adminLanding([{ id: 'ktm-thamel' }])).toEqual({
      to: ADMIN_PATHS.dashboard,
      select: 'ktm-thamel',
    });
  });

  it('opens the branch picker for several branches (or none)', () => {
    expect(adminLanding(BRANCHES)).toEqual({ to: ADMIN_PATHS.selectBranch });
    expect(adminLanding([])).toEqual({ to: ADMIN_PATHS.selectBranch });
  });
});

describe('adminPage', () => {
  it('reads the admin area with or without the trailing slash', () => {
    expect(adminPage('/admin/select-branch')).toBe('selectBranch');
    expect(adminPage('/admin/select-branch/')).toBe('selectBranch');
    expect(adminPage('/admin/dashboard/')).toBe('dashboard');
    expect(adminPage('/admin/dashboard/orders/ready')).toBe('dashboard');
    expect(adminPage('/admin/login/')).toBe('other');
  });
});

describe('adminAccess', () => {
  const two = [{ id: 'blr-indiranagar' }, { id: 'ktm-thamel' }];
  const input = (over: Partial<AdminAccessInput>): AdminAccessInput => ({
    page: 'dashboard',
    signedIn: true,
    branches: two,
    failed: false,
    unauthorized: false,
    selectedId: null,
    ...over,
  });

  it('sends a signed-out admin to sign in', () => {
    expect(adminAccess(input({ signedIn: false }))).toEqual({
      kind: 'redirect',
      to: ADMIN_PATHS.login,
      signOut: false,
    });
  });

  it('signs out when the server refuses the session', () => {
    expect(adminAccess(input({ unauthorized: true, branches: undefined }))).toEqual({
      kind: 'redirect',
      to: ADMIN_PATHS.login,
      signOut: true,
    });
  });

  it('shows the picker for several branches, also while they load', () => {
    expect(adminAccess(input({ page: 'selectBranch' }))).toEqual({ kind: 'allow' });
    expect(adminAccess(input({ page: 'selectBranch', branches: undefined }))).toEqual({
      kind: 'allow',
    });
  });

  it('skips the picker for a single branch', () => {
    expect(adminAccess(input({ page: 'selectBranch', branches: [{ id: 'ktm-thamel' }] }))).toEqual({
      kind: 'redirect',
      to: ADMIN_PATHS.dashboard,
      select: 'ktm-thamel',
    });
  });

  it('opens the dashboard of a selected branch the admin manages', () => {
    expect(adminAccess(input({ selectedId: 'ktm-thamel' }))).toEqual({ kind: 'allow' });
  });

  it('asks for a branch when none (or one not theirs) is selected', () => {
    const toPicker = { kind: 'redirect', to: ADMIN_PATHS.selectBranch };
    expect(adminAccess(input({ selectedId: null }))).toEqual(toPicker);
    expect(adminAccess(input({ selectedId: 'pkr-lakeside' }))).toEqual(toPicker);
  });

  it('selects the only branch on the dashboard', () => {
    expect(adminAccess(input({ branches: [{ id: 'ktm-thamel' }] }))).toEqual({
      kind: 'select',
      branchId: 'ktm-thamel',
    });
  });

  it('waits while loading, and keeps a selected branch through a failed read', () => {
    expect(adminAccess(input({ branches: undefined }))).toEqual({ kind: 'wait' });
    expect(
      adminAccess(input({ branches: undefined, failed: true, selectedId: 'ktm-thamel' })),
    ).toEqual({ kind: 'allow' });
    expect(adminAccess(input({ branches: undefined, failed: true }))).toEqual({
      kind: 'redirect',
      to: ADMIN_PATHS.selectBranch,
    });
  });
});
