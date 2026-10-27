'use client';

import { useContent } from '@/api/hooks';
import { Input, Select } from '@/components/ui';
import { formatRate, calculateBill } from '@/lib/pricing';
import { splitRate, taxErrors, taxWording, withTax } from '@/lib/branchSettings';
import type { TaxLineSettings, TaxSettings } from '@/types/branchSettings';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { NumberField } from '../shared/NumberField';
import { SettingsCard, SettingsEditor, SettingsNote, ToggleRow } from '../shared/SettingsEditor';
import styles from './TaxEditor.module.css';

/** The service charge a branch starts with when staff switch it on. */
const DEFAULT_SERVICE_BP = 500;

/** The example bill's item total, in major units. */
const EXAMPLE_ITEMS = 1000;

/** Basis points as a percentage to type (250 → 2.5), and back. */
const toPercent = (bp: number | null) => (bp === null || Number.isNaN(bp) ? undefined : bp / 100);
const toBp = (percent: number | undefined) =>
  percent === undefined ? Number.NaN : Math.round(percent * 100);

/**
 * Settings › Tax & service charge: whether the branch charges tax (GST in India, VAT in Nepal;
 * a branch not registered bills without it, as a "Bill of supply" or a "Bill") and the GSTIN or
 * PAN printed on bills; the rate of each of the region's taxes (and what it's charged on), a
 * service charge or none, whether discounts come off before tax, and rounding the total. An
 * example bill shows the result. New bills use them; placed orders keep theirs.
 */
export function TaxEditor() {
  const t = useContent('common');
  const cart = useContent('cart');
  const service = useContent('service');
  const { region } = useAdminWorkspace();

  return (
    <SettingsEditor
      section="tax"
      title={t('adminSettings.sections.tax.title')}
      subtitle={t('adminSettings.tax.subtitle')}
      check={(value, data) => taxErrors(value, data.settings.tax, data.settings.details.country)}
    >
      {({ value, set, saved, errors }) => {
        // "GST" in India, "VAT" in Nepal: the region's first tax names the switch.
        const first = value.lines[0]?.labelKey;
        const taxName = t(
          `adminSettings.tax.taxNames.${first === 'gst' || first === 'vat' ? first : 'tax'}`,
        );
        const wording = taxWording(region.country, value);
        const setLine = (index: number, next: Partial<TaxLineSettings>) =>
          set({
            ...value,
            lines: value.lines.map((l, i) => (i === index ? { ...l, ...next } : l)),
          });
        const lineName = (line: TaxLineSettings) =>
          cart(`priceSummary.lines.${line.labelKey}`, {
            rate: Number.isNaN(line.rateBp) ? '–' : formatRate(line.rateBp),
          });
        const serviceOn = value.serviceChargeBp !== null;

        return (
          <>
            <SettingsCard
              title={t('adminSettings.tax.charge', { tax: taxName })}
              hint={t('adminSettings.tax.chargeHint', { tax: taxName })}
            >
              <ToggleRow
                id="tax-enabled"
                label={t('adminSettings.tax.charge', { tax: taxName })}
                hint={
                  value.enabled
                    ? t('adminSettings.tax.chargeOn', { tax: taxName })
                    : t('adminSettings.tax.chargeOff', {
                        tax: taxName,
                        title: service(`region.taxInvoice.${wording.invoiceKey}`),
                      })
                }
                checked={value.enabled}
                onChange={(on) => set({ ...value, enabled: on })}
              />
              <Input
                id="tax-id"
                label={t(`adminSettings.tax.taxIds.${wording.taxIdKey}`)}
                hint={t(`adminSettings.tax.taxIdHints.${wording.taxIdKey}`)}
                value={value.taxId}
                optional
                autoComplete="off"
                spellCheck={false}
                maxLength={24}
                className={styles.taxId}
                error={errors.includes('taxId') ? t('adminSettings.errors.taxId') : undefined}
                onChange={(event) => set({ ...value, taxId: event.target.value.toUpperCase() })}
              />
            </SettingsCard>

            {value.enabled && (
              <SettingsCard
                title={t('adminSettings.tax.taxes')}
                hint={t('adminSettings.tax.taxesHint')}
              >
                <ul className={styles.lines}>
                  {value.lines.map((line, i) => {
                    const bad =
                      !Number.isInteger(line.rateBp) || line.rateBp < 0 || line.rateBp > 5000;
                    const parts =
                      line.parts && !bad
                        ? splitRate(line.rateBp, line.parts.length)
                            .map((rate, j) =>
                              cart(`priceSummary.lines.${line.parts![j].labelKey}`, {
                                rate: formatRate(rate),
                              }),
                            )
                            .join(' + ')
                        : undefined;
                    return (
                      <li key={line.id} className={styles.line}>
                        <p className={styles.lineName}>{lineName(line)}</p>
                        <NumberField
                          id={`tax-${line.id}`}
                          label={t('adminSettings.tax.rate')}
                          value={toPercent(line.rateBp)}
                          error={bad ? t('adminSettings.errors.taxRate') : undefined}
                          hint={parts && t('adminSettings.tax.parts', { parts })}
                          onChange={(percent) => setLine(i, { rateBp: toBp(percent) })}
                        />
                        {serviceOn && (
                          <Select
                            id={`tax-${line.id}-base`}
                            label={t('adminSettings.tax.base')}
                            value={line.base}
                            onChange={(event) =>
                              setLine(i, { base: event.target.value as TaxLineSettings['base'] })
                            }
                          >
                            <option value="items">{t('adminSettings.tax.baseItems')}</option>
                            <option value="itemsPlusService">
                              {t('adminSettings.tax.baseItemsPlusService')}
                            </option>
                          </Select>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </SettingsCard>
            )}

            <SettingsCard
              title={t('adminSettings.tax.service')}
              hint={t('adminSettings.tax.serviceHint')}
            >
              <ToggleRow
                id="service-charge"
                label={t('adminSettings.tax.serviceOn')}
                hint={
                  serviceOn
                    ? t('adminSettings.tax.serviceOnHint')
                    : t('adminSettings.tax.serviceOffHint')
                }
                checked={serviceOn}
                onChange={(on) =>
                  set({
                    ...value,
                    serviceChargeBp: on ? (saved.serviceChargeBp ?? DEFAULT_SERVICE_BP) : null,
                  })
                }
              />
              {serviceOn && (
                <NumberField
                  id="service-rate"
                  label={t('adminSettings.tax.rate')}
                  value={toPercent(value.serviceChargeBp)}
                  error={
                    errors.includes('serviceRate')
                      ? t('adminSettings.errors.serviceRate')
                      : undefined
                  }
                  className={styles.narrow}
                  onChange={(percent) => set({ ...value, serviceChargeBp: toBp(percent) })}
                />
              )}
            </SettingsCard>

            <SettingsCard title={t('adminSettings.tax.bill')}>
              <ToggleRow
                id="discount-before-tax"
                label={t('adminSettings.tax.discountBeforeTax')}
                hint={
                  value.discountBeforeTax
                    ? t('adminSettings.tax.discountBeforeTaxOn')
                    : t('adminSettings.tax.discountBeforeTaxOff')
                }
                checked={value.discountBeforeTax}
                onChange={(on) => set({ ...value, discountBeforeTax: on })}
              />
              <ToggleRow
                id="round-total"
                label={t('adminSettings.tax.roundTotal', { symbol: region.currency.symbol })}
                hint={
                  value.roundTotal
                    ? t('adminSettings.tax.roundTotalOn')
                    : t('adminSettings.tax.roundTotalOff')
                }
                checked={value.roundTotal}
                onChange={(on) => set({ ...value, roundTotal: on })}
              />
            </SettingsCard>

            {errors.length === 0 && <ExampleBill value={value} />}
            <SettingsNote>{t('adminSettings.tax.note')}</SettingsNote>
          </>
        );
      }}
    </SettingsEditor>
  );
}

/** A bill for an example item total under the draft's rules, line by line. */
function ExampleBill({ value }: { value: TaxSettings }) {
  const t = useContent('common');
  const cart = useContent('cart');
  const { region, money } = useAdminWorkspace();
  const rules = withTax(region, value);
  const bill = calculateBill([{ unitPrice: EXAMPLE_ITEMS, quantity: 1 }], rules);
  const rows: [string, string][] = [
    [cart('priceSummary.itemTotal'), money.formatMinor(bill.itemTotalMinor)],
    ...bill.lines.flatMap((line) =>
      (line.parts ?? [line]).map((l): [string, string] => [
        cart(`priceSummary.lines.${l.labelKey}`, l.vars),
        money.formatMinor(l.amountMinor),
      ]),
    ),
    ...(bill.showRoundOff
      ? [
          [cart('priceSummary.roundOff'), money.formatSignedMinor(bill.roundOffMinor)] as [
            string,
            string,
          ],
        ]
      : []),
  ];
  return (
    <SettingsCard
      title={t('adminSettings.tax.example')}
      hint={t('adminSettings.tax.exampleHint', { amount: money.format(EXAMPLE_ITEMS) })}
    >
      <dl className={styles.bill}>
        {rows.map(([label, amount]) => (
          <div key={label} className={styles.row}>
            <dt>{label}</dt>
            <dd>{amount}</dd>
          </div>
        ))}
        <div className={styles.total}>
          <dt>{cart('priceSummary.toPay')}</dt>
          <dd>{money.formatMinor(bill.totalMinor)}</dd>
        </div>
      </dl>
    </SettingsCard>
  );
}
