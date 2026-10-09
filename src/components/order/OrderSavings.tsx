import { useBranch, useContent, useRegion } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import { numberLocale } from '@/lib/money';
import type { Order } from '@/types/order';
import styles from './OrderSavings.module.css';

/** "You saved ₹139.60 with Happy hour and WELCOME10", for an order with discounts; nothing otherwise. */
export function OrderSavings({ order, className }: { order: Order; className?: string }) {
  const t = useContent('orders');
  const cart = useContent('cart');
  const branch = useBranch();
  const { money } = useRegion();
  const discounts = order.discounts ?? [];
  if (discounts.length === 0) return null;
  const saved = discounts.reduce((sum, d) => sum + money.toMinor(d.amount), 0);
  const names = discounts.map((d) =>
    d.kind === 'offer' ? cart(`priceSummary.offers.${d.labelKey}`) : d.code,
  );
  const list = new Intl.ListFormat(numberLocale(branch), { type: 'conjunction' }).format(names);
  return (
    <p className={cx(styles.saved, className)}>
      <Icon name="tag" size="xs" />
      {t('confirmed.saved', { amount: money.formatMinor(saved), discounts: list })}
    </p>
  );
}
