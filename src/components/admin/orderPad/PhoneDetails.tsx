'use client';

import { useContent } from '@/api/hooks';
import { Input, OptionGroup, PhoneInput } from '@/components/ui';
import { AddressFields } from '../../checkout/AddressForm';
import { PickupTimeFields } from '../../checkout/PickupTimePicker';
import type { PhoneDraft, PhoneDraftErrors, PhoneMode } from '@/lib/orderPad';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './OrderPad.module.css';

const LATER = 'later';
const NOW = 'now';

/**
 * Who called and how it reaches them, on a phone order's review: their name and mobile, the
 * pickup time (takeaway) or the address in an area the branch delivers to (delivery, which sets
 * the fee), and whether they pay at pickup / to the rider or now (the payment opens next).
 * Errors show once staff try to send.
 */
export function PhoneDetails({
  mode,
  value,
  onChange,
  errors,
  canCollect,
}: {
  mode: PhoneMode;
  value: PhoneDraft;
  onChange: (draft: PhoneDraft) => void;
  /** Shown after a first try to send. */
  errors: PhoneDraftErrors;
  /** May take payments: "Paid now" is offered. */
  canCollect: boolean;
}) {
  const t = useContent('common');
  const checkout = useContent('checkout');
  const { region, clock } = useAdminWorkspace();
  const set = (patch: Partial<PhoneDraft>) => onChange({ ...value, ...patch });

  return (
    <div className={styles.phone}>
      <div className={styles.customer}>
        <Input
          id="phone-name"
          label={t('adminOrderPad.phone.name')}
          autoComplete="off"
          maxLength={60}
          value={value.name}
          error={errors.name && t('adminOrderPad.phone.errors.nameRequired')}
          onChange={(event) => set({ name: event.target.value })}
        />
        <PhoneInput
          id="phone-number"
          label={t('adminOrderPad.phone.number')}
          rules={region.mobile}
          value={value.phone}
          showCountryCode={region.mobile.showDialCode}
          error={
            errors.phone === 'phoneLength'
              ? checkout('details.errors.phoneLength', { length: region.mobile.length })
              : errors.phone === 'phonePrefix'
                ? checkout(`details.errors.phonePrefix.${region.country}`)
                : undefined
          }
          onChange={(phone) => set({ phone })}
        />
      </div>

      {mode === 'takeaway' ? (
        <>
          <PickupTimeFields
            branch={region}
            clock={clock}
            value={value.pickupAt}
            onChange={(pickupAt) => set({ pickupAt })}
          />
          {errors.pickup && (
            <p className={styles.removed} role="alert">
              {t('adminOrderPad.phone.errors.noPickup')}
            </p>
          )}
        </>
      ) : (
        <AddressFields
          branch={region}
          value={value.address}
          onChange={(address) => set({ address })}
          saved={[]}
          remembers={false}
          savedIndex={null}
          onPickSaved={() => {}}
          errors={{
            ...(errors.line ? { line: errors.line } : {}),
            ...(errors.area ? { area: errors.area } : {}),
          }}
        />
      )}

      <OptionGroup
        id="phone-payment"
        type="radio"
        title={t('adminOrderPad.phone.payment')}
        headingAs="h3"
        titleClassName={styles.phoneTitle}
        value={value.paidNow ? NOW : LATER}
        onChange={(id) => set({ paidNow: id === NOW })}
        choices={[
          {
            id: LATER,
            label: t(`adminOrderPad.phone.later.${mode}`),
            sub: t(`adminOrderPad.phone.laterSub.${mode}`),
          },
          ...(canCollect
            ? [
                {
                  id: NOW,
                  label: t('adminOrderPad.phone.now'),
                  sub: t('adminOrderPad.phone.nowSub'),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
