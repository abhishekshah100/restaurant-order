'use client';

import { isBackendEnabled } from '@/api/backend';
import { useContent, useFeatures } from '@/api/hooks';
import { useSetFeatures } from '@/api/mutations';
import { useToast } from '@/context/ToastContext';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { ToggleRow } from './shared/SettingsEditor';
import styles from './SettingsHome.module.css';

/**
 * The restaurant's optional modules, for the platform only (super admins): inventory with
 * purchasing, on or off for every branch of the restaurant. Off, the restaurant works as before
 * the module existed; its data is kept for when it's back on.
 */
export function FeaturesCard() {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const { showToast } = useToast();
  const query = useFeatures(branch.id, isBackendEnabled());
  const save = useSetFeatures();
  const data = query.data;
  if (!data?.canChange) return null;
  const on = data.features.includes('inventory');

  return (
    <section className={styles.group} aria-labelledby="settings-features">
      <h2 id="settings-features" className={styles.groupTitle}>
        {t('adminSettings.features.title')}
      </h2>
      <div className={styles.card}>
        <span className={styles.body}>
          <ToggleRow
            id="feature-inventory"
            label={t('adminSettings.features.inventory')}
            hint={t(
              on ? 'adminSettings.features.inventoryOn' : 'adminSettings.features.inventoryOff',
            )}
            checked={on}
            disabled={save.isPending}
            onChange={(next: boolean) =>
              save.mutate(
                { branchId: branch.id, inventory: next },
                {
                  onSuccess: () =>
                    showToast(
                      t(
                        next
                          ? 'adminSettings.features.turnedOn'
                          : 'adminSettings.features.turnedOff',
                      ),
                      {
                        tone: 'success',
                      },
                    ),
                  onError: () => showToast(t('adminSettings.features.failed'), { tone: 'error' }),
                },
              )
            }
          />
          <span className={styles.description}>{t('adminSettings.features.who')}</span>
          {data.changedAt && (
            <span className={styles.summary}>
              {t('adminSettings.features.changedAt', { time: clock.dateTime(data.changedAt) })}
            </span>
          )}
        </span>
      </div>
    </section>
  );
}
