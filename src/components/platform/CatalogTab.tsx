'use client';

import { useState } from 'react';
import {
  useContent,
  usePlatformAddons,
  usePlatformFeatures,
  usePlatformPackages,
} from '@/api/hooks';
import { Chip, Skeleton } from '@/components/ui';
import { AddonsEditor } from './AddonsEditor';
import { FeaturesEditor } from './FeaturesEditor';
import { PackagesEditor } from './PackagesEditor';
import styles from './Platform.module.css';

type Part = 'packages' | 'features' | 'addons';

/** The Packages tab: the platform's packages, its feature catalog and its add-ons. */
export function CatalogTab({ platformKey, by }: { platformKey: string; by: string }) {
  const t = useContent('common');
  const [part, setPart] = useState<Part>('packages');
  const packages = usePlatformPackages(platformKey).data;
  const features = usePlatformFeatures(platformKey).data;
  const addons = usePlatformAddons(platformKey).data;

  return (
    <div className={styles.stack}>
      <div className={styles.filters} role="group" aria-label={t('platform.catalog.label')}>
        {(['packages', 'features', 'addons'] as const).map((p) => (
          <Chip key={p} pressed={part === p} onClick={() => setPart(p)}>
            {t(`platform.catalog.parts.${p}`)}
          </Chip>
        ))}
      </div>
      {!packages || !features || !addons ? (
        <Skeleton height={320} />
      ) : part === 'packages' ? (
        <PackagesEditor platformKey={platformKey} by={by} packages={packages} catalog={features} />
      ) : part === 'features' ? (
        <FeaturesEditor platformKey={platformKey} by={by} catalog={features} />
      ) : (
        <AddonsEditor platformKey={platformKey} by={by} addons={addons} catalog={features} />
      )}
    </div>
  );
}
