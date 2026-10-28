import { useContent } from '@/api/hooks';
import { OptionGroup } from '@/components/ui';
import { CANCEL_REASONS } from '@/lib/adminOrders';
import type { CancelReason } from '@/types/admin';
import type { Price } from '@/types/menu';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './OrderDetailDialog.module.css';

/** The order dialog's Cancel step: why, and what the guest sees and gets back. */
export function CancelOrderView({
  refund,
  value,
  onChange,
}: {
  /** Paid so far (online or to staff): refunded when it's cancelled. */
  refund: Price;
  value: CancelReason;
  onChange: (reason: CancelReason) => void;
}) {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  return (
    <div className={styles.step}>
      <OptionGroup
        type="radio"
        id="cancel-reason"
        title={t('adminOrder.cancel.reason')}
        value={value}
        onChange={(id) => onChange(CANCEL_REASONS.find((r) => r === id) ?? value)}
        choices={CANCEL_REASONS.map((reason) => ({
          id: reason,
          label: t(`adminOrder.cancel.reasons.${reason}`),
        }))}
      />
      <p className={styles.stepNote}>
        {t('adminOrder.cancel.guestSees')}
        {refund > 0 && ` ${t('adminOrder.cancel.refund', { amount: money.format(refund) })}`}
      </p>
    </div>
  );
}
