'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import type { FeatureInfo, PackagePlan, UpdatePackageRequest } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import {
  useCreatePlatformPackage,
  useOrderPlatformPackages,
  useRemovePlatformPackage,
  useUpdatePlatformPackage,
} from '@/api/mutations';
import { SettingsCard } from '@/components/admin/settings/shared/SettingsEditor';
import { Banner, Button, IconButton, Input, Select, Tag } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { LIMITS, priceOf } from '@/lib/platform';
import { FeatureToggles } from './FeatureToggles';
import { LimitField } from './LimitField';
import { nameTaken } from './catalogErrors';
import styles from './Platform.module.css';

const PRICES = ['yearly', 'halfYearly', 'extraBranch'] as const;
const PRICE_FIELD = {
  yearly: 'yearlyPrice',
  halfYearly: 'halfYearlyPrice',
  extraBranch: 'extraBranchPrice',
} as const;

const text = (n: number | null) => (n === null ? '' : String(n));

/**
 * Each package's defaults, saved one at a time (clients already on one keep their own); a new
 * package (a copy of another), moved up or down, retired (not offered) or deleted while unused.
 */
export function PackagesEditor({
  platformKey,
  by,
  packages,
  catalog,
}: {
  platformKey: string;
  by: string;
  packages: PackagePlan[];
  catalog: FeatureInfo[];
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const create = useCreatePlatformPackage(platformKey);
  const order = useOrderPlatformPackages(platformKey);
  const [name, setName] = useState('');
  const [copyFrom, setCopyFrom] = useState(packages[0]?.code ?? '');

  const move = (code: string, by1: -1 | 1) => {
    const codes = packages.map((p) => p.code);
    const i = codes.indexOf(code);
    const j = i + by1;
    if (j < 0 || j >= codes.length) return;
    [codes[i], codes[j]] = [codes[j] as string, codes[i] as string];
    order.mutate({ by, keys: codes });
  };

  return (
    <div className={styles.stack}>
      <p className={styles.muted}>{t('platform.packages.hint')}</p>
      <form
        className={styles.addRow}
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          create.mutate(
            { by, name: name.trim(), copyFrom },
            {
              onSuccess: (made) => {
                setName('');
                showToast(t('platform.packages.created', { name: made.name }));
              },
              onError: (error) =>
                showToast(
                  t(nameTaken(error) ? 'platform.catalog.nameTaken' : 'platform.packages.failed'),
                  { tone: 'error' },
                ),
            },
          );
        }}
      >
        <Input
          id="new-package-name"
          label={t('platform.packages.newName')}
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          id="new-package-copy"
          label={t('platform.packages.copyFrom')}
          value={copyFrom}
          onChange={(e) => setCopyFrom(e.target.value)}
        >
          {packages.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </Select>
        <Button type="submit" iconStart="plus" disabled={!name.trim()} loading={create.isPending}>
          {t('platform.packages.create')}
        </Button>
      </form>
      {packages.map((p, i) => (
        <PackageForm
          key={p.code}
          platformKey={platformKey}
          by={by}
          pkg={p}
          catalog={catalog}
          first={i === 0}
          last={i === packages.length - 1}
          onMove={(step) => move(p.code, step)}
        />
      ))}
    </div>
  );
}

function PackageForm({
  platformKey,
  by,
  pkg,
  catalog,
  first,
  last,
  onMove,
}: {
  platformKey: string;
  by: string;
  pkg: PackagePlan;
  catalog: FeatureInfo[];
  first: boolean;
  last: boolean;
  onMove: (step: -1 | 1) => void;
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const update = useUpdatePlatformPackage(platformKey);
  const remove = useRemovePlatformPackage(platformKey);
  const retire = (hidden: boolean) =>
    update.mutate(
      { code: pkg.code, body: { by, hidden } },
      {
        onSuccess: () =>
          showToast(
            t(hidden ? 'platform.packages.retired' : 'platform.packages.restored', {
              name: pkg.name,
            }),
          ),
      },
    );
  const del = () =>
    remove.mutate(
      { code: pkg.code, by },
      {
        onSuccess: () => showToast(t('platform.packages.deleted', { name: pkg.name })),
        onError: (error) =>
          showToast(
            isApiError(error, 'conflict') && error.body?.reason === 'trialPlan'
              ? t('platform.packages.isTrial')
              : isApiError(error, 'conflict')
                ? t('platform.packages.inUse')
                : t('platform.packages.failed'),
            { tone: 'error' },
          ),
      },
    );
  const [name, setName] = useState(pkg.name);
  const [prices, setPrices] = useState({
    yearly: text(pkg.prices.yearly),
    halfYearly: text(pkg.prices.halfYearly),
    extraBranch: text(pkg.prices.extraBranch),
  });
  const [limits, setLimits] = useState(pkg.limits);
  const [features, setFeatures] = useState(pkg.features);
  const [failed, setFailed] = useState(false);

  const body: UpdatePackageRequest = { by };
  if (name.trim() !== pkg.name) body.name = name.trim();
  for (const key of PRICES) {
    if (prices[key].trim() !== text(pkg.prices[key])) body[PRICE_FIELD[key]] = priceOf(prices[key]);
  }
  const changedLimits = Object.fromEntries(
    LIMITS.filter(({ id }) => limits[id] !== pkg.limits[id]).map(({ id }) => [id, limits[id]]),
  );
  if (Object.keys(changedLimits).length) body.limits = changedLimits;
  if ([...features].sort().join() !== [...pkg.features].sort().join()) body.features = features;
  const dirty = Object.keys(body).length > 1;
  const invalid = PRICES.some((k) => Number.isNaN(priceOf(prices[k]))) || !name.trim();

  const save = () => {
    setFailed(false);
    update.mutate(
      { code: pkg.code, body },
      {
        onSuccess: (saved) => showToast(t('platform.packages.saved', { name: saved.name })),
        onError: () => setFailed(true),
      },
    );
  };

  return (
    <SettingsCard
      title={pkg.name}
      hint={pkg.hidden ? t('platform.packages.retiredHint') : undefined}
      action={
        <div className={styles.row}>
          {pkg.hidden && <Tag variant="out">{t('platform.packages.retiredTag')}</Tag>}
          <IconButton
            icon="chevd"
            className={styles.up}
            label={t('platform.catalog.up', { name: pkg.name })}
            disabled={first}
            onClick={() => onMove(-1)}
          />
          <IconButton
            icon="chevd"
            label={t('platform.catalog.down', { name: pkg.name })}
            disabled={last}
            onClick={() => onMove(1)}
          />
          <Button size="sm" disabled={!dirty || invalid} loading={update.isPending} onClick={save}>
            {t('platform.packages.save', { name: pkg.name })}
          </Button>
        </div>
      }
    >
      <div className={styles.fields}>
        <Input
          id={`package-${pkg.code}-name`}
          label={t('platform.packages.name')}
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {PRICES.map((key) => (
          <Input
            key={key}
            id={`package-${pkg.code}-${key}`}
            inputMode="numeric"
            label={t(`platform.packages.${key}`)}
            hint={t('platform.packages.priceHint')}
            error={Number.isNaN(priceOf(prices[key])) ? t('platform.price.invalid') : undefined}
            value={prices[key]}
            onChange={(event) => setPrices((p) => ({ ...p, [key]: event.target.value }))}
          />
        ))}
      </div>
      <div className={styles.limits}>
        {LIMITS.map(({ id, step }) => (
          <LimitField
            key={id}
            id={`package-${pkg.code}-${id}`}
            name={t(`platform.limits.names.${id}`)}
            value={limits[id]}
            step={step}
            onChange={(value) => setLimits((l) => ({ ...l, [id]: value }))}
          />
        ))}
      </div>
      <FeatureToggles
        idPrefix={`package-${pkg.code}`}
        catalog={catalog}
        value={features}
        onChange={setFeatures}
      />
      <div className={styles.row}>
        <Button variant="secondary" size="sm" onClick={() => retire(!pkg.hidden)}>
          {pkg.hidden ? t('platform.packages.restore') : t('platform.packages.retire')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          iconStart="trash"
          loading={remove.isPending}
          onClick={del}
        >
          {t('platform.packages.delete')}
        </Button>
      </div>
      {failed && (
        <Banner tone="err" icon="alert" live="assertive">
          {t('platform.packages.failed')}
        </Banner>
      )}
    </SettingsCard>
  );
}
