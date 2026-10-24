import { describe, expect, it } from 'vitest';
import { fitsBranches, parseScan, refusedScan, resolveBranch, resolveScan } from '@/lib/scan';
import { isLiveSession } from '@/lib/session';
import type { GuestSession } from '@/types/session';
import { testBranches, testRestaurant } from '../apiState';

const branches = testBranches();
const { defaultBranchId } = testRestaurant();
const india = resolveBranch(branches, defaultBranchId);

const parse = (search: string) => parseScan(search, branches, defaultBranchId);
const session = (over: Partial<GuestSession> = {}): GuestSession => ({
  id: 's1',
  branchId: india.id,
  mode: 'dineIn',
  table: 7,
  startedAt: 0,
  expiresAt: 1,
  ...over,
});

describe('parseScan', () => {
  it('reads the branch and table; a link without a branch names none', () => {
    expect(parse('?branch=ktm-thamel&table=5')).toEqual({
      branchId: 'ktm-thamel',
      table: 5,
      mode: null,
    });
    expect(parse('?table=12')).toEqual({ branchId: null, table: 12, mode: null });
    expect(parse('?branch=ktm-thamel')).toEqual({
      branchId: 'ktm-thamel',
      table: null,
      mode: null,
    });
  });

  it('falls back to the default branch for an unknown one', () => {
    expect(parse('?branch=nowhere&table=5')).toEqual({ branchId: india.id, table: 5, mode: null });
  });

  it("passes any table number on for the server to check, and ignores what isn't one", () => {
    // Thamel has 40 tables: whether 41 is one of them is the server's to say (refusedScan).
    expect(parse('?branch=ktm-thamel&table=41')).toEqual({
      branchId: 'ktm-thamel',
      table: 41,
      mode: null,
    });
    expect(parse('?table=0')).toBeNull();
    expect(parse('?table=12345')).toBeNull();
    expect(parse('?table=abc')).toBeNull();
    expect(parse('')).toBeNull();
  });

  it('reads takeaway and delivery links, and ignores other modes', () => {
    expect(parse('?mode=takeaway')).toEqual({ branchId: null, table: null, mode: 'takeaway' });
    expect(parse('?branch=ktm-thamel&mode=delivery')).toEqual({
      branchId: 'ktm-thamel',
      table: null,
      mode: 'delivery',
    });
    // Dine-in comes only with a table QR code.
    expect(parse('?mode=dineIn')).toBeNull();
    expect(parse('?mode=drive-through')).toBeNull();
  });

  it('keeps a well-formed QR token only', () => {
    expect(parse('?table=7&qr=abc.DEF-1')).toMatchObject({ qrToken: 'abc.DEF-1' });
    expect(parse('?table=7&qr=<x>')).not.toHaveProperty('qrToken');
  });
});

describe('resolveScan', () => {
  const resolve = (saved: GuestSession | null, search: string) =>
    resolveScan(saved, parse(search), branches, defaultBranchId);

  it('keeps the saved session for the same branch and table, or no link', () => {
    const saved = session();
    expect(resolve(saved, '?table=7')).toEqual({ keep: saved });
    expect(resolve(saved, '')).toEqual({ keep: saved });
    const there = session({ branchId: 'ktm-thamel', table: 3 });
    expect(resolve(there, '?branch=ktm-thamel')).toEqual({ keep: there });
  });

  it('starts a dine-in session for another table or another branch', () => {
    expect(resolve(session(), '?table=8')).toEqual({
      start: { branchId: india.id, mode: 'dineIn', table: 8 },
    });
    expect(resolve(session(), '?branch=ktm-thamel&table=7')).toEqual({
      start: { branchId: 'ktm-thamel', mode: 'dineIn', table: 7 },
    });
  });

  it('opens the start screen without a session, keeping what the link chose', () => {
    expect(resolve(null, '')).toEqual({ choose: {} });
    expect(resolve(null, '?mode=delivery')).toEqual({ choose: { mode: 'delivery' } });
    expect(resolve(session(), '?branch=ktm-thamel')).toEqual({
      choose: { branchId: 'ktm-thamel' },
    });
  });

  it('switches the saved session to an ordering link’s mode at the same branch', () => {
    const saved = session();
    expect(resolve(saved, '?mode=takeaway')).toEqual({
      change: { session: saved, mode: 'takeaway' },
    });
    const takeaway = session({ mode: 'takeaway', table: undefined });
    expect(resolve(takeaway, `?branch=${india.id}&mode=takeaway`)).toEqual({ keep: takeaway });
  });

  it('starts a takeaway or delivery session at another branch an ordering link names', () => {
    expect(resolve(session(), '?branch=ktm-thamel&mode=delivery')).toEqual({
      start: { branchId: 'ktm-thamel', mode: 'delivery' },
    });
    expect(resolve(null, '?branch=ktm-thamel&mode=takeaway')).toEqual({
      start: { branchId: 'ktm-thamel', mode: 'takeaway' },
    });
  });
});

describe('fitsBranches', () => {
  it('needs a branch that is still there (its tables are the server’s to check)', () => {
    expect(fitsBranches(session(), branches)).toBe(true);
    expect(fitsBranches(session({ branchId: 'gone' }), branches)).toBe(false);
    expect(fitsBranches(session({ mode: 'takeaway', table: undefined }), branches)).toBe(true);
  });
});

describe('refusedScan', () => {
  const scan = { branchId: 'blr-indiranagar', mode: 'dineIn' as const, table: 5, qrToken: 'v1.x' };

  it('sends a forged or edited table link, a table out of service, or one the branch doesn’t have, to the start screen', () => {
    expect(refusedScan(scan, 'qr_invalid')).toEqual({
      branchId: 'blr-indiranagar',
      invalidTable: 5,
    });
    expect(refusedScan(scan, 'invalid_request')).toEqual({
      branchId: 'blr-indiranagar',
      invalidTable: 5,
    });
    expect(refusedScan(scan, 'table_disabled')).toEqual({
      branchId: 'blr-indiranagar',
      closedTable: 5,
    });
  });

  it('leaves any other failure to be tried again', () => {
    expect(refusedScan(scan, undefined)).toBeNull();
    expect(refusedScan(scan, 'server_error')).toBeNull();
    expect(refusedScan({ branchId: 'blr-indiranagar', mode: 'takeaway' }, 'qr_invalid')).toBeNull();
  });
});

describe('isLiveSession', () => {
  it("takes a session the server just opened, on a device a little behind the server's clock", () => {
    const opened = { startedAt: 1_000_000, expiresAt: 1_000_000 + 3_600_000 };
    expect(isLiveSession(opened, 1_000_000 - 30_000)).toBe(true);
    expect(isLiveSession(opened, opened.expiresAt)).toBe(false);
  });
});
