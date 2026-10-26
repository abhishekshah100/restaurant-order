'use client';

import { useMemo } from 'react';
import { useBranches, useContent } from '@/api/hooks';
import { Input, Select, Textarea } from '@/components/ui';
import {
  COUNTRY_CODES,
  COUNTRY_DEFAULTS,
  CURRENCIES,
  CURRENCY_CODES,
  LOCALES,
  LOCALE_CODES,
  isMasterValue,
  isTimeZone,
  timeZonesWith,
} from '@/config/masters';
import { useNow } from '@/hooks/useNow';
import {
  LIMITS,
  detailsErrors,
  dialCodeOf,
  orderCodeOf,
  type SettingsError,
} from '@/lib/branchSettings';
import { createClock } from '@/lib/clock';
import { createMoney } from '@/lib/money';
import type { BranchDetails } from '@/types/branchSettings';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { FieldGrid, SettingsCard, SettingsEditor, SettingsNote } from '../shared/SettingsEditor';

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
  orderPrefix: 'orderPrefix',
  orderStart: 'orderStart',
  country: 'country',
  timezone: 'timezone',
  locale: 'locale',
  currency: 'currency',
};

/**
 * Settings › Branch details: the branch's name, the short name staff and guests tell it apart
 * by, its city, address and phone, and what guests at the table are told (the Wi-Fi, where the
 * tables are); how its orders are numbered (prefix and starting number, "BLR-001"); and its
 * region — country, time zone, locale and currency. Another country brings its phone rules,
 * taxes and payment methods on saving.
 */
export function BranchDetailsEditor() {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const others = useBranches()
    .filter((b) => b.id !== branch.id)
    .map((b) => b.shortName);

  return (
    <SettingsEditor
      section="details"
      title={t('adminSettings.sections.details.title')}
      subtitle={t('adminSettings.details.subtitle')}
      check={(value) => detailsErrors(value, others)}
      messageVars={(value) => ({ dialCode: dialCodeOf(value.country) })}
    >
      {({ value, saved, set, errors }) => {
        const dialCode = dialCodeOf(value.country);
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
              </FieldGrid>
            </SettingsCard>

            {value.orderPrefix !== undefined && value.orderStart !== undefined && (
              <SettingsCard
                title={t('adminSettings.details.orders')}
                hint={t('adminSettings.details.ordersHint')}
              >
                <FieldGrid>
                  <Input
                    id="branch-orderPrefix"
                    label={t('adminSettings.details.orderPrefix')}
                    hint={t('adminSettings.details.orderPrefixHint')}
                    value={value.orderPrefix}
                    error={errorFor('orderPrefix')}
                    maxLength={5}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) =>
                      set({
                        ...value,
                        orderPrefix: event.target.value.toUpperCase().replace(/[^A-Z]/g, ''),
                      })
                    }
                  />
                  <Input
                    id="branch-orderStart"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={LIMITS.orderStart}
                    step={1}
                    label={t('adminSettings.details.orderStart')}
                    hint={t('adminSettings.details.orderStartHint')}
                    value={Number.isNaN(value.orderStart) ? '' : value.orderStart}
                    error={errorFor('orderStart')}
                    onChange={(event) => set({ ...value, orderStart: event.target.valueAsNumber })}
                  />
                </FieldGrid>
                {value.orderPrefix && (
                  <p className="t-small c2">
                    {t('adminSettings.details.orderExample', {
                      example: orderCodeOf(value.orderPrefix, value.orderStart || 1),
                    })}
                  </p>
                )}
              </SettingsCard>
            )}

            <RegionCard value={value} saved={saved} set={set} errorFor={errorFor} />
          </>
        );
      }}
    </SettingsEditor>
  );
}

/** Where the branch is: country, time zone, locale and currency, with what changing them does. */
function RegionCard({
  value,
  saved,
  set,
  errorFor,
}: {
  value: BranchDetails;
  saved: BranchDetails;
  set: (next: BranchDetails) => void;
  errorFor: (field: keyof BranchDetails) => string | undefined;
}) {
  const t = useContent('common');
  const now = useNow(60_000);
  const zones = useMemo(
    () => timeZonesWith([COUNTRY_DEFAULTS[value.country].timezone]),
    [value.country],
  );
  const locale = isMasterValue('locales', value.locale) ? value.locale : null;
  const currency = isMasterValue('currencies', value.currency) ? value.currency : null;
  const localTime =
    now && locale && isTimeZone(value.timezone)
      ? createClock({ locale, timezone: value.timezone }).time(now)
      : '';
  const fallback: string | undefined = locale
    ? (LOCALES[locale] as { fallback?: string }).fallback
    : undefined;
  const example =
    locale && currency
      ? createMoney({
          locale,
          localeFallback: fallback,
          currency: { code: currency, ...CURRENCIES[currency] },
        }).format(1234.5)
      : '';

  return (
    <SettingsCard
      title={t('adminSettings.details.region')}
      hint={t('adminSettings.details.regionHint')}
    >
      <FieldGrid>
        <Select
          id="branch-country"
          label={t('adminSettings.details.country')}
          value={value.country}
          error={errorFor('country')}
          onChange={(event) => {
            const country = event.target.value as BranchDetails['country'];
            // A new country starts with its usual time zone, locale and currency.
            set({ ...value, country, ...COUNTRY_DEFAULTS[country] });
          }}
        >
          {COUNTRY_CODES.map((code) => (
            <option key={code} value={code}>
              {t(`countryNames.${code}`)}
            </option>
          ))}
        </Select>
        {/*
          A field to type in with suggestions, not a select: hundreds of zones in a native
          dropdown open over the field in Chrome, and letting go of the mouse picks whatever
          zone is under it.
        */}
        <Input
          id="branch-timezone"
          label={t('adminSettings.details.timezone')}
          hint={
            localTime
              ? t('adminSettings.details.timezoneHint', { time: localTime })
              : t('adminSettings.details.timezoneSearch')
          }
          list="branch-timezones"
          autoComplete="off"
          spellCheck={false}
          placeholder={COUNTRY_DEFAULTS[value.country].timezone}
          value={value.timezone}
          error={errorFor('timezone')}
          onChange={(event) => set({ ...value, timezone: event.target.value.trim() })}
        />
        <datalist id="branch-timezones">
          {zones.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
        <Select
          id="branch-locale"
          label={t('adminSettings.details.locale')}
          hint={example && t('adminSettings.details.localeHint', { example })}
          value={value.locale}
          error={errorFor('locale')}
          onChange={(event) => set({ ...value, locale: event.target.value })}
        >
          {LOCALE_CODES.map((code) => (
            <option key={code} value={code}>
              {t(`masters.locales.${code}`)}
            </option>
          ))}
        </Select>
        <Select
          id="branch-currency"
          label={t('adminSettings.details.currency')}
          value={value.currency}
          error={errorFor('currency')}
          onChange={(event) => set({ ...value, currency: event.target.value })}
        >
          {CURRENCY_CODES.map((code) => (
            <option key={code} value={code}>
              {t('adminSettings.details.currencyOption', {
                code,
                name: t(`masters.currencies.${code}`),
                symbol: CURRENCIES[code].symbol,
              })}
            </option>
          ))}
        </Select>
      </FieldGrid>
      {value.country !== saved.country && (
        <SettingsNote tone="warn">
          {t('adminSettings.details.countryChanged', {
            country: t(`countryNames.${value.country}`),
          })}
        </SettingsNote>
      )}
      {value.currency !== saved.currency && (
        <SettingsNote tone="warn">{t('adminSettings.details.currencyChanged')}</SettingsNote>
      )}
    </SettingsCard>
  );
}
