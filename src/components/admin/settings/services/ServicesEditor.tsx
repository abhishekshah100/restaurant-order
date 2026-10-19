'use client';

import { useContent } from '@/api/hooks';
import { Button } from '@/components/ui';
import { settingsHref } from '@/lib/adminSettings';
import { servicesErrors } from '@/lib/branchSettings';
import { ORDER_MODES } from '@/lib/fulfilment';
import type { OrderMode } from '@/types/branch';
import { SettingsCard, SettingsEditor, ToggleRow } from '../shared/SettingsEditor';
import styles from './ServicesEditor.module.css';

/** Where each service is set up in more detail (dine-in: the floor plan). */
const SETUP = {
  dineIn: settingsHref('floorPlan'),
  takeaway: settingsHref('pickup'),
  delivery: settingsHref('delivery'),
} satisfies Record<OrderMode, string>;

/**
 * Settings › Services: which ways guests can order at the branch — dine-in (table QR codes and
 * waiters' table orders), takeaway and delivery — at least one of them, and delivery only with
 * a zone to deliver to. Guests see only those that are on.
 */
export function ServicesEditor() {
  const t = useContent('common');

  return (
    <SettingsEditor
      section="services"
      title={t('adminSettings.sections.services.title')}
      subtitle={t('adminSettings.services.subtitle')}
      check={(value, data) => servicesErrors(value, data.settings.delivery.zones.length)}
    >
      {({ value, set }) => (
        <SettingsCard
          title={t('adminSettings.services.card')}
          hint={t('adminSettings.services.cardHint')}
        >
          <ul className={styles.services}>
            {ORDER_MODES.map((mode) => (
              <li key={mode} className={styles.service}>
                <ToggleRow
                  id={`service-${mode}`}
                  label={t(`adminSettings.services.${mode}.label`)}
                  hint={
                    value[mode]
                      ? t(`adminSettings.services.${mode}.on`)
                      : t(`adminSettings.services.${mode}.off`)
                  }
                  checked={value[mode]}
                  onChange={(on) => set({ ...value, [mode]: on })}
                />
                <Button variant="ghost" size="sm" iconEnd="chev" href={SETUP[mode]}>
                  {t('adminSettings.services.configure', { mode: t(`modes.${mode}`) })}
                </Button>
              </li>
            ))}
          </ul>
        </SettingsCard>
      )}
    </SettingsEditor>
  );
}
