'use client';

import { useState } from 'react';
import type { PackagePlan, PlatformSettings } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { useUpdatePlatformSettings } from '@/api/mutations';
import { SettingsCard } from '@/components/admin/settings/shared/SettingsEditor';
import { Banner, Button, Input, Select } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import styles from './Platform.module.css';

const CONTACTS = ['supportPhone', 'supportWhatsapp', 'supportEmail'] as const;
const BUSINESS = ['businessName', 'businessAddress', 'businessTaxId', 'receiptNote'] as const;
const MAX: Record<(typeof BUSINESS)[number], number> = {
  businessName: 120,
  businessAddress: 200,
  businessTaxId: 30,
  receiptNote: 200,
};

/** The trial new clients get, and the support contact clients see. */
export function PlatformSettingsForm({
  platformKey,
  by,
  settings,
  packages,
}: {
  platformKey: string;
  by: string;
  settings: PlatformSettings;
  packages: PackagePlan[];
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const update = useUpdatePlatformSettings(platformKey);
  const [draft, setDraft] = useState(settings);
  const [failed, setFailed] = useState(false);
  const changed = (Object.keys(draft) as (keyof PlatformSettings)[]).filter(
    (k) => draft[k] !== settings[k],
  );

  const save = () => {
    setFailed(false);
    update.mutate(
      { by, ...Object.fromEntries(changed.map((k) => [k, draft[k]])) },
      {
        onSuccess: () => showToast(t('platform.settings.saved')),
        onError: () => setFailed(true),
      },
    );
  };

  return (
    <SettingsCard
      title={t('platform.settings.title')}
      hint={t('platform.settings.hint')}
      action={
        <Button size="sm" disabled={!changed.length} loading={update.isPending} onClick={save}>
          {t('platform.settings.save')}
        </Button>
      }
    >
      <div className={styles.fields}>
        <Input
          id="trial-days"
          type="number"
          inputMode="numeric"
          min={0}
          max={365}
          label={t('platform.settings.trialDays')}
          value={String(draft.trialDays)}
          onChange={(event) => {
            const n = Number.parseInt(event.target.value, 10);
            setDraft((d) => ({
              ...d,
              trialDays: Number.isNaN(n) ? 0 : Math.min(Math.max(n, 0), 365),
            }));
          }}
        />
        <Select
          id="trial-plan"
          label={t('platform.settings.trialPlan')}
          value={draft.trialPlan}
          onChange={(event) => setDraft((d) => ({ ...d, trialPlan: event.target.value }))}
        >
          {packages.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </Select>
        {CONTACTS.map((key) => (
          <Input
            key={key}
            id={`platform-${key}`}
            type={key === 'supportEmail' ? 'email' : 'tel'}
            maxLength={key === 'supportEmail' ? 120 : 30}
            label={t(`platform.settings.${key}`)}
            value={draft[key]}
            onChange={(event) => setDraft((d) => ({ ...d, [key]: event.target.value }))}
          />
        ))}
      </div>
      <h3 className={styles.groupTitle}>{t('platform.settings.business')}</h3>
      <p className={styles.muted}>{t('platform.settings.businessHint')}</p>
      <div className={styles.fields}>
        {BUSINESS.map((key) => (
          <Input
            key={key}
            id={`platform-${key}`}
            maxLength={MAX[key]}
            label={t(`platform.settings.${key}`)}
            value={draft[key]}
            onChange={(event) => setDraft((d) => ({ ...d, [key]: event.target.value }))}
          />
        ))}
      </div>
      {failed && (
        <Banner tone="err" icon="alert" live="assertive">
          {t('platform.settings.failed')}
        </Banner>
      )}
    </SettingsCard>
  );
}
