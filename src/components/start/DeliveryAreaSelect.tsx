'use client';

import { useContent } from '@/api/hooks';
import { Select } from '@/components/ui';
import { findZone } from '@/lib/fulfilment';
import { createMoney } from '@/lib/money';
import type { Branch } from '@/types/branch';

export interface DeliveryAreaSelectProps {
  id: string;
  branch: Branch;
  /** The chosen area ('' for none yet). */
  value: string;
  onChange: (area: string) => void;
  error?: string;
  /** Overrides the field label (default "Delivery area"). */
  label?: string;
  /** Show the chosen zone's fee and minimum under the field (default true). */
  showZone?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * The areas a branch delivers to, grouped by zone, with the chosen zone's fee and minimum
 * order underneath (GET /branches › modes.delivery.zones).
 */
export function DeliveryAreaSelect({
  id,
  branch,
  value,
  onChange,
  error,
  label,
  showZone = true,
  disabled,
  className,
}: DeliveryAreaSelectProps) {
  const t = useContent('home');
  const { zones } = branch.modes.delivery;
  const zone = value ? findZone(zones, value) : undefined;
  const money = createMoney(branch);
  return (
    <Select
      id={id}
      icon="pin"
      label={label ?? t('start.areaLabel')}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      required
      disabled={disabled}
      className={className}
      hint={
        zone && showZone
          ? t('start.areaHint', {
              zone: zone.name,
              fee: money.format(zone.fee),
              minimum: money.format(zone.minOrder),
            })
          : undefined
      }
    >
      <option value="" disabled>
        {t('start.areaPlaceholder')}
      </option>
      {zones.map((z) => (
        <optgroup key={z.id} label={z.name}>
          {z.areas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
