import { describe, expect, it } from 'vitest';
import { canAt } from '@/components/admin/shell/AdminWorkspace';
import { kitchenNavFor } from '@/lib/kitchenNav';
import {
  adminHomeFor,
  landingFor,
  navFor,
  pagesOf,
  pageNeeds,
  qrCodesPath,
  settingsPath,
  tablePath,
} from '@/lib/adminNav';
import { settingsFor } from '@/lib/adminSettings';
import type { StaffPermission } from '@/types/admin';

const WAITER: StaffPermission[] = [
  'orders.view',
  'orders.take',
  'payments.collect',
  'service.respond',
  'reservations.manage',
  'menu.availability.update',
];
const KITCHEN: StaffPermission[] = ['kitchen.update', 'menu.availability.update'];

describe('canAt', () => {
  it('holds any of the permissions given', () => {
    const can = canAt({ permissions: KITCHEN });
    expect(can('kitchen.update')).toBe(true);
    expect(can('orders.take')).toBe(false);
    expect(can('orders.take', 'kitchen.update')).toBe(true);
  });

  it('lets everything show for a branch sent without its permissions', () => {
    expect(canAt({})('staff.manage')).toBe(true);
  });
});

describe('navFor', () => {
  const ids = (permissions: StaffPermission[]) =>
    navFor(canAt({ permissions })).map((item) => item.id);

  it('shows a waiter the floor, the menu and payments, but not the kitchen or settings', () => {
    expect(ids(WAITER)).toEqual([
      'home',
      'tables',
      'orders',
      'requests',
      'reservations',
      'menu',
      'payments',
    ]);
  });

  it('shows the kitchen only its workspace and the menu, none of the floor', () => {
    expect(ids(KITCHEN)).toEqual(['kitchen', 'menu']);
    expect(ids(['kitchen.update'])).toEqual(['kitchen']);
  });

  it('shows each page for its own permission alone', () => {
    expect(ids(['reservations.manage'])).toEqual(['reservations']);
    expect(ids(['payments.collect'])).toEqual(['payments']);
    expect(ids(['orders.view'])).toEqual(['home', 'tables', 'orders', 'requests']);
  });

  it('shows Settings to anyone who manages part of it', () => {
    expect(ids(['tables.manage'])).toContain('settings');
  });
});

describe('settingsFor', () => {
  it('keeps the pages their role covers and drops empty groups', () => {
    const groups = settingsFor(canAt({ permissions: ['tables.manage', 'staff.manage'] }));
    expect(groups.map((g) => [g.id, g.sections.map((s) => s.id)])).toEqual([
      ['branch', ['floorPlan']],
      ['restaurant', ['staff', 'roles']],
    ]);
  });
});

describe('pageNeeds', () => {
  it("is the nav item's, the floor plan's for QR codes, and the floor staff's for home", () => {
    expect(pageNeeds(tablePath(4))).toEqual(['orders.view']);
    expect(pageNeeds(qrCodesPath())).toEqual(['tables.manage']);
    expect(pageNeeds(settingsPath('tax'))).toContain('branch.settings.manage');
    expect(pageNeeds('/admin/dashboard/')).toEqual(['orders.view']);
  });
});

describe('landingFor', () => {
  const landing = (permissions?: StaffPermission[]) => landingFor(canAt({ permissions }));

  it('starts floor staff at home, the kitchen at its board, others at their first page', () => {
    expect(landing(WAITER)).toBe('/admin/dashboard/');
    expect(landing(KITCHEN)).toBe('/admin/kitchen-dashboard/');
    expect(landing(['menu.manage', 'menu.availability.update'])).toBe('/admin/dashboard/menu/');
    expect(landing(['staff.manage'])).toBe('/admin/dashboard/settings/');
    expect(landing([])).toBeUndefined();
    // The mock sends no permissions: everything shows.
    expect(landing()).toBe('/admin/dashboard/');
  });

  it("takes the kitchen back to the first admin page it may open (not the kitchen's own)", () => {
    expect(adminHomeFor(canAt({ permissions: KITCHEN }))).toBe('/admin/dashboard/menu/');
    expect(adminHomeFor(canAt({ permissions: ['kitchen.update'] }))).toBeUndefined();
  });
});

describe('pagesOf', () => {
  it('names the pages a permission opens (none for an action)', () => {
    expect(pagesOf('kitchen.update')).toEqual(['kitchen']);
    expect(pagesOf('reservations.manage')).toEqual(['reservations']);
    expect(pagesOf('orders.take')).toEqual([]);
  });
});

describe('kitchenNavFor', () => {
  it('shows Stock only to those who may mark dishes sold out', () => {
    const ids = (permissions: StaffPermission[]) =>
      kitchenNavFor(canAt({ permissions })).map((item) => item.id);
    expect(ids(KITCHEN)).toEqual(['board', 'stock', 'activity']);
    expect(ids(['kitchen.update'])).toEqual(['board', 'activity']);
  });
});
