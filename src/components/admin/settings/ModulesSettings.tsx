'use client';

import { isBackendEnabled } from '@/api/backend';
import { useContent, useFeatures } from '@/api/hooks';
import { useSetFeatures } from '@/api/mutations';
import { useToast } from '@/context/ToastContext';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { SettingsCard, SettingsSkeleton, ToggleRow } from './shared/SettingsEditor';
import editor from './shared/SettingsEditor.module.css';

/**
 * Settings › Modules (super admins only): the restaurant's optional modules, on or off for every
 * branch of the restaurant: inventory with purchasing. Off, the restaurant works as before the
 * module existed; its data is kept for when it's back on.
 */
export function ModulesSettings() {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const { showToast } = useToast();
  const query = useFeatures(branch.id, isBackendEnabled());
  const save = useSetFeatures();
  const data = query.data;
  if (!data) return <SettingsSkeleton label={t('adminSettings.features.loading')} />;
  const on = data.features.includes('inventory');

  return (
    <div className={editor.page}>
      <header className={editor.head}>
        <h1 className={editor.title}>{t('adminSettings.sections.modules.title')}</h1>
        <p className={editor.subtitle}>{t('adminSettings.features.subtitle')}</p>
      </header>
      <SettingsCard
        title={t('adminSettings.features.inventory')}
        hint={t('adminSettings.features.who')}
      >
        <ToggleRow
          id="feature-inventory"
          label={t('adminSettings.features.inventoryLabel')}
          hint={t(
            on ? 'adminSettings.features.inventoryOn' : 'adminSettings.features.inventoryOff',
          )}
          checked={on}
          disabled={save.isPending || !data.canChange}
          onChange={(next: boolean) =>
            save.mutate(
              { branchId: branch.id, inventory: next },
              {
                onSuccess: () =>
                  showToast(
                    t(
                      next ? 'adminSettings.features.turnedOn' : 'adminSettings.features.turnedOff',
                    ),
                    { tone: 'success' },
                  ),
                onError: () => showToast(t('adminSettings.features.failed'), { tone: 'error' }),
              },
            )
          }
        />
        {data.changedAt && (
          <p className="t-small c3">
            {t('adminSettings.features.changedAt', { time: clock.dateTime(data.changedAt) })}
          </p>
        )}
      </SettingsCard>
    </div>
  );
}
