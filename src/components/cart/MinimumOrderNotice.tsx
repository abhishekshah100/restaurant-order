'use client';

import { useContent, useRegion } from '@/api/hooks';
import { Banner } from '@/components/ui';
import { useOrderBill } from '@/hooks/useFulfilment';
import styles from './MinimumOrderNotice.module.css';

/**
 * "Add ₹120 more to check out": shown while the cart is below the minimum order for takeaway
 * or for the delivery area (checkout is held back until it's met).
 */
export function MinimumOrderNotice({ className }: { className?: string }) {
  const { mode, minimum, quote } = useOrderBill();
  const { money } = useRegion();
  const t = useContent('cart');
  if (mode === 'dineIn' || !minimum || minimum.shortBy === 0) return null;
  const amount = money.format(minimum.minimum);
  return (
    <Banner tone="warn" icon="info" live="polite" className={className}>
      <span className={styles.title}>
        {t('minOrder.title', { amount: money.format(minimum.shortBy) })}
      </span>
      <span className={styles.body}>
        {mode === 'delivery'
          ? t('minOrder.delivery', { area: quote?.area ?? '', minimum: amount })
          : t('minOrder.takeaway', { minimum: amount })}
      </span>
    </Banner>
  );
}
