'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useContent } from '@/api/hooks';
import { Button } from '@/components/ui';
import { useOverlay } from '@/components/ui/Dialog/useOverlay';
import { qrFor } from '@/lib/payments';
import type { AtTableMethodKey, PaymentQrCode } from '@/types/branch';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { usePaymentText } from './usePaymentText';
import styles from './PaymentQrView.module.css';

/**
 * "Show eSewa QR" while collecting: the branch's QR for the way the guest pays (Settings › Payment
 * QR codes) opens full screen, large on white with the amount, for staff to turn the screen to
 * the guest. eSewa and Khalti without a QR of their own show the Fonepay QR. Nothing without one.
 */
export function ShowQrButton({ method, amount }: { method: AtTableMethodKey; amount: number }) {
  const t = useContent('common');
  const { region } = useAdminWorkspace();
  const { amount: format, methodName } = usePaymentText();
  const [open, setOpen] = useState(false);
  const qr = qrFor(method, region.payments.qrCodes);
  if (!qr || amount <= 0) return null;
  const name = methodName(method);
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        iconStart="qr"
        className={styles.show}
        onClick={() => setOpen(true)}
      >
        {t('adminPayments.qr.showFor', { method: name })}
      </Button>
      <QrView
        open={open}
        onClose={() => setOpen(false)}
        qr={qr}
        name={name}
        amount={format(amount)}
        viaFonepay={qr.method !== method}
      />
    </>
  );
}

/** The QR full screen: what to pay with, the code, who it pays and the amount. */
function QrView({
  open,
  onClose,
  qr,
  name,
  amount,
  viaFonepay,
}: {
  open: boolean;
  onClose: () => void;
  qr: PaymentQrCode;
  /** The way the guest pays ("eSewa"). */
  name: string;
  amount: string;
  /** It's the Fonepay QR standing in for the wallet's own. */
  viaFonepay: boolean;
}) {
  const t = useContent('common');
  const ref = useRef<HTMLDivElement>(null);
  const { visible } = useOverlay(ref, open, onClose);
  if (!visible) return null;

  return createPortal(
    <div
      ref={ref}
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-qr-title"
    >
      <div className={styles.panel}>
        <h2 id="payment-qr-title" className={styles.title}>
          {t('adminPayments.qr.title', { method: name })}
        </h2>
        <Image
          className={styles.code}
          src={qr.image.src}
          alt={t('adminPayments.qr.alt', { method: name })}
          width={qr.image.width}
          height={qr.image.height}
          sizes="(max-width: 600px) 80vw, 420px"
        />
        {qr.note && <p className={styles.note}>{qr.note}</p>}
        {viaFonepay && <p className={styles.note}>{t('adminPayments.qr.fonepay')}</p>}
        <p className={styles.amount}>
          <span>{t('adminPayments.qr.amount')}</span>
          <strong>{amount}</strong>
        </p>
        <Button block onClick={onClose} data-autofocus>
          {t('adminPayments.qr.close')}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
