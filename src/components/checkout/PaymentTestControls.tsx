'use client';

import { useContent } from '@/api/hooks';
import { PAYMENT_TEST_CONTROLS } from '@/lib/paymentTesting';
import styles from './Processing.module.css';

/**
 * Stand-ins for the guest's bank or UPI app while no payment provider is connected: approve or
 * decline the payment being confirmed. Only where testing is on (lib/paymentTesting), clearly
 * marked as such; real guests never see them.
 */
export function PaymentTestControls({
  disabled,
  onApprove,
  onDecline,
}: {
  disabled?: boolean;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const t = useContent('checkout');
  if (!PAYMENT_TEST_CONTROLS) return null;
  return (
    <div className={styles.proto} role="group" aria-label={t('processing.test.label')}>
      <span className={styles.protoTag}>{t('processing.test.label')}</span>
      <button type="button" className={styles.protoLink} onClick={onApprove} disabled={disabled}>
        {t('processing.test.approve')}
      </button>
      <button type="button" className={styles.protoLink} onClick={onDecline} disabled={disabled}>
        {t('processing.test.decline')}
      </button>
    </div>
  );
}
