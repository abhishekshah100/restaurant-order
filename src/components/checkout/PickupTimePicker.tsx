'use client';

import { useBranch, useContent, useRegion } from '@/api/hooks';
import { Icon, OptionGroup, Select } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { pickupOptions } from '@/lib/fulfilment';
import styles from './FulfilmentFields.module.css';

export interface PickupTimePickerProps {
  /** The chosen slot (ISO), or null for as soon as possible. */
  value: string | null;
  onChange: (pickupAt: string | null) => void;
}

const LATER = 'later';
const ASAP = 'asap';

/**
 * Takeaway: collect as soon as possible (ready in the branch's prep time) or at a slot later
 * today, in the branch's time zone. Slots run every `slotMinutes` until closing.
 */
export function PickupTimePicker({ value, onChange }: PickupTimePickerProps) {
  const branch = useBranch();
  const { clock } = useRegion();
  const t = useContent('checkout');
  const now = useNow(60_000);
  if (!now) return null;
  const { asap, slots } = pickupOptions(branch, now);
  const slot = slots.find((s) => s.toISOString() === value);
  const choice = value === null && asap ? ASAP : LATER;

  return (
    <section className={styles.section} aria-labelledby="pickup-title">
      <OptionGroup
        id="pickup"
        type="radio"
        title={t('details.pickup.title')}
        headingAs="h2"
        titleClassName={styles.title}
        value={choice}
        onChange={(id) => onChange(id === ASAP ? null : (slots[0]?.toISOString() ?? null))}
        choices={[
          {
            id: ASAP,
            label: t('details.pickup.asap'),
            sub: asap ? t('details.pickup.asapSub', { time: clock.time(asap) }) : t('details.pickup.noAsap'),
            disabled: !asap,
          },
          {
            id: LATER,
            label: t('details.pickup.later'),
            sub: slots.length > 0 ? t('details.pickup.laterSub') : t('details.pickup.noSlots'),
            disabled: slots.length === 0,
          },
        ]}
      />
      {choice === LATER && slots.length > 0 && (
        <Select
          id="pickup-slot"
          icon="clock"
          label={t('details.pickup.slotLabel')}
          value={(slot ?? slots[0]).toISOString()}
          onChange={(event) => onChange(event.target.value)}
        >
          {slots.map((s) => (
            <option key={s.toISOString()} value={s.toISOString()}>
              {clock.time(s)}
            </option>
          ))}
        </Select>
      )}
      <p className={styles.note}>
        <Icon name="store" size="xs" />
        {t('details.pickup.where', { branch: branch.shortName, address: branch.address })}
      </p>
    </section>
  );
}
