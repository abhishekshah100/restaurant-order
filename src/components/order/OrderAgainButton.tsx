'use client';

import { useContent } from '@/api/hooks';
import { Button } from '@/components/ui';
import { useOrderAgain } from '@/hooks/useOrderAgain';
import type { Order } from '@/types/order';

/** "Order again": the order's items go into the cart, and the cart opens. */
export function OrderAgainButton({
  order,
  block,
  size,
  className,
}: {
  order: Order;
  block?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const t = useContent('orders');
  const orderAgain = useOrderAgain();
  return (
    <Button
      variant="secondary"
      size={size}
      block={block}
      iconStart="refresh"
      className={className}
      aria-label={t('again.label', { id: order.id })}
      onClick={() => orderAgain(order)}
    >
      {t('again.button')}
    </Button>
  );
}
