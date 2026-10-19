'use client';

import { useState } from 'react';
import { useBranches, useContent } from '@/api/hooks';
import { useCreateBranch } from '@/api/mutations';
import { Button, Dialog, Input, Select, Textarea } from '@/components/ui';
import { LIMITS, detailsErrors, type SettingsError } from '@/lib/branchSettings';
import type { AdminBranch } from '@/types/admin';
import type { BranchDetails } from '@/types/branchSettings';
import styles from './BranchesManager.module.css';

type Field = 'name' | 'shortName' | 'city' | 'address' | 'phone';

const FIELD_OF: Partial<Record<SettingsError, Field>> = {
  nameRequired: 'name',
  nameLong: 'name',
  shortNameRequired: 'shortName',
  shortNameLong: 'shortName',
  shortNameTaken: 'shortName',
  cityRequired: 'city',
  cityLong: 'city',
  addressRequired: 'address',
  addressLong: 'address',
  phoneInvalid: 'phone',
  phoneRegion: 'phone',
};

/**
 * Adding a branch: its name, short name, city, address and phone, and the branch it starts as a
 * copy of — the region (currency, time zone, phone rules), taxes, payment methods, hours,
 * delivery and pickup, menu, promotions and floor plan, all changeable in Settings afterwards.
 */
export function AddBranchDialog({
  branches,
  copyFrom: initialSource,
  onClose,
  onAdded,
}: {
  branches: readonly AdminBranch[];
  copyFrom: string;
  onClose: () => void;
  onAdded: (branch: AdminBranch) => void;
}) {
  const t = useContent('common');
  const all = useBranches();
  const create = useCreateBranch();
  const [copyFrom, setCopyFrom] = useState(initialSource);
  const source = all.find((b) => b.id === copyFrom);
  const dialCode = source?.mobile.dialCode ?? '';
  const [details, setDetails] = useState<BranchDetails>({
    name: '',
    shortName: '',
    city: source?.city ?? '',
    address: '',
    phone: dialCode,
    wifiName: '',
    tableLocation: '',
  });
  const [tried, setTried] = useState(false);

  const errors = detailsErrors(
    details,
    dialCode,
    all.map((b) => b.shortName),
  );
  const errorFor = (field: Field) => {
    const code = errors.find((e) => FIELD_OF[e] === field);
    return tried && code ? t(`adminSettings.errors.${code}`, { dialCode }) : undefined;
  };
  const field = (key: Field) => ({
    id: `new-branch-${key}`,
    value: details[key],
    error: errorFor(key),
    onChange: (event: { target: { value: string } }) =>
      setDetails({ ...details, [key]: event.target.value }),
  });

  const submit = () => {
    setTried(true);
    if (errors.length > 0) return;
    create.mutate({ details, copyFrom }, { onSuccess: onAdded });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminSettings.addBranch.title')}
      description={t('adminSettings.addBranch.description')}
      className={styles.dialog}
      footer={
        <Button block iconStart="plus" loading={create.isPending} onClick={submit}>
          {t('adminSettings.addBranch.add')}
        </Button>
      }
    >
      <div className={styles.form}>
        <Select
          id="new-branch-copy"
          label={t('adminSettings.addBranch.copyFrom')}
          hint={t('adminSettings.addBranch.copyFromHint')}
          value={copyFrom}
          onChange={(event) => {
            const next = all.find((b) => b.id === event.target.value);
            setCopyFrom(event.target.value);
            // The phone's dial code follows the region.
            if (next && details.phone.trim() === dialCode) {
              setDetails({ ...details, phone: next.mobile.dialCode });
            }
          }}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {t('adminSettings.addBranch.copyOption', { branch: b.shortName, city: b.city })}
            </option>
          ))}
        </Select>
        <Input
          {...field('name')}
          label={t('adminSettings.details.name')}
          placeholder={t('adminSettings.addBranch.namePlaceholder')}
          maxLength={LIMITS.name + 10}
          autoComplete="off"
        />
        <div className={styles.row}>
          <Input
            {...field('shortName')}
            label={t('adminSettings.details.shortName')}
            hint={t('adminSettings.details.shortNameHint')}
            maxLength={LIMITS.shortName + 10}
            autoComplete="off"
          />
          <Input
            {...field('city')}
            label={t('adminSettings.details.city')}
            maxLength={LIMITS.city + 10}
            autoComplete="off"
          />
        </div>
        <Textarea
          {...field('address')}
          label={t('adminSettings.details.address')}
          rows={2}
          maxLength={LIMITS.address + 20}
          autoComplete="off"
        />
        <Input
          {...field('phone')}
          label={t('adminSettings.details.phone')}
          hint={t('adminSettings.details.phoneHint', { dialCode })}
          type="tel"
          inputMode="tel"
          autoComplete="off"
        />
        {create.isError && (
          <p className={styles.refused} role="alert">
            {t('adminSettings.addBranch.failed')}
          </p>
        )}
      </div>
    </Dialog>
  );
}
