import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adminSession,
  adminUsername,
  isAdminSignedIn,
  selectAdminBranch,
  selectedAdminBranch,
  signInAdmin,
  signOutAdmin,
  subscribeAdminSession,
} from '@/lib/adminAuth';
import type { AdminSession } from '@/types/admin';
import { testBranches } from '../apiState';

const NOW = Date.parse('2026-10-14T10:00:00+05:30');
const session = (over: Partial<AdminSession> = {}): AdminSession => ({
  token: 'token-1',
  admin: { name: 'Abhishek Saha', email: 'abhishek@example.com', phone: '+919876543210' },
  expiresAt: NOW + 60_000,
  ...over,
});

describe('admin session on this device', () => {
  beforeEach(() => window.localStorage.clear());

  it('stores the server session and clears it on sign-out', () => {
    expect(isAdminSignedIn(NOW)).toBe(false);
    signInAdmin(session());
    expect(isAdminSignedIn(NOW)).toBe(true);
    expect(adminSession(NOW)?.token).toBe('token-1');
    signOutAdmin();
    expect(isAdminSignedIn(NOW)).toBe(false);
  });

  it('takes the name from the session', () => {
    signInAdmin(session({ expiresAt: Date.now() + 60_000 }));
    expect(adminUsername()).toBe('Abhishek Saha');
  });

  it('treats an expired session as signed out', () => {
    signInAdmin(session());
    expect(isAdminSignedIn(NOW + 59_999)).toBe(true);
    expect(isAdminSignedIn(NOW + 60_000)).toBe(false);
    expect(adminSession(NOW + 60_000)).toBeNull();
  });

  it('ignores a stored value that is not a session', () => {
    window.localStorage.setItem('olive.admin.session.v1', 'true');
    expect(isAdminSignedIn(NOW)).toBe(false);
    window.localStorage.setItem('olive.admin.session.v1', JSON.stringify({ token: 'x' }));
    expect(isAdminSignedIn(NOW)).toBe(false);
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

  it('tells subscribers about sign-in, branch changes and sign-out', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAdminSession(listener);
    signInAdmin(session());
    selectAdminBranch('ktm-thamel');
    signOutAdmin();
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    signInAdmin(session());
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
