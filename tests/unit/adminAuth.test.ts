import { beforeEach, describe, expect, it } from 'vitest';
import {
  adminUsername,
  isAdminSignedIn,
  selectAdminBranch,
  selectedAdminBranch,
  signInAdmin,
  signOutAdmin,
} from '@/lib/adminAuth';
import { testBranches } from '../apiState';

describe('temporary admin browser state', () => {
  beforeEach(() => window.localStorage.clear());

  it('stores and clears the demo sign-in', () => {
    expect(isAdminSignedIn()).toBe(false);
    signInAdmin('abhishek.saha@example.com');
    expect(isAdminSignedIn()).toBe(true);
    expect(adminUsername()).toBe('Abhishek Saha');
    signOutAdmin();
    expect(isAdminSignedIn()).toBe(false);
    expect(adminUsername()).toBeUndefined();
  });

  it('stores a selected branch and ignores unknown branch ids', () => {
    const branches = testBranches();
    selectAdminBranch('ktm-thamel');
    expect(selectedAdminBranch(branches)?.shortName).toBe('Thamel');
    window.localStorage.setItem('olive.admin.branch.v1', 'unknown');
    expect(selectedAdminBranch(branches)).toBeUndefined();
  });

  it('clears the selected branch on sign-out', () => {
    selectAdminBranch('ktm-thamel');
    signOutAdmin();
    expect(selectedAdminBranch(testBranches())).toBeUndefined();
  });
});
