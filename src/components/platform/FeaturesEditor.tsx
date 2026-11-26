'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import type { FeatureGroup, FeatureInfo } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import {
  useCreatePlatformFeature,
  useOrderPlatformFeatures,
  useRemovePlatformFeature,
  useUpdatePlatformFeature,
} from '@/api/mutations';
import { SettingsCard } from '@/components/admin/settings/shared/SettingsEditor';
import { Button, IconButton, Input, Select, Tag } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { FEATURE_GROUP_IDS } from '@/lib/platform';
import { nameTaken } from './catalogErrors';
import styles from './Platform.module.css';

/**
 * The feature catalog: the built-in ones (the app enforces them: renamed, described, regrouped,
 * reordered, never removed) and the platform's own promises (on-site training, priority
 * support…), shown on packages and on each client's My plan page.
 */
export function FeaturesEditor({
  platformKey,
  by,
  catalog,
}: {
  platformKey: string;
  by: string;
  catalog: FeatureInfo[];
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const create = useCreatePlatformFeature(platformKey);
  const order = useOrderPlatformFeatures(platformKey);
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    group: 'services' as FeatureGroup,
  });

  const move = (key: string, step: -1 | 1) => {
    const keys = catalog.map((f) => f.key);
    const i = keys.indexOf(key);
    const j = i + step;
    if (j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j] as string, keys[i] as string];
    order.mutate({ by, keys });
  };

  return (
    <div className={styles.stack}>
      <p className={styles.muted}>{t('platform.catalog.featuresHint')}</p>
      <form
        className={`${styles.addRow} ${styles.wide}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.name.trim()) return;
          create.mutate(
            {
              by,
              name: draft.name.trim(),
              description: draft.description.trim(),
              group: draft.group,
            },
            {
              onSuccess: (made) => {
                setDraft({ name: '', description: '', group: draft.group });
                showToast(t('platform.catalog.featureAdded', { name: made.name }));
              },
              onError: (error) =>
                showToast(
                  t(nameTaken(error) ? 'platform.catalog.nameTaken' : 'platform.catalog.failed'),
                  { tone: 'error' },
                ),
            },
          );
        }}
      >
        <Input
          id="new-feature-name"
          label={t('platform.catalog.featureName')}
          maxLength={60}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <Input
          id="new-feature-description"
          label={t('platform.catalog.description')}
          maxLength={200}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
        <GroupSelect
          id="new-feature-group"
          value={draft.group}
          onChange={(group) => setDraft({ ...draft, group })}
        />
        <Button
          type="submit"
          iconStart="plus"
          disabled={!draft.name.trim()}
          loading={create.isPending}
        >
          {t('platform.catalog.addFeature')}
        </Button>
      </form>
      <SettingsCard title={t('platform.catalog.featuresTitle')}>
        <div>
          {catalog.map((f, i) => (
            <FeatureRow
              key={f.key}
              platformKey={platformKey}
              by={by}
              feature={f}
              first={i === 0}
              last={i === catalog.length - 1}
              onMove={(step) => move(f.key, step)}
              onRemoveRefused={(inUse) =>
                showToast(t(inUse ? 'platform.catalog.inUse' : 'platform.catalog.builtIn'), {
                  tone: 'error',
                })
              }
            />
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}

function GroupSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: FeatureGroup;
  onChange: (group: FeatureGroup) => void;
}) {
  const t = useContent('common');
  return (
    <Select
      id={id}
      label={t('platform.catalog.group')}
      value={value}
      onChange={(e) => onChange(e.target.value as FeatureGroup)}
    >
      {FEATURE_GROUP_IDS.map((g) => (
        <option key={g} value={g}>
          {t(`platform.features.groups.${g}`)}
        </option>
      ))}
    </Select>
  );
}

function FeatureRow({
  platformKey,
  by,
  feature,
  first,
  last,
  onMove,
  onRemoveRefused,
}: {
  platformKey: string;
  by: string;
  feature: FeatureInfo;
  first: boolean;
  last: boolean;
  onMove: (step: -1 | 1) => void;
  onRemoveRefused: (inUse: boolean) => void;
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const update = useUpdatePlatformFeature(platformKey);
  const remove = useRemovePlatformFeature(platformKey);
  const [name, setName] = useState(feature.name);
  const [description, setDescription] = useState(feature.description);
  const [group, setGroup] = useState(feature.group);
  const dirty =
    name.trim() !== feature.name ||
    description.trim() !== feature.description ||
    group !== feature.group;

  return (
    <div className={styles.catalogRow}>
      <div className={styles.catalogRowHead}>
        <span className={styles.row}>
          <strong>{feature.name}</strong>
          {feature.builtIn ? (
            <Tag variant="plain">{t('platform.catalog.builtInTag')}</Tag>
          ) : (
            <Tag variant="new">{t('platform.catalog.ownTag')}</Tag>
          )}
          <span className={styles.muted}>
            {t('platform.catalog.used', { count: feature.used })}
          </span>
        </span>
        <span className={styles.row}>
          <IconButton
            icon="chevd"
            className={styles.up}
            label={t('platform.catalog.up', { name: feature.name })}
            disabled={first}
            onClick={() => onMove(-1)}
          />
          <IconButton
            icon="chevd"
            label={t('platform.catalog.down', { name: feature.name })}
            disabled={last}
            onClick={() => onMove(1)}
          />
        </span>
      </div>
      <div className={styles.fields}>
        <Input
          id={`feature-${feature.key}-name`}
          label={t('platform.catalog.featureName')}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          id={`feature-${feature.key}-description`}
          label={t('platform.catalog.description')}
          maxLength={200}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <GroupSelect id={`feature-${feature.key}-group`} value={group} onChange={setGroup} />
      </div>
      <div className={styles.row}>
        <Button
          size="sm"
          disabled={!dirty || !name.trim()}
          loading={update.isPending}
          onClick={() =>
            update.mutate(
              {
                feature: feature.key,
                body: { by, name: name.trim(), description: description.trim(), group },
              },
              { onSuccess: () => showToast(t('platform.catalog.saved', { name: name.trim() })) },
            )
          }
        >
          {t('platform.save.save')}
        </Button>
        {!feature.builtIn && (
          <Button
            variant="ghost"
            size="sm"
            iconStart="trash"
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(
                { feature: feature.key, by },
                {
                  onSuccess: () => showToast(t('platform.catalog.removed', { name: feature.name })),
                  onError: (error) =>
                    onRemoveRefused(
                      isApiError(error, 'conflict') && error.body?.reason === 'inUse',
                    ),
                },
              )
            }
          >
            {t('platform.payments.remove')}
          </Button>
        )}
      </div>
    </div>
  );
}
