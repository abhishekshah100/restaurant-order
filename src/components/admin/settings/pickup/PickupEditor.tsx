'use client';

import { useContent } from '@/api/hooks';
import { Chip } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { SLOT_MINUTES, pickupErrors, withPickup } from '@/lib/branchSettings';
import { pickupOptions } from '@/lib/fulfilment';
import type { PickupSettings } from '@/types/branchSettings';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { NumberField } from '../shared/NumberField';
import { SettingsCard, SettingsEditor, ToggleRow } from '../shared/SettingsEditor';
import { ServiceStatus } from '../shared/ServiceStatus';
import styles from './PickupEditor.module.css';

/** The preview lists this many of today's slots. */
const PREVIEW_SLOTS = 8;

/**
 * Settings › Pickup: whether guests can order takeaway, how long the kitchen needs, the time
 * between pickup slots (counted from opening), "as soon as possible" on or off, and the
 * smallest order taken. A preview shows the times a guest ordering now would see today.
 */
export function PickupEditor() {
  const t = useContent('common');
  const { region } = useAdminWorkspace();

  return (
    <SettingsEditor
      section="pickup"
      title={t('adminSettings.sections.pickup.title')}
      subtitle={t('adminSettings.pickup.subtitle')}
      check={pickupErrors}
    >
      {({ value, set, errors }) => (
        <>
          <ServiceStatus mode="takeaway" on={value.enabled} />
          <SettingsCard title={t('adminSettings.pickup.service')}>
            <div className={styles.rules}>
              <NumberField
                id="pickup-prep"
                whole
                label={t('adminSettings.pickup.prepMinutes')}
                hint={t('adminSettings.pickup.prepHint')}
                value={value.prepMinutes}
                error={
                  errors.includes('prepMinutes') ? t('adminSettings.errors.prepMinutes') : undefined
                }
                onChange={(m) => set({ ...value, prepMinutes: m ?? Number.NaN })}
              />
              <NumberField
                id="pickup-min-order"
                label={t('adminSettings.pickup.minOrder', { symbol: region.currency.symbol })}
                hint={t('adminSettings.pickup.minOrderHint')}
                value={value.minOrder}
                error={errors.includes('money') ? t('adminSettings.errors.money') : undefined}
                onChange={(m) => set({ ...value, minOrder: m ?? 0 })}
              />
            </div>
          </SettingsCard>

          <SettingsCard
            title={t('adminSettings.pickup.slots')}
            hint={t('adminSettings.pickup.slotsHint')}
          >
            <div
              className={styles.slotChoice}
              role="radiogroup"
              aria-label={t('adminSettings.pickup.every')}
            >
              {SLOT_MINUTES.map((m) => (
                <Chip
                  key={m}
                  role="radio"
                  pressed={value.slotMinutes === m}
                  onClick={() => set({ ...value, slotMinutes: m })}
                >
                  {t('adminSettings.pickup.minutes', { minutes: m })}
                </Chip>
              ))}
            </div>
            <ToggleRow
              id="pickup-asap"
              label={t('adminSettings.pickup.asap')}
              hint={
                value.asap ? t('adminSettings.pickup.asapOn') : t('adminSettings.pickup.asapOff')
              }
              checked={value.asap}
              onChange={(asap) => set({ ...value, asap })}
            />
          </SettingsCard>

          {errors.length === 0 && value.enabled && <SlotPreview value={value} />}
        </>
      )}
    </SettingsEditor>
  );
}

/** Today's pickup times for a guest ordering now, under the draft. */
function SlotPreview({ value }: { value: PickupSettings }) {
  const t = useContent('common');
  const { region, clock } = useAdminWorkspace();
  const now = useNow(60_000);
  if (!now) return null;
  const { asap, slots } = pickupOptions(withPickup(region, value), now);
  const shown = slots.slice(0, PREVIEW_SLOTS);
  return (
    <SettingsCard
      title={t('adminSettings.pickup.preview')}
      hint={t('adminSettings.pickup.previewHint', { hours: region.hoursToday })}
    >
      {asap || shown.length > 0 ? (
        <ul className={styles.preview}>
          {asap && (
            <li className={styles.asap}>
              {t('adminSettings.pickup.asapAt', { time: clock.time(asap) })}
            </li>
          )}
          {shown.map((slot) => (
            <li key={slot.getTime()}>{clock.time(slot)}</li>
          ))}
          {slots.length > shown.length && (
            <li className={styles.more}>
              {t('adminSettings.pickup.more', { count: slots.length - shown.length })}
            </li>
          )}
        </ul>
      ) : (
        <p className={styles.none}>{t('adminSettings.pickup.noneToday')}</p>
      )}
    </SettingsCard>
  );
}
