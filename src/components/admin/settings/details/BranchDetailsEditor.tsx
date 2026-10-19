'use client';

import { useBranches, useContent } from '@/api/hooks';
import { Input, Textarea } from '@/components/ui';
import { LIMITS, detailsErrors, type SettingsError } from '@/lib/branchSettings';
import type { BranchDetails } from '@/types/branchSettings';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { FieldGrid, SettingsCard, SettingsEditor } from '../shared/SettingsEditor';
import styles from './BranchDetailsEditor.module.css';

/** Which field each problem belongs to, to show it there. */
const FIELD_OF: Partial<Record<SettingsError, keyof BranchDetails>> = {
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
  wifiLong: 'wifiName',
  tableLocationLong: 'tableLocation',
};

/**
 * Settings › Branch details: the branch's name, the short name staff and guests tell it apart
 * by, its city, address and phone, and what guests at the table are told (the Wi-Fi, where the
 * tables are). The region it was opened in (country, currency, time zone) is shown, not edited.
 */
export function BranchDetailsEditor() {
  const t = useContent('common');
  const { branch, region } = useAdminWorkspace();
  const others = useBranches()
    .filter((b) => b.id !== branch.id)
    .map((b) => b.shortName);
  const dialCode = region.mobile.dialCode;

  return (
    <SettingsEditor
      section="details"
      title={t('adminSettings.sections.details.title')}
      subtitle={t('adminSettings.details.subtitle')}
      check={(value) => detailsErrors(value, dialCode, others)}
    >
      {({ value, set, errors }) => {
        const errorFor = (field: keyof BranchDetails) => {
          const code = errors.find((e) => FIELD_OF[e] === field);
          return code ? t(`adminSettings.errors.${code}`, { dialCode }) : undefined;
        };
        const field = (key: keyof BranchDetails) => ({
          id: `branch-${key}`,
          value: value[key],
          error: errorFor(key),
          onChange: (event: { target: { value: string } }) =>
            set({ ...value, [key]: event.target.value }),
        });
        return (
          <>
            <SettingsCard
              title={t('adminSettings.details.about')}
              hint={t('adminSettings.details.aboutHint')}
            >
              <FieldGrid>
                <Input
                  {...field('name')}
                  label={t('adminSettings.details.name')}
                  maxLength={LIMITS.name + 10}
                  autoComplete="organization"
                />
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
                  autoComplete="address-level2"
                />
                <Input
                  {...field('phone')}
                  label={t('adminSettings.details.phone')}
                  hint={t('adminSettings.details.phoneHint', { dialCode })}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </FieldGrid>
              <Textarea
                {...field('address')}
                label={t('adminSettings.details.address')}
                hint={t('adminSettings.details.addressHint')}
                rows={2}
                maxLength={LIMITS.address + 20}
                autoComplete="street-address"
              />
            </SettingsCard>

            <SettingsCard
              title={t('adminSettings.details.guests')}
              hint={t('adminSettings.details.guestsHint')}
            >
              <FieldGrid>
                <Input
                  {...field('wifiName')}
                  label={t('adminSettings.details.wifiName')}
                  hint={t('adminSettings.details.wifiHint')}
                  optional
                  autoComplete="off"
                />
                <Input
                  {...field('tableLocation')}
                  label={t('adminSettings.details.tableLocation')}
                  hint={t('adminSettings.details.tableLocationHint')}
                  placeholder={t('adminSettings.details.tableLocationPlaceholder')}
                  optional
                  autoComplete="off"
                />
              </FieldGrid>
            </SettingsCard>

            <SettingsCard
              title={t('adminSettings.details.region')}
              hint={t('adminSettings.details.regionHint')}
            >
              <dl className={styles.facts}>
                <div>
                  <dt>{t('adminSettings.details.country')}</dt>
                  <dd>{t(`countryNames.${region.country}`)}</dd>
                </div>
                <div>
                  <dt>{t('adminSettings.details.currency')}</dt>
                  <dd>
                    {t('adminSettings.details.currencyValue', {
                      code: region.currency.code,
                      symbol: region.currency.symbol,
                    })}
                  </dd>
                </div>
                <div>
                  <dt>{t('adminSettings.details.timezone')}</dt>
                  <dd>{region.timezone}</dd>
                </div>
                <div>
                  <dt>{t('adminSettings.details.dialCode')}</dt>
                  <dd>{dialCode}</dd>
                </div>
              </dl>
            </SettingsCard>
          </>
        );
      }}
    </SettingsEditor>
  );
}
