import type { IconName } from '@/components/ui/Icon/iconNames';
import type { StaffPermission } from '@/types/admin';
import { settingsPath } from './adminNav';

/*
 * The Settings menu: a few sections named for the job ("How guests order", "Team & access"),
 * each one page or a few pages shown as tabs. Every page keeps its own address (old links still
 * open it); the menu and the overview list the sections, the tabs the pages. A new setting is a
 * page under app/admin/dashboard/settings/, an entry here (in its section) and its words
 * (common › adminSettings.groups / topics / tabs / sections).
 */

export type SettingsGroupId = 'branch' | 'money' | 'restaurant';

/** A section of the menu. */
export type SettingsTopicId =
  'info' | 'hours' | 'tables' | 'ordering' | 'billing' | 'offers' | 'team' | 'branches';

/** A page (a tab of its section). */
export type SettingsSectionId =
  | 'details'
  | 'help'
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
  | 'staff'
  | 'modules';

export interface SettingsSection {
  id: SettingsSectionId;
  href: string;
  /** Shown to staff holding this at the branch (the permission its server routes check). */
  needs: StaffPermission;
  /** Only for the platform (super admins): the restaurant's optional modules. */
  platformOnly?: true;
}

export interface SettingsTopic {
  id: SettingsTopicId;
  icon: IconName;
  /** Its pages, in tab order; the first one staff may open is where the section opens. */
  pages: readonly SettingsSection[];
}

export interface SettingsGroup {
  id: SettingsGroupId;
  topics: readonly SettingsTopic[];
}

const MANAGE: StaffPermission = 'branch.settings.manage';

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    id: 'branch',
    topics: [
      {
        id: 'info',
        icon: 'store',
        pages: [
          { id: 'details', href: settingsPath('branch'), needs: MANAGE },
          { id: 'help', href: settingsPath('help-page'), needs: MANAGE },
        ],
      },
      {
        id: 'hours',
        icon: 'clock',
        pages: [{ id: 'hours', href: settingsPath('hours'), needs: MANAGE }],
      },
      {
        id: 'tables',
        icon: 'table',
        pages: [{ id: 'floorPlan', href: settingsPath('floor-plan'), needs: 'tables.manage' }],
      },
    ],
  },
  {
    id: 'money',
    topics: [
      {
        id: 'ordering',
        icon: 'cutlery',
        pages: [
          { id: 'services', href: settingsPath('services'), needs: MANAGE },
          { id: 'pickup', href: settingsPath('pickup'), needs: MANAGE },
          { id: 'delivery', href: settingsPath('delivery'), needs: MANAGE },
        ],
      },
      {
        id: 'billing',
        icon: 'receipt',
        pages: [
          { id: 'tax', href: settingsPath('tax'), needs: MANAGE },
          { id: 'payments', href: settingsPath('payments'), needs: MANAGE },
        ],
      },
      {
        id: 'offers',
        icon: 'tag',
        pages: [{ id: 'offers', href: settingsPath('offers'), needs: MANAGE }],
      },
    ],
  },
  {
    id: 'restaurant',
    topics: [
      {
        id: 'team',
        icon: 'user',
        pages: [
          { id: 'staff', href: settingsPath('staff'), needs: 'staff.manage' },
          { id: 'roles', href: settingsPath('roles'), needs: 'staff.manage' },
        ],
      },
      {
        id: 'branches',
        icon: 'pin',
        pages: [
          { id: 'branches', href: settingsPath('branches'), needs: 'branches.manage' },
          {
            id: 'modules',
            href: settingsPath('modules'),
            needs: 'branches.manage',
            platformOnly: true,
          },
        ],
      },
    ],
  },
];

const ALL_TOPICS = SETTINGS_GROUPS.flatMap((g) => g.topics);
const ALL_PAGES = ALL_TOPICS.flatMap((t) => t.pages);

/** Whether a staff member may open a page (`platform`: a super admin). */
export const canOpenPage = (
  page: SettingsSection,
  can: (...permissions: StaffPermission[]) => boolean,
  platform = false,
): boolean => can(page.needs) && (!page.platformOnly || platform);

/**
 * The groups and sections a staff member may open (`can` from useAdminWorkspace; `platform`: a
 * super admin), each section with only the pages they may open; empty ones go. A section opens on
 * its first page they may open (`href`).
 */
export const settingsFor = (
  can: (...permissions: StaffPermission[]) => boolean,
  platform = false,
) =>
  SETTINGS_GROUPS.map((group) => ({
    ...group,
    topics: group.topics
      .map((topic) => {
        const pages = topic.pages.filter((p) => canOpenPage(p, can, platform));
        return { ...topic, pages, href: pages[0]?.href ?? '' };
      })
      .filter((topic) => topic.pages.length > 0),
  })).filter((group) => group.topics.length > 0);

/** A settings page's address by its id. */
export const settingsHref = (id: SettingsSectionId): string =>
  ALL_PAGES.find((s) => s.id === id)?.href ?? '';

/** The settings page a pathname is on, if any (none on the overview). */
export function activeSettingsSection(pathname: string): SettingsSectionId | undefined {
  const path = `${pathname.replace(/\/+$/, '')}/`;
  return ALL_PAGES.find((s) => path.startsWith(s.href))?.id;
}

/** The section a page belongs to. */
export const topicOf = (page: SettingsSectionId): SettingsTopic | undefined =>
  ALL_TOPICS.find((t) => t.pages.some((p) => p.id === page));

/** A page by its id. */
export const settingsPage = (page: SettingsSectionId): SettingsSection | undefined =>
  ALL_PAGES.find((p) => p.id === page);
