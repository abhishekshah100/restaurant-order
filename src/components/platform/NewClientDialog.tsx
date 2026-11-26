'use client';

import { useState } from 'react';
import type { NewClientResult, PackagePlan } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { useCreatePlatformClient } from '@/api/mutations';
import { isApiError } from '@/api/client';
import { Banner, Button, Chip, Dialog, Input, Select } from '@/components/ui';
import styles from './Platform.module.css';

/**
 * New client: the restaurant, its first branch (Nepal or India), the owner's sign-in, how many
 * tables, the package and whether it starts on the trial. Made live (Dev setup can't touch it),
 * its menu empty (loaded on the Dev setup tab). Then the owner's sign-in, shown once to pass on.
 */
export function NewClientDialog({
  platformKey,
  by,
  packages,
  onClose,
  onOpen,
}: {
  platformKey: string;
  by: string;
  packages: PackagePlan[];
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const t = useContent('common');
  const create = useCreatePlatformClient(platformKey);
  const [form, setForm] = useState({
    name: '',
    city: '',
    address: '',
    country: 'NP' as 'NP' | 'IN',
    owner: '',
    phone: '',
    email: '',
    password: '',
    tables: '10',
    plan:
      packages.find((p) => p.code === 'basic' && !p.hidden)?.code ??
      packages.find((p) => !p.hidden)?.code ??
      '',
    trial: true,
  });
  const [problem, setProblem] = useState<string | null>(null);
  const [made, setMade] = useState<NewClientResult | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const tables = Number.parseInt(form.tables, 10);
  const valid =
    form.name.trim() &&
    form.city.trim() &&
    form.address.trim() &&
    form.owner.trim() &&
    /^\d{6,15}$/.test(form.phone.replace(/[\s-]/g, '')) &&
    tables >= 1 &&
    tables <= 100 &&
    (!form.password || form.password.length >= 8);

  const save = async () => {
    setProblem(null);
    try {
      const result = await create.mutateAsync({
        by,
        name: form.name.trim(),
        branch: { city: form.city.trim(), address: form.address.trim(), country: form.country },
        owner: {
          name: form.owner.trim(),
          phone: form.phone.replace(/[\s-]/g, ''),
          ...(form.email.trim() ? { email: form.email.trim() } : {}),
          ...(form.password ? { password: form.password } : {}),
        },
        tables,
        plan: form.plan,
        trial: form.trial,
      });
      setMade(result);
    } catch (error) {
      setProblem(
        isApiError(error, 'conflict')
          ? t('platform.newClient.exists')
          : isApiError(error, 'invalid_request')
            ? t('platform.newClient.invalid')
            : t('platform.newClient.failed'),
      );
    }
  };

  if (made) {
    const link = `${window.location.origin}/admin/login/?branch=${encodeURIComponent(made.branchId)}`;
    return (
      <Dialog
        open
        onClose={onClose}
        presentation="modal"
        title={t('platform.newClient.madeTitle', { name: made.client.name })}
        footer={
          <div className={styles.dialogActions}>
            <Button variant="secondary" onClick={onClose}>
              {t('platform.newClient.done')}
            </Button>
            <Button onClick={() => onOpen(made.client.id)}>{t('platform.newClient.open')}</Button>
          </div>
        }
      >
        <div className={styles.dialogBody}>
          <Banner tone="warn" icon="alert">
            {t('platform.newClient.once')}
          </Banner>
          <dl className={styles.credentials}>
            <dt>{t('platform.newClient.link')}</dt>
            <dd>{link}</dd>
            <dt>{t('platform.newClient.signIn')}</dt>
            <dd>{made.owner.email || made.owner.phone}</dd>
            {made.owner.email && (
              <>
                <dt>{t('platform.newClient.mobile')}</dt>
                <dd>{made.owner.phone}</dd>
              </>
            )}
            <dt>{t('platform.newClient.password')}</dt>
            <dd>{made.owner.password}</dd>
          </dl>
          <Button
            variant="secondary"
            size="sm"
            iconStart="copy"
            onClick={() =>
              void navigator.clipboard.writeText(
                t('platform.newClient.copyText', {
                  name: made.owner.name,
                  link,
                  login: made.owner.email || made.owner.phone,
                  password: made.owner.password,
                }),
              )
            }
          >
            {t('platform.newClient.copy')}
          </Button>
          <p className={styles.muted}>{t('platform.newClient.next')}</p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={() => !create.isPending && onClose()}
      presentation="modal"
      title={t('platform.newClient.title')}
      footer={
        <div className={styles.dialogActions}>
          <Button variant="secondary" disabled={create.isPending} onClick={onClose}>
            {t('platform.suspend.cancel')}
          </Button>
          <Button disabled={!valid} loading={create.isPending} onClick={() => void save()}>
            {t('platform.newClient.create')}
          </Button>
        </div>
      }
    >
      <div className={styles.dialogBody}>
        <Input
          id="new-name"
          label={t('platform.newClient.name')}
          maxLength={60}
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
        />
        <div className={styles.row} role="group" aria-label={t('platform.newClient.country')}>
          {(['NP', 'IN'] as const).map((c) => (
            <Chip key={c} pressed={form.country === c} onClick={() => set({ country: c })}>
              {t(`platform.newClient.countries.${c}`)}
            </Chip>
          ))}
        </div>
        <div className={styles.fields}>
          <Input
            id="new-city"
            label={t('platform.newClient.city')}
            maxLength={40}
            value={form.city}
            onChange={(e) => set({ city: e.target.value })}
          />
          <Input
            id="new-address"
            label={t('platform.newClient.address')}
            maxLength={160}
            value={form.address}
            onChange={(e) => set({ address: e.target.value })}
          />
          <Input
            id="new-owner"
            label={t('platform.newClient.owner')}
            maxLength={100}
            value={form.owner}
            onChange={(e) => set({ owner: e.target.value })}
          />
          <Input
            id="new-phone"
            type="tel"
            inputMode="numeric"
            label={t('platform.newClient.phone')}
            hint={t('platform.newClient.phoneHint')}
            value={form.phone}
            onChange={(e) => set({ phone: e.target.value })}
          />
          <Input
            id="new-email"
            type="email"
            label={t('platform.newClient.email')}
            hint={t('platform.newClient.optional')}
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
          />
          <Input
            id="new-password"
            type="text"
            autoComplete="off"
            label={t('platform.newClient.passwordLabel')}
            hint={t('platform.newClient.passwordHint')}
            value={form.password}
            onChange={(e) => set({ password: e.target.value })}
          />
          <Input
            id="new-tables"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            label={t('platform.newClient.tables')}
            value={form.tables}
            onChange={(e) => set({ tables: e.target.value })}
          />
          <Select
            id="new-plan"
            label={t('platform.package.title')}
            value={form.plan}
            onChange={(e) => set({ plan: e.target.value })}
          >
            {packages
              .filter((p) => !p.hidden)
              .map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
          </Select>
        </div>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={form.trial}
            onChange={(e) => set({ trial: e.target.checked })}
          />
          {t('platform.newClient.trial')}
        </label>
        <p className={styles.muted}>{t('platform.newClient.menuNote')}</p>
        {problem && (
          <Banner tone="err" icon="alert" live="assertive">
            {problem}
          </Banner>
        )}
      </div>
    </Dialog>
  );
}
