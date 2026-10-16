import type { IconName } from '@/components/ui/Icon/iconNames';
import { settingsPath } from './adminNav';

/*
 * The Settings pages, grouped: one list for the Settings menu (beside the page from 1024px) and
 * the overview. A new setting is a page under app/admin/dashboard/settings/, an entry here and
 * its words (common › adminSettings.groups / sections).
 */

export type SettingsGroupId = 'restaurant';
export type SettingsSectionId = 'floorPlan';

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
    id: 'restaurant',
    sections: [{ id: 'floorPlan', href: settingsPath('floor-plan'), icon: 'table' }],
  },
];

/** The settings page a pathname is on, if any (none on the overview). */
export function activeSettingsSection(pathname: string): SettingsSectionId | undefined {
  const path = `${pathname.replace(/\/+$/, '')}/`;
  return SETTINGS_GROUPS.flatMap((g) => g.sections).find((s) => path.startsWith(s.href))?.id;
}
