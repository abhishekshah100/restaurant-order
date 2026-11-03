import { describe, expect, it } from 'vitest';
import {
  PERMISSION_GROUPS,
  neededBy,
  permissionNeeds,
  permissionWord,
  roleDraft,
  roleInput,
  withNeeds,
} from '@/lib/adminRoles';
import type { AdminRole } from '@/types/admin';

/* Settings › Roles & permissions: the permission groups and the role form. */

const waiter: AdminRole = {
  id: '0d0490b6-cd30-45b7-b1a3-20d36c135bb7',
  key: 'waiter',
  name: 'Waiter',
  description: 'Serves the floor',
  system: true,
  permissions: ['orders.view', 'orders.take', 'payments.collect'],
  staff: 3,
};

describe('roles', () => {
  it('groups every permission once', () => {
    const all = PERMISSION_GROUPS.flatMap((g) => g.permissions);
    expect(all).toHaveLength(15);
    expect(new Set(all).size).toBe(15);
    expect(permissionWord('menu.availability.update')).toBe('menu_availability_update');
  });

  it('opens a copy of a role under a new name, and sends the permissions in order', () => {
    const draft = roleDraft(waiter, 'Waiter (copy)');
    expect(draft).toEqual({
      name: 'Waiter (copy)',
      description: 'Serves the floor',
      permissions: ['orders.view', 'orders.take', 'payments.collect'],
    });
    const input = roleInput({
      ...draft,
      name: '  Head waiter ',
      permissions: ['orders.manage', 'payments.collect', 'orders.view'],
    });
    expect(input).toEqual({
      name: 'Head waiter',
      description: 'Serves the floor',
      permissions: ['orders.view', 'payments.collect', 'orders.manage'],
    });
    expect(roleDraft()).toEqual({ name: '', description: '', permissions: [] });
  });

  it('switches on what a permission needs, and keeps it on while anything needs it', () => {
    const needs = permissionNeeds([
      { key: 'kitchen.update', description: '', needs: ['orders.view'] },
      { key: 'menu.manage', description: '', needs: ['menu.availability.update'] },
      { key: 'orders.view', description: '', needs: [] },
    ]);
    expect(withNeeds(['kitchen.update'], needs)).toEqual(['kitchen.update', 'orders.view']);
    expect(neededBy('orders.view', ['orders.view', 'kitchen.update'], needs)).toEqual([
      'kitchen.update',
    ]);
    expect(neededBy('orders.view', ['orders.view'], needs)).toEqual([]);
  });
});
