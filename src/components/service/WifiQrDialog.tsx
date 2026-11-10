'use client';

import { useMemo } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Dialog } from '@/components/ui';
import { qrPath } from '@/lib/tableQr';
import { wifiQrText } from '@/lib/wifiQr';
import styles from './WifiCard.module.css';

/**
 * The guest Wi-Fi as a QR code: another phone (a friend's, a tablet) scans it with its camera
 * and joins without typing; the name and password are written under it too. Downloaded the
 * first time a guest opens it (it brings the QR library).
 */
export function WifiQrDialog({
  name,
  password,
  onClose,
}: {
  name: string;
  password: string;
  onClose: () => void;
}) {
  const t = useContent('service');
  const qr = useMemo(() => qrPath(wifiQrText(name, password)), [name, password]);
  return (
    <Dialog
      open
      onClose={onClose}
      presentation="modal"
      title={t('wifi.qrTitle')}
      description={t('wifi.qrBody')}
      footer={
        <Button block onClick={onClose}>
          {t('wifi.qrDone')}
        </Button>
      }
    >
      <div className={styles.qr}>
        <svg
          className={styles.qrCode}
          viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`}
          role="img"
          aria-label={t('wifi.qrLabel', { name })}
          shapeRendering="crispEdges"
        >
          <rect x={-2} y={-2} width={qr.size + 4} height={qr.size + 4} fill="#ffffff" />
          <path d={qr.d} fill="#1d1b18" />
        </svg>
        <dl className={styles.rows}>
          <div className={styles.row}>
            <dt>{t('wifi.network')}</dt>
            <dd className={styles.value}>{name}</dd>
          </div>
          <div className={styles.row}>
            <dt>{t('wifi.password')}</dt>
            <dd className={password ? styles.value : 'c3'}>{password || t('wifi.noPassword')}</dd>
          </div>
        </dl>
      </div>
    </Dialog>
  );
}
