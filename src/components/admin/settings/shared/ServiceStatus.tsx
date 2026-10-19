'use client';

import Link from 'next/link';
import { useContent } from '@/api/hooks';
import { settingsHref } from '@/lib/adminSettings';
import type { OrderMode } from '@/types/branch';
import { SettingsNote } from './SettingsEditor';
import styles from './SettingsEditor.module.css';

/** Whether a service is on, on its own settings page; it's switched in Settings › Services. */
export function ServiceStatus({ mode, on }: { mode: OrderMode; on: boolean }) {
  const t = useContent('common');
  return (
    <SettingsNote tone={on ? 'info' : 'warn'}>
      {t('adminSettings.services.managedHere', {
        mode: t(`modes.${mode}`),
        state: on ? t('adminSettings.services.stateOn') : t('adminSettings.services.stateOff'),
      })}{' '}
      <Link href={settingsHref('services')} className={styles.noteLink}>
        {t('adminSettings.services.openServices')}
      </Link>
    </SettingsNote>
  );
}
