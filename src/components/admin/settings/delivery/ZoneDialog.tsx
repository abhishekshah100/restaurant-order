'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Dialog, Input, Textarea } from '@/components/ui';
import { LIMITS, zoneErrors, type SettingsError } from '@/lib/branchSettings';
import type { DeliveryZone } from '@/types/branch';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { NumberField } from '../shared/NumberField';
import styles from './DeliveryZonesEditor.module.css';

/** A zone starts with this time to the door. */
const NEW_ETA = 40;

/** "Indiranagar, Domlur\nHAL 2nd Stage" → ["Indiranagar", "Domlur", "HAL 2nd Stage"]. */
const splitAreas = (text: string) =>
  text
    .split(/[\n,]/)
    .map((a) => a.trim())
    .filter(Boolean);

/** Which field each problem belongs to. */
const FIELD_OF: Partial<Record<SettingsError, 'name' | 'areas' | 'money' | 'freeAbove' | 'eta'>> = {
  zoneName: 'name',
  zoneNameTaken: 'name',
  noAreas: 'areas',
  areaName: 'areas',
  areaTaken: 'areas',
  money: 'money',
  freeAbove: 'freeAbove',
  eta: 'eta',
};

/**
 * Adding or changing a delivery zone: its name, the areas guests pick from (one per line or
 * separated by commas, none in another zone), the fee and from what item total it's free, the
 * minimum order, and the minutes to the door.
 */
export function ZoneDialog({
  zone,
  others,
  onClose,
  onSave,
}: {
  /** The zone to change; a new one when absent. */
  zone?: DeliveryZone;
  others: readonly DeliveryZone[];
  onClose: () => void;
  onSave: (zone: DeliveryZone) => void;
}) {
  const t = useContent('common');
  const { region } = useAdminWorkspace();
  const [name, setName] = useState(zone?.name ?? '');
  const [areas, setAreas] = useState(zone?.areas.join('\n') ?? '');
  const [fee, setFee] = useState<number | undefined>(zone?.fee ?? 0);
  const [freeAbove, setFreeAbove] = useState<number | undefined>(zone?.freeAbove);
  const [minOrder, setMinOrder] = useState<number | undefined>(zone?.minOrder ?? 0);
  const [eta, setEta] = useState<number | undefined>(zone?.etaMinutes ?? NEW_ETA);
  const [tried, setTried] = useState(false);

  const draft: DeliveryZone = {
    id: zone?.id ?? '',
    name,
    areas: splitAreas(areas),
    fee: fee ?? Number.NaN,
    ...(freeAbove !== undefined ? { freeAbove } : {}),
    minOrder: minOrder ?? Number.NaN,
    etaMinutes: eta ?? Number.NaN,
  };
  const errors = zoneErrors(draft, others);
  const errorFor = (field: NonNullable<(typeof FIELD_OF)[SettingsError]>, show = tried) => {
    const code = errors.find((e) => FIELD_OF[e] === field);
    return show && code ? t(`adminSettings.errors.${code}`) : undefined;
  };
  const symbol = region.currency.symbol;

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={
        zone
          ? t('adminSettings.zoneDialog.editTitle', { zone: zone.name })
          : t('adminSettings.zoneDialog.addTitle')
      }
      description={t('adminSettings.zoneDialog.description')}
      className={styles.dialog}
      footer={
        <Button
          block
          iconStart="check"
          onClick={() => {
            setTried(true);
            if (errors.length === 0) onSave(draft);
          }}
        >
          {zone ? t('adminSettings.zoneDialog.save') : t('adminSettings.zoneDialog.add')}
        </Button>
      }
    >
      <div className={styles.form}>
        <Input
          id="zone-name"
          label={t('adminSettings.zoneDialog.name')}
          placeholder={t('adminSettings.zoneDialog.namePlaceholder')}
          value={name}
          maxLength={LIMITS.zoneName + 10}
          error={errorFor('name')}
          onChange={(event) => setName(event.target.value)}
        />
        <Textarea
          id="zone-areas"
          label={t('adminSettings.zoneDialog.areas')}
          hint={t('adminSettings.zoneDialog.areasHint')}
          rows={4}
          value={areas}
          error={errorFor('areas', tried || errors.includes('areaTaken'))}
          onChange={(event) => setAreas(event.target.value)}
        />
        <div className={styles.row}>
          <NumberField
            id="zone-fee"
            label={t('adminSettings.zoneDialog.fee', { symbol })}
            hint={t('adminSettings.zoneDialog.feeHint')}
            value={fee}
            error={errorFor('money')}
            onChange={setFee}
          />
          <NumberField
            id="zone-free-above"
            optional
            label={t('adminSettings.zoneDialog.freeAbove', { symbol })}
            hint={t('adminSettings.zoneDialog.freeAboveHint')}
            value={freeAbove}
            error={errorFor('freeAbove')}
            onChange={setFreeAbove}
          />
          <NumberField
            id="zone-min-order"
            label={t('adminSettings.zoneDialog.minOrder', { symbol })}
            hint={t('adminSettings.zoneDialog.minOrderHint')}
            value={minOrder}
            onChange={setMinOrder}
          />
          <NumberField
            id="zone-eta"
            whole
            label={t('adminSettings.zoneDialog.eta')}
            hint={t('adminSettings.zoneDialog.etaHint')}
            value={eta}
            error={errorFor('eta')}
            onChange={setEta}
          />
        </div>
      </div>
    </Dialog>
  );
}
