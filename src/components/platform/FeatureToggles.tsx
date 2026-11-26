'use client';

import type { FeatureInfo } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { ToggleRow } from '@/components/admin/settings/shared/SettingsEditor';
import { Tag } from '@/components/ui';
import { FEATURE_GROUP_IDS, inOrder } from '@/lib/platform';
import styles from './Platform.module.css';

/**
 * Every feature of the catalog, by group, each on or off. Against a package: on but not in it is
 * an add-on, off but in it is removed.
 */
export function FeatureToggles({
  idPrefix,
  catalog,
  value,
  inPackage,
  onChange,
}: {
  idPrefix: string;
  /** The feature catalog (GET /platform/features), in its order. */
  catalog: readonly FeatureInfo[];
  value: string[];
  /** The package's features (undefined: no tags, as on the Packages tab). */
  inPackage?: string[];
  onChange: (features: string[]) => void;
}) {
  const t = useContent('common');
  const toggle = (key: string, on: boolean) =>
    onChange(inOrder(on ? [...value, key] : value.filter((f) => f !== key)));
  return (
    <div className={styles.stack}>
      {FEATURE_GROUP_IDS.map((group) => {
        const features = catalog.filter((f) => f.group === group);
        if (!features.length) return null;
        return (
          <div key={group} className={styles.stack}>
            <h3 className={styles.groupTitle}>{t(`platform.features.groups.${group}`)}</h3>
            {features.map((feature) => {
              const on = value.includes(feature.key);
              const included = inPackage?.includes(feature.key);
              return (
                <div key={feature.key} className={styles.feature}>
                  <ToggleRow
                    id={`${idPrefix}-${feature.key}`}
                    label={feature.name}
                    hint={feature.description || undefined}
                    checked={on}
                    onChange={(checked) => toggle(feature.key, checked)}
                  />
                  {inPackage && on && !included && (
                    <Tag variant="new">{t('platform.features.addOn')}</Tag>
                  )}
                  {inPackage && !on && included && (
                    <Tag variant="warn">{t('platform.features.removed')}</Tag>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
