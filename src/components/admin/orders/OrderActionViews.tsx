import { useContent } from '@/api/hooks';
import { OptionGroup } from '@/components/ui';
import { CANCEL_REASONS } from '@/lib/adminOrders';
import type { CancelReason } from '@/types/admin';
import type { AtTableMethodKey } from '@/types/branch';
import type { Price } from '@/types/menu';
import type { Order } from '@/types/order';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './OrderDetailDialog.module.css';

/** The order dialog's Collect payment step: how much, and how the guest paid. */
export function CollectPaymentView({
  order,
  due,
  methods,
  value,
  onChange,
}: {
  order: Order;
  due: Price;
  /** The branch's ways to pay staff in person (GET /branches › payments.atTable). */
  methods: readonly AtTableMethodKey[];
  value: AtTableMethodKey;
  onChange: (method: AtTableMethodKey) => void;
}) {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  return (
    <div className={styles.step}>
      <p className={styles.amount}>
        <span>{t('adminOrder.due')}</span>
        <strong>{money.format(due)}</strong>
      </p>
      <OptionGroup
        type="radio"
        id={`collect-${order.id}`}
        title={t('adminOrder.collect.method')}
        layout="grid"
        value={value}
        onChange={(id) => onChange(methods.find((m) => m === id) ?? value)}
        choices={methods.map((method) => ({ id: method, label: t(`paymentMethods.${method}`) }))}
      />
    </div>
  );
}

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
