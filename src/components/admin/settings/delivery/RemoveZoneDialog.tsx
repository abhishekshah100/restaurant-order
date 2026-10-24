'use client';

import { useContent } from '@/api/hooks';
import { Button, Dialog } from '@/components/ui';
import type { DeliveryZone } from '@/types/branch';
import styles from './DeliveryZonesEditor.module.css';

/** "Remove <zone>?": the areas it covers stop getting deliveries; Keep or Remove. */
export function RemoveZoneDialog({
  zone,
  onClose,
  onConfirm,
}: {
  zone: DeliveryZone;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useContent('common');
  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminSettings.delivery.removeTitle', { zone: zone.name })}
      footer={
        <div className={styles.dialogFooter}>
          <Button variant="secondary" onClick={onClose}>
            {t('adminSettings.delivery.keepZone')}
          </Button>
          <Button iconStart="trash" onClick={onConfirm}>
            {t('adminSettings.delivery.confirmRemove')}
          </Button>
        </div>
      }
    >
      <p className={styles.dialogText}>
        {t('adminSettings.delivery.removeBody', { areas: zone.areas.join(', ') })}
      </p>
    </Dialog>
  );
}
