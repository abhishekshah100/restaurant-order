'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Icon, type IconName } from '@/components/ui';
import type { Order } from '@/types/order';
import { hasFeature } from '@/lib/adminPlan';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { BusinessBuyer, canAddBuyer } from './BusinessBuyer';
import { BillBreakdown, CollectFields, LeaveCard, type CollectChoice } from './CollectFields';
import { DiscountPanel, canGiveDiscount } from './DiscountPanel';
import styles from './CollectScreen.module.css';

/** The bill option open below the options (leaving part of the bill is the choice's own). */
type Tool = 'discount' | 'business';

/**
 * Collect payment, laid out like a till: the bill on the left (each item, every charge, the
 * total) with what can be done to it underneath — a discount, leave part unpaid, a business
 * customer's invoice — and the payment on the right (what to collect, how they paid, the cash
 * and change). On a phone, one column: the payment first (the bill a tap away in it), then the
 * bill's options. One option open at a time. The same screen on the Payments page, a table and
 * an order.
 */
export function CollectScreen({ orders, choice }: { orders: Order[]; choice: CollectChoice }) {
  const t = useContent('common');
  const { can, branch } = useAdminWorkspace();
  const [tool, setTool] = useState<Tool | null>(null);
  const discount = canGiveDiscount(orders, can);
  // Leaving part unpaid and the business invoice: the package's bill options.
  const business = canAddBuyer(orders) && hasFeature(branch, 'billOptions');
  const buyer = orders[0]?.buyer;

  const open = (next: Tool | 'leave') => {
    if (choice.leaving) choice.stopLeaving();
    if (next === 'leave') {
      setTool(null);
      if (!choice.leaving) choice.startLeaving();
      return;
    }
    setTool(tool === next ? null : next);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.pay}>
        <CollectFields orders={orders} choice={choice} />
      </div>

      <section className={styles.billPane} aria-labelledby="collect-bill-title">
        <div className={styles.receipt}>
          <h3 id="collect-bill-title" className={styles.receiptTitle}>
            <Icon name="receipt" size="xs" />
            {t('adminPayments.collect.billTitle')}
          </h3>
          <BillBreakdown orders={orders} choice={choice} />
        </div>

        <div className={styles.options}>
          {(discount || choice.canLeave || business) && (
            <>
              <p className={styles.optionsTitle}>{t('adminPayments.collect.options')}</p>
              <div
                className={styles.optionRow}
                role="group"
                aria-label={t('adminPayments.collect.options')}
              >
                {discount && (
                  <Option
                    icon="tag"
                    label={t('adminPayments.collect.option.discount')}
                    pressed={tool === 'discount'}
                    onClick={() => open('discount')}
                  />
                )}
                {choice.canLeave && (
                  <Option
                    icon="minus"
                    label={t('adminPayments.collect.option.leave')}
                    pressed={choice.leaving}
                    onClick={() => open('leave')}
                  />
                )}
                {business && (
                  <Option
                    icon="receipt"
                    label={t('adminPayments.collect.option.business')}
                    pressed={tool === 'business'}
                    done={Boolean(buyer)}
                    onClick={() => open('business')}
                  />
                )}
              </div>
            </>
          )}

          {choice.leaving && <LeaveCard choice={choice} />}
          <DiscountPanel
            orders={orders}
            open={tool === 'discount'}
            onOpenChange={(on) => setTool(on ? 'discount' : null)}
          />
          <BusinessBuyer
            orders={orders}
            open={tool === 'business'}
            onOpenChange={(on) => setTool(on ? 'business' : null)}
          />
        </div>
      </section>
    </div>
  );
}

/** One of the bill's options: an icon tile, pressed while its form is open. */
function Option({
  icon,
  label,
  pressed,
  done,
  onClick,
}: {
  icon: IconName;
  label: string;
  pressed: boolean;
  /** Already set (a business customer's details): a tick. */
  done?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.option} aria-pressed={pressed} onClick={onClick}>
      <span className={styles.optionIcon} aria-hidden="true">
        <Icon name={done ? 'check' : icon} size="sm" />
      </span>
      <span className={styles.optionLabel}>{label}</span>
    </button>
  );
}
