'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Dialog, IconButton } from '@/components/ui';
import { deliveryErrors, uniqueId, zoneErrors } from '@/lib/branchSettings';
import type { DeliveryZone } from '@/types/branch';
import type { DeliverySettings } from '@/types/branchSettings';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { NumberField } from '../shared/NumberField';
import { SettingsCard, SettingsEditor, SettingsNote, ToggleRow } from '../shared/SettingsEditor';
import { ZoneDialog } from './ZoneDialog';
import styles from './DeliveryZonesEditor.module.css';

type ZoneTarget = { mode: 'add' } | { mode: 'edit'; id: string };

/**
 * Settings › Delivery zones: whether the branch delivers, the kitchen time before the rider
 * leaves, how far it goes and whether the fee is taxed; and its zones — the areas each covers,
 * the fee (and from what item total it's free), the minimum order and the time to the door.
 */
export function DeliveryZonesEditor() {
  const t = useContent('common');

  return (
    <SettingsEditor
      section="delivery"
      title={t('adminSettings.sections.delivery.title')}
      subtitle={t('adminSettings.delivery.subtitle')}
      check={deliveryErrors}
    >
      {({ value, set, errors }) => <DeliveryForm value={value} set={set} errors={errors} />}
    </SettingsEditor>
  );
}

function DeliveryForm({
  value,
  set,
  errors,
}: {
  value: DeliverySettings;
  set: (next: DeliverySettings) => void;
  errors: readonly string[];
}) {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  const [target, setTarget] = useState<ZoneTarget | null>(null);
  const [removing, setRemoving] = useState<DeliveryZone | null>(null);
  const editing = target?.mode === 'edit' ? value.zones.find((z) => z.id === target.id) : undefined;

  const saveZone = (zone: DeliveryZone) => {
    if (target?.mode === 'edit') {
      set({ ...value, zones: value.zones.map((z) => (z.id === target.id ? zone : z)) });
    } else {
      const id = uniqueId(zone.name, new Set(value.zones.map((z) => z.id)), 'zone');
      set({ ...value, zones: [...value.zones, { ...zone, id }] });
    }
    setTarget(null);
  };

  return (
    <>
      <SettingsCard title={t('adminSettings.delivery.service')}>
        <ToggleRow
          id="delivery-on"
          label={t('adminSettings.delivery.enabled')}
          hint={
            value.enabled
              ? t('adminSettings.delivery.enabledOn')
              : t('adminSettings.delivery.enabledOff')
          }
          checked={value.enabled}
          onChange={(enabled) => set({ ...value, enabled })}
        />
        <div className={styles.rules}>
          <NumberField
            id="delivery-prep"
            whole
            label={t('adminSettings.delivery.prepMinutes')}
            hint={t('adminSettings.delivery.prepHint')}
            value={value.prepMinutes}
            error={
              errors.includes('prepMinutes') ? t('adminSettings.errors.prepMinutes') : undefined
            }
            onChange={(prepMinutes) => set({ ...value, prepMinutes: prepMinutes ?? Number.NaN })}
          />
          <NumberField
            id="delivery-distance"
            whole
            optional
            label={t('adminSettings.delivery.maxDistance')}
            hint={t('adminSettings.delivery.maxDistanceHint')}
            value={value.maxDistanceKm}
            error={errors.includes('distance') ? t('adminSettings.errors.distance') : undefined}
            onChange={(km) => {
              const { maxDistanceKm: _old, ...rest } = value;
              set(km === undefined ? rest : { ...rest, maxDistanceKm: km });
            }}
          />
        </div>
        <ToggleRow
          id="delivery-fee-taxed"
          label={t('adminSettings.delivery.feeTaxable')}
          hint={
            value.feeTaxable
              ? t('adminSettings.delivery.feeTaxableOn')
              : t('adminSettings.delivery.feeTaxableOff')
          }
          checked={value.feeTaxable}
          onChange={(feeTaxable) => set({ ...value, feeTaxable })}
        />
      </SettingsCard>

      <SettingsCard
        title={t('adminSettings.delivery.zones')}
        hint={t('adminSettings.delivery.zonesHint')}
        action={
          <Button size="sm" iconStart="plus" onClick={() => setTarget({ mode: 'add' })}>
            {t('adminSettings.delivery.addZone')}
          </Button>
        }
      >
        {value.zones.length === 0 ? (
          <SettingsNote tone={value.enabled ? 'warn' : 'info'}>
            {t('adminSettings.delivery.noZones')}
          </SettingsNote>
        ) : (
          <ol className={styles.zones}>
            {value.zones.map((zone, i) => {
              const problems = zoneErrors(
                zone,
                value.zones.filter((_, j) => j !== i),
              );
              return (
                <li key={zone.id} className={styles.zone}>
                  <div className={styles.zoneHead}>
                    <div className={styles.zoneText}>
                      <h3 className={styles.zoneName}>{zone.name}</h3>
                      <p className={styles.areas}>{zone.areas.join(' · ')}</p>
                    </div>
                    <div className={styles.zoneActions}>
                      <IconButton
                        icon="pencil"
                        variant="soft"
                        size="sm"
                        label={t('adminSettings.delivery.editZone', { zone: zone.name })}
                        onClick={() => setTarget({ mode: 'edit', id: zone.id })}
                      />
                      <IconButton
                        icon="trash"
                        variant="soft"
                        size="sm"
                        className={styles.remove}
                        label={t('adminSettings.delivery.removeZone', { zone: zone.name })}
                        onClick={() => setRemoving(zone)}
                      />
                    </div>
                  </div>
                  <dl className={styles.facts}>
                    <div>
                      <dt>{t('adminSettings.delivery.fee')}</dt>
                      <dd>
                        {zone.fee === 0 ? t('adminSettings.delivery.free') : money.format(zone.fee)}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('adminSettings.delivery.freeAbove')}</dt>
                      <dd>
                        {zone.freeAbove === undefined
                          ? t('adminSettings.delivery.never')
                          : money.format(zone.freeAbove)}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('adminSettings.delivery.minOrder')}</dt>
                      <dd>
                        {zone.minOrder === 0
                          ? t('adminSettings.delivery.noMinimum')
                          : money.format(zone.minOrder)}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('adminSettings.delivery.eta')}</dt>
                      <dd>{t('adminSettings.delivery.minutes', { minutes: zone.etaMinutes })}</dd>
                    </div>
                  </dl>
                  {problems.length > 0 && (
                    <p className={styles.problem} role="alert">
                      {t(`adminSettings.errors.${problems[0]}`)}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </SettingsCard>

      {target && (
        <ZoneDialog
          key={target.mode === 'edit' ? target.id : 'new'}
          zone={editing}
          others={value.zones.filter((z) => z.id !== editing?.id)}
          onClose={() => setTarget(null)}
          onSave={saveZone}
        />
      )}
      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        presentation="adaptive"
        title={t('adminSettings.delivery.removeTitle', { zone: removing?.name ?? '' })}
        footer={
          <div className={styles.dialogFooter}>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              {t('adminSettings.delivery.keepZone')}
            </Button>
            <Button
              iconStart="trash"
              onClick={() => {
                if (removing)
                  set({ ...value, zones: value.zones.filter((z) => z.id !== removing.id) });
                setRemoving(null);
              }}
            >
              {t('adminSettings.delivery.confirmRemove')}
            </Button>
          </div>
        }
      >
        <p className={styles.dialogText}>
          {t('adminSettings.delivery.removeBody', { areas: removing?.areas.join(', ') ?? '' })}
        </p>
      </Dialog>
    </>
  );
}
