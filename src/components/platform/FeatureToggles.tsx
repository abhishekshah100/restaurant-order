'use client';

import type { FeatureInfo } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { ToggleRow } from '@/components/admin/settings/shared/SettingsEditor';
import { Tag } from '@/components/ui';
import { FEATURE_GROUP_IDS, FEATURE_PARENT, inOrder, offered } from '@/lib/platform';
import styles from './Platform.module.css';

/**
 * Every feature the catalog offers (hidden ones left out, their ticks kept), by group, each on or
 * off. Against a package: on but not in it is an add-on, off but in it is removed. A part on
 * while its whole is off (refunds without ordering) says it works only with that.
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
        const features = offered(catalog).filter((f) => f.group === group);
        if (!features.length) return null;
        return (
          <div key={group} className={styles.stack}>
            <h3 className={styles.groupTitle}>{t(`platform.features.groups.${group}`)}</h3>
            {features.map((feature) => {
              const on = value.includes(feature.key);
              const included = inPackage?.includes(feature.key);
              const parent = FEATURE_PARENT[feature.key];
              const parentOff = on && parent !== undefined && !value.includes(parent);
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
                  {parentOff && (
                    <Tag variant="warn">
                      {t('platform.features.needs', {
                        name: catalog.find((f) => f.key === parent)?.name ?? parent,
                      })}
                    </Tag>
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
