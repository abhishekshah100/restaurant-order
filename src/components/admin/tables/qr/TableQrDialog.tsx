'use client';

import { useContent, useTableQrCodes } from '@/api/hooks';
import { Button, Dialog } from '@/components/ui';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { usePrintSheet } from './PrintSheet';
import { QrCard } from './QrCard';
import { useOrigin } from './useOrigin';
import { useQrDownload } from './useQrDownload';
import styles from './TableQrCodes.module.css';

/** One table's QR card, to print or download, from the table's page. */
export function TableQrDialog({ table, onClose }: { table: number; onClose: () => void }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const codes = useTableQrCodes(branch.id);
  const origin = useOrigin();
  const code = codes.data?.codes.find((c) => c.table === table);
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
            <Button variant="secondary" iconStart="arrow" onClick={() => void download(code)}>
              {t('adminQr.download')}
            </Button>
            <Button iconStart="check" onClick={() => print([code])}>
              {t('adminQr.print')}
            </Button>
          </div>
        )
      }
    >
      <div className={styles.dialogBody}>
        {code && origin ? (
          <QrCard code={code} origin={origin} showLink />
        ) : (
          <div className={styles.skeleton} role="status" aria-label={t('adminQr.loading')} />
        )}
      </div>
      {sheet}
    </Dialog>
  );
}
