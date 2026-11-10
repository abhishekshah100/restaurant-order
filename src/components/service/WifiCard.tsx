'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useContent, useSessionWifi } from '@/api/hooks';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { Button, Icon } from '@/components/ui';
import { useGuestSession } from '@/context/GuestSessionContext';
import { useToast } from '@/context/ToastContext';
import styles from './WifiCard.module.css';

// Downloaded the first time a guest opens it (it brings the QR library).
const WifiQrDialog = dynamic(() => import('./WifiQrDialog').then((m) => m.WifiQrDialog), {
  ssr: false,
  loading: () => <LoadingSignal />,
});

/**
 * The guest Wi-Fi on the Help page (Settings › Help page): its name and password, a QR code to
 * scan to join (Show QR code), and a button to copy the password. Only for guests seated at a table, and only when the branch has one.
 */
export function WifiCard() {
  const t = useContent('service');
  const { showToast } = useToast();
  const wifi = useSessionWifi(useGuestSession()?.id);
  const [showQr, setShowQr] = useState(false);
  if (!wifi) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(wifi.password);
      showToast(t('wifi.copied'), { tone: 'success' });
    } catch {
      // No clipboard (an old browser, or not allowed): the password is on screen to type.
    }
  };

  return (
    <section className={styles.card} aria-labelledby="guest-wifi">
      <h2 id="guest-wifi" className={styles.title}>
        <Icon name="wifi" size="sm" />
        {t('wifi.title')}
      </h2>
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>{t('wifi.network')}</dt>
          <dd className={styles.value}>{wifi.name}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('wifi.password')}</dt>
          <dd className={wifi.password ? styles.value : 'c3'}>
            {wifi.password || t('wifi.noPassword')}
          </dd>
        </div>
      </dl>
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" block iconStart="qr" onClick={() => setShowQr(true)}>
          {t('wifi.qr')}
        </Button>
        {wifi.password && (
          <Button variant="secondary" size="sm" block iconStart="copy" onClick={() => void copy()}>
            {t('wifi.copy')}
          </Button>
        )}
      </div>
      {showQr && (
        <WifiQrDialog name={wifi.name} password={wifi.password} onClose={() => setShowQr(false)} />
      )}
    </section>
  );
}
