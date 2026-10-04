'use client';

import type { KeyboardEvent } from 'react';
import { useBranch, useContent } from '@/api/hooks';
import { Chip, Input, OptionGroup } from '@/components/ui';
import { DeliveryAreaSelect } from '@/components/start/DeliveryAreaSelect';
import { ADDRESS_FIELD_MAX, ADDRESS_LABELS, addressText, type AddressError } from '@/lib/addresses';
import type { AddressLabel, DeliveryAddress } from '@/types/order';
import styles from './FulfilmentFields.module.css';

export interface AddressFormProps {
  /** The address being entered (or a saved one, picked). */
  value: DeliveryAddress;
  onChange: (address: DeliveryAddress) => void;
  /** Addresses remembered on this device for this branch, newest first. */
  saved: readonly DeliveryAddress[];
  /** Index of the saved address in use, or null for a new one. */
  savedIndex: number | null;
  onPickSaved: (index: number | null) => void;
  errors: { line?: AddressError; area?: AddressError };
}

const NEW = 'new';

/**
 * Delivery: pick an address saved on this device, or enter one — house and street, the area
 * (from the branch's zones, which sets the fee), a landmark, instructions for the rider and a
 * label (Home, Work, Other).
 */
export function AddressForm({
  value,
  onChange,
  saved,
  savedIndex,
  onPickSaved,
  errors,
}: AddressFormProps) {
  const branch = useBranch();
  const t = useContent('checkout');
  const set = (patch: Partial<DeliveryAddress>) => onChange({ ...value, ...patch });

  const moveLabel = (index: number, event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = ['ArrowRight', 'ArrowDown'].includes(event.key)
      ? 1
      : ['ArrowLeft', 'ArrowUp'].includes(event.key)
        ? -1
        : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = ADDRESS_LABELS[(index + delta + ADDRESS_LABELS.length) % ADDRESS_LABELS.length];
    set({ label: next });
    document.getElementById(`address-label-${next}`)?.focus();
  };

  return (
    <section className={styles.section} aria-labelledby="address-title">
      {saved.length > 0 ? (
        <OptionGroup
          id="address"
          type="radio"
          title={t('details.address.title')}
          hint={t('details.address.saved')}
          headingAs="h2"
          titleClassName={styles.title}
          value={savedIndex === null ? NEW : String(savedIndex)}
          onChange={(id) => onPickSaved(id === NEW ? null : Number(id))}
          choices={[
            ...saved.map((address, i) => ({
              id: String(i),
              label: t(`details.address.labels.${address.label}`),
              sub: addressText(address),
            })),
            { id: NEW, label: t('details.address.useNew') },
          ]}
        />
      ) : (
        <h2 id="address-title" className={styles.title}>
          {t('details.address.title')}
        </h2>
      )}

      {savedIndex === null && (
        <div className={styles.fields}>
          <Input
            id="address-line"
            icon="pin"
            label={t('details.address.line')}
            placeholder={t('details.address.linePlaceholder')}
            autoComplete="street-address"
            maxLength={ADDRESS_FIELD_MAX}
            value={value.line}
            onChange={(event) => set({ line: event.target.value })}
            error={errors.line ? t(`details.address.errors.${errors.line}`) : undefined}
            required
          />
          <DeliveryAreaSelect
            id="address-area"
            branch={branch}
            label={t('details.address.area')}
            value={value.area}
            onChange={(area) => set({ area })}
            error={errors.area ? t(`details.address.errors.${errors.area}`) : undefined}
          />
          <Input
            id="address-landmark"
            label={t('details.address.landmark')}
            optional
            placeholder={t('details.address.landmarkPlaceholder')}
            maxLength={ADDRESS_FIELD_MAX}
            value={value.landmark ?? ''}
            onChange={(event) => set({ landmark: event.target.value })}
          />
          <Input
            id="address-instructions"
            label={t('details.address.instructions')}
            optional
            placeholder={t('details.address.instructionsPlaceholder')}
            maxLength={ADDRESS_FIELD_MAX}
            value={value.instructions ?? ''}
            onChange={(event) => set({ instructions: event.target.value })}
          />
          <div className={styles.labels}>
            <span id="address-label-title" className={styles.labelTitle}>
              {t('details.address.labelTitle')}
            </span>
            <div className={styles.chips} role="radiogroup" aria-labelledby="address-label-title">
              {ADDRESS_LABELS.map((label: AddressLabel, i) => (
                <Chip
                  key={label}
                  id={`address-label-${label}`}
                  role="radio"
                  pressed={value.label === label}
                  tabIndex={value.label === label ? 0 : -1}
                  onClick={() => set({ label })}
                  onKeyDown={(event) => moveLabel(i, event)}
                >
                  {t(`details.address.labels.${label}`)}
                </Chip>
              ))}
            </div>
            <p className={styles.note}>{t('details.address.remember')}</p>
          </div>
        </div>
      )}
    </section>
  );
}
