import type { IconName } from '@/components/ui/Icon/iconNames';
import type { StaffPermission } from '@/types/admin';
import { settingsPath } from './adminNav';

/*
 * The Settings pages, grouped: one list for the Settings menu (beside the page from 1024px) and
 * the overview. A new setting is a page under app/admin/dashboard/settings/, an entry here and
 * its words (common › adminSettings.groups / sections).
 */

export type SettingsGroupId = 'branch' | 'money' | 'ordering' | 'restaurant';
export type SettingsSectionId =
  | 'details'
  | 'hours'
  | 'floorPlan'
  | 'tax'
  | 'payments'
  | 'offers'
  | 'services'
  | 'delivery'
  | 'pickup'
  | 'branches'
  | 'roles'
  | 'staff';

export interface SettingsSection {
  id: SettingsSectionId;
  href: string;
  icon: IconName;
  /** Shown to staff holding this at the branch (the permission its server routes check). */
  needs: StaffPermission;
}

export interface SettingsGroup {
  id: SettingsGroupId;
  sections: readonly SettingsSection[];
}

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    id: 'branch',
    sections: [
      {
        id: 'details',
        href: settingsPath('branch'),
        icon: 'store',
        needs: 'branch.settings.manage',
      },
      { id: 'hours', href: settingsPath('hours'), icon: 'clock', needs: 'branch.settings.manage' },
      { id: 'floorPlan', href: settingsPath('floor-plan'), icon: 'table', needs: 'tables.manage' },
    ],
  },
  {
    id: 'money',
    sections: [
      { id: 'tax', href: settingsPath('tax'), icon: 'receipt', needs: 'branch.settings.manage' },
      {
        id: 'payments',
        href: settingsPath('payments'),
        icon: 'card',
        needs: 'branch.settings.manage',
      },
      { id: 'offers', href: settingsPath('offers'), icon: 'tag', needs: 'branch.settings.manage' },
    ],
  },
  {
    id: 'ordering',
    sections: [
      {
        id: 'services',
        href: settingsPath('services'),
        icon: 'cutlery',
        needs: 'branch.settings.manage',
      },
      {
        id: 'delivery',
        href: settingsPath('delivery'),
        icon: 'scooter',
        needs: 'branch.settings.manage',
      },
      { id: 'pickup', href: settingsPath('pickup'), icon: 'bag', needs: 'branch.settings.manage' },
    ],
  },
  {
    id: 'restaurant',
    sections: [
      { id: 'branches', href: settingsPath('branches'), icon: 'pin', needs: 'branches.manage' },
      { id: 'staff', href: settingsPath('staff'), icon: 'user', needs: 'staff.manage' },
      { id: 'roles', href: settingsPath('roles'), icon: 'shield', needs: 'staff.manage' },
    ],
  },
];

/** The groups and pages a staff member may open (`can` from useAdminWorkspace); empty groups go. */
export const settingsFor = (can: (...permissions: StaffPermission[]) => boolean) =>
  SETTINGS_GROUPS.map((group) => ({
    ...group,
    sections: group.sections.filter((section) => can(section.needs)),
  })).filter((group) => group.sections.length > 0);

/** A settings page's address by its id. */
export const settingsHref = (id: SettingsSectionId): string =>
  SETTINGS_GROUPS.flatMap((g) => g.sections).find((s) => s.id === id)?.href ?? '';

/** The settings page a pathname is on, if any (none on the overview). */
export function activeSettingsSection(pathname: string): SettingsSectionId | undefined {
  const path = `${pathname.replace(/\/+$/, '')}/`;
  return SETTINGS_GROUPS.flatMap((g) => g.sections).find((s) => path.startsWith(s.href))?.id;
}
