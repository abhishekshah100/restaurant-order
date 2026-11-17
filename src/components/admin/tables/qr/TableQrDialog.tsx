'use client';

import { useContent, useTableQrCode } from '@/api/hooks';
import { Button, Dialog } from '@/components/ui';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { usePrintSheet } from './PrintSheet';
import { QrCard } from './QrCard';
import { useOrigin } from './useOrigin';
import { useQrDownload } from './useQrDownload';
import styles from './TableQrCodes.module.css';

/**
 * One table's QR card, to print or download, from the table's page: for staff who may show it
 * (`tables.qr`, a waiter replacing a torn sticker) or manage tables. Read on its own
 * (GET …/tables/:table/qr, audited), so showing one never hands out every table's link.
 */
export function TableQrDialog({ table, onClose }: { table: number; onClose: () => void }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const qr = useTableQrCode(branch.id, table);
  const origin = useOrigin();
  const code = qr.data;
  const { print, sheet } = usePrintSheet(origin);
  const download = useQrDownload(origin);

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminQr.dialogTitle', { table })}
      description={t('adminQr.dialogHint')}
      footer={
        code && (
          <div className={styles.dialogActions}>
            <Button
              variant="secondary"
              size="sm"
              iconStart="arrow"
              onClick={() => void download(code)}
            >
              {t('adminQr.download')}
            </Button>
            <Button size="sm" iconStart="check" onClick={() => print([code])}>
              {t('adminQr.print')}
            </Button>
          </div>
        )
      }
    >
      <div className={styles.dialogBody}>
        {code && origin ? (
          <QrCard code={code} origin={origin} showLink className={styles.dialogCard} />
        ) : qr.isError ? (
          <p className={styles.dialogError} role="alert">
            {t('adminQr.oneFailed')}
          </p>
        ) : (
          <div className={styles.skeleton} role="status" aria-label={t('adminQr.loading')} />
        )}
      </div>
      {sheet}
    </Dialog>
  );
}
