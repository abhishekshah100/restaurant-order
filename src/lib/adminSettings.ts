import type { IconName } from '@/components/ui/Icon/iconNames';
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
  | 'services'
  | 'delivery'
  | 'pickup'
  | 'branches';

export interface SettingsSection {
  id: SettingsSectionId;
  href: string;
  icon: IconName;
}

export interface SettingsGroup {
  id: SettingsGroupId;
  sections: readonly SettingsSection[];
}

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    id: 'branch',
    sections: [
      { id: 'details', href: settingsPath('branch'), icon: 'store' },
      { id: 'hours', href: settingsPath('hours'), icon: 'clock' },
      { id: 'floorPlan', href: settingsPath('floor-plan'), icon: 'table' },
    ],
  },
  {
    id: 'money',
    sections: [
      { id: 'tax', href: settingsPath('tax'), icon: 'receipt' },
      { id: 'payments', href: settingsPath('payments'), icon: 'card' },
    ],
  },
  {
    id: 'ordering',
    sections: [
      { id: 'services', href: settingsPath('services'), icon: 'cutlery' },
      { id: 'delivery', href: settingsPath('delivery'), icon: 'scooter' },
      { id: 'pickup', href: settingsPath('pickup'), icon: 'bag' },
    ],
  },
  {
    id: 'restaurant',
    sections: [{ id: 'branches', href: settingsPath('branches'), icon: 'pin' }],
  },
];

/** A settings page's address by its id. */
export const settingsHref = (id: SettingsSectionId): string =>
  SETTINGS_GROUPS.flatMap((g) => g.sections).find((s) => s.id === id)?.href ?? '';

/** The settings page a pathname is on, if any (none on the overview). */
export function activeSettingsSection(pathname: string): SettingsSectionId | undefined {
  const path = `${pathname.replace(/\/+$/, '')}/`;
  return SETTINGS_GROUPS.flatMap((g) => g.sections).find((s) => path.startsWith(s.href))?.id;
}
