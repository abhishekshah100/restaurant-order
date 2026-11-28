'use client';

import { useState } from 'react';
import type { AddonInfo, AddonRequest, FeatureInfo, PlanLimit } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import {
  useCreatePlatformAddon,
  useOrderPlatformAddons,
  useUpdatePlatformAddon,
} from '@/api/mutations';
import { SettingsCard } from '@/components/admin/settings/shared/SettingsEditor';
import { Button, IconButton, Input, Select, Tag } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { LIMITS, priceOf, rupees } from '@/lib/platform';
import { nameTaken } from './catalogErrors';
import styles from './Platform.module.css';

const text = (n: number | null) => (n === null ? '' : String(n));

interface AddonDraft {
  name: string;
  description: string;
  yearly: string;
  halfYearly: string;
  /** '' : none. */
  limitKey: PlanLimit | '';
  limitAmount: string;
  /** '' : none. */
  feature: string;
}

const draftOf = (a?: AddonInfo): AddonDraft => ({
  name: a?.name ?? '',
  description: a?.description ?? '',
  yearly: text(a?.prices.yearly ?? null),
  halfYearly: text(a?.prices.halfYearly ?? null),
  limitKey: a?.limit?.key ?? '',
  limitAmount: a?.limit ? String(a.limit.amount) : '',
  feature: a?.feature ?? '',
});

/** The draft as the server takes it, or null while it isn't right. */
function requestOf(d: AddonDraft, by: string): AddonRequest | null {
  const yearly = priceOf(d.yearly);
  const halfYearly = priceOf(d.halfYearly);
  const amount = Number.parseInt(d.limitAmount, 10);
  if (!d.name.trim() || Number.isNaN(yearly) || Number.isNaN(halfYearly)) return null;
  if (d.limitKey && !(amount >= 1)) return null;
  return {
    by,
    name: d.name.trim(),
    description: d.description.trim(),
    yearlyPrice: yearly,
    halfYearlyPrice: halfYearly,
    limit: d.limitKey ? { key: d.limitKey, amount } : null,
    feature: d.feature || null,
  };
}

/**
 * The add-on catalog: what a client can buy on top of its package, priced per term (yearly or
 * 6 months), each raising a limit (+10 tables), switching a feature on (Inventory), or neither (a
 * service). New, edited, moved, retired (not offered; clients who have it keep it).
 */
export function AddonsEditor({
  platformKey,
  by,
  addons,
  catalog,
}: {
  platformKey: string;
  by: string;
  addons: AddonInfo[];
  catalog: FeatureInfo[];
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const create = useCreatePlatformAddon(platformKey);
  const order = useOrderPlatformAddons(platformKey);
  const [draft, setDraft] = useState(draftOf());
  const body = requestOf(draft, by);

  const move = (code: string, step: -1 | 1) => {
    const codes = addons.map((a) => a.code);
    const i = codes.indexOf(code);
    const j = i + step;
    if (j < 0 || j >= codes.length) return;
    [codes[i], codes[j]] = [codes[j] as string, codes[i] as string];
    order.mutate({ by, keys: codes });
  };

  return (
    <div className={styles.stack}>
      <p className={styles.muted}>{t('platform.catalog.addonsHint')}</p>
      <SettingsCard title={t('platform.catalog.newAddon')}>
        <AddonFields id="new-addon" draft={draft} catalog={catalog} onChange={setDraft} />
        <div>
          <Button
            iconStart="plus"
            disabled={!body}
            loading={create.isPending}
            onClick={() =>
              body &&
              create.mutate(body, {
                onSuccess: (made) => {
                  setDraft(draftOf());
                  showToast(t('platform.catalog.addonAdded', { name: made.name }));
                },
                onError: (error) =>
                  showToast(
                    t(nameTaken(error) ? 'platform.catalog.nameTaken' : 'platform.catalog.failed'),
                    { tone: 'error' },
                  ),
              })
            }
          >
            {t('platform.catalog.addAddon')}
          </Button>
        </div>
      </SettingsCard>
      {addons.map((a, i) => (
        <AddonCard
          key={a.code}
          platformKey={platformKey}
          by={by}
          addon={a}
          catalog={catalog}
          first={i === 0}
          last={i === addons.length - 1}
          onMove={(step) => move(a.code, step)}
        />
      ))}
    </div>
  );
}

function AddonFields({
  id,
  draft,
  catalog,
  onChange,
}: {
  id: string;
  draft: AddonDraft;
  catalog: FeatureInfo[];
  onChange: (d: AddonDraft) => void;
}) {
  const t = useContent('common');
  const set = (patch: Partial<AddonDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className={styles.fields}>
      <Input
        id={`${id}-name`}
        label={t('platform.catalog.addonName')}
        maxLength={60}
        value={draft.name}
        onChange={(e) => set({ name: e.target.value })}
      />
      <Input
        id={`${id}-description`}
        label={t('platform.catalog.description')}
        maxLength={200}
        value={draft.description}
        onChange={(e) => set({ description: e.target.value })}
      />
      <Input
        id={`${id}-yearly`}
        inputMode="numeric"
        label={t('platform.packages.yearly')}
        hint={t('platform.packages.priceHint')}
        error={Number.isNaN(priceOf(draft.yearly)) ? t('platform.price.invalid') : undefined}
        value={draft.yearly}
        onChange={(e) => set({ yearly: e.target.value })}
      />
      <Input
        id={`${id}-half`}
        inputMode="numeric"
        label={t('platform.packages.halfYearly')}
        hint={t('platform.packages.priceHint')}
        error={Number.isNaN(priceOf(draft.halfYearly)) ? t('platform.price.invalid') : undefined}
        value={draft.halfYearly}
        onChange={(e) => set({ halfYearly: e.target.value })}
      />
      <Select
        id={`${id}-limit`}
        label={t('platform.catalog.raises')}
        value={draft.limitKey}
        onChange={(e) => set({ limitKey: e.target.value as PlanLimit | '' })}
      >
        <option value="">{t('platform.catalog.nothing')}</option>
        {LIMITS.map(({ id: limit }) => (
          <option key={limit} value={limit}>
            {t(`platform.limits.names.${limit}`)}
          </option>
        ))}
      </Select>
      {draft.limitKey && (
        <Input
          id={`${id}-amount`}
          type="number"
          inputMode="numeric"
          min={1}
          label={t('platform.catalog.byHowMuch')}
          value={draft.limitAmount}
          onChange={(e) => set({ limitAmount: e.target.value })}
        />
      )}
      <Select
        id={`${id}-feature`}
        label={t('platform.catalog.switchesOn')}
        value={draft.feature}
        onChange={(e) => set({ feature: e.target.value })}
      >
        <option value="">{t('platform.catalog.nothing')}</option>
        {/* Hidden features aren't offered (one an add-on already has stays listed). */}
        {catalog
          .filter((f) => !f.hidden || f.key === draft.feature)
          .map((f) => (
            <option key={f.key} value={f.key}>
              {f.name}
            </option>
          ))}
      </Select>
    </div>
  );
}

function AddonCard({
  platformKey,
  by,
  addon,
  catalog,
  first,
  last,
  onMove,
}: {
  platformKey: string;
  by: string;
  addon: AddonInfo;
  catalog: FeatureInfo[];
  first: boolean;
  last: boolean;
  onMove: (step: -1 | 1) => void;
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const update = useUpdatePlatformAddon(platformKey);
  const [draft, setDraft] = useState(draftOf(addon));
  const body = requestOf(draft, by);
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(addon));
  const price = addon.prices.yearly;

  return (
    <SettingsCard
      title={addon.name}
      hint={
        price === null
          ? t('platform.list.onRequest')
          : t('platform.package.yearly', { price: rupees(price) })
      }
      action={
        <div className={styles.row}>
          {addon.hidden && <Tag variant="out">{t('platform.packages.retiredTag')}</Tag>}
          <IconButton
            icon="chevd"
            className={styles.up}
            label={t('platform.catalog.up', { name: addon.name })}
            disabled={first}
            onClick={() => onMove(-1)}
          />
          <IconButton
            icon="chevd"
            label={t('platform.catalog.down', { name: addon.name })}
            disabled={last}
            onClick={() => onMove(1)}
          />
          <Button
            size="sm"
            disabled={!dirty || !body}
            loading={update.isPending}
            onClick={() =>
              body &&
              update.mutate(
                { code: addon.code, body },
                {
                  onSuccess: () =>
                    showToast(t('platform.catalog.saved', { name: body.name ?? '' })),
                },
              )
            }
          >
            {t('platform.save.save')}
          </Button>
        </div>
      }
    >
      <AddonFields id={`addon-${addon.code}`} draft={draft} catalog={catalog} onChange={setDraft} />
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            update.mutate(
              { code: addon.code, body: { by, hidden: !addon.hidden } },
              {
                onSuccess: () =>
                  showToast(
                    t(addon.hidden ? 'platform.packages.restored' : 'platform.packages.retired', {
                      name: addon.name,
                    }),
                  ),
              },
            )
          }
        >
          {addon.hidden ? t('platform.packages.restore') : t('platform.packages.retire')}
        </Button>
      </div>
    </SettingsCard>
  );
}
