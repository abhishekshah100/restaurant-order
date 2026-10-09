'use client';

import { useBranch, useContent } from '@/api/hooks';
import { Button, Icon } from '@/components/ui';
import { useCartActions } from '@/hooks/useCart';
import type { CartAction } from '@/hooks/useCartAction';
import { cx } from '@/lib/cx';
import { formatCountdown } from '@/lib/format';
import styles from './CartModeBanner.module.css';

/**
 * What the cart is for when it isn't a new order: "Adding to order #A105" (the next round of a
 * running dine-in order, no checkout) or "Editing order #A105" (a change, with the time left
 * and Cancel editing, which puts the cart back as it was).
 */
export function CartModeBanner({ action, className }: { action: CartAction; className?: string }) {
  const t = useContent('cart');
  const { ordering } = useBranch();
  const { stopEditing } = useCartActions();

  if (action.kind === 'addRound') {
    return (
      <section className={cx(styles.banner, className)} aria-labelledby="cart-mode">
        <Icon name="plus" size="sm" />
        <div className={styles.text}>
          <h2 id="cart-mode" className={styles.title}>
            {t('tab.title', { id: action.tab.id })}
          </h2>
          <p className={styles.body}>
            {t(`tab.${ordering.dineInPayment}`, { round: action.round })}
          </p>
        </div>
      </section>
    );
  }

  if (action.kind !== 'update') return null;
  const { orderId: id, round, window: changes } = action;
  return (
    <section className={cx(styles.banner, styles.editing, className)} aria-labelledby="cart-mode">
      <Icon name="pencil" size="sm" />
      <div className={styles.text}>
        <h2 id="cart-mode" className={styles.title}>
          {changes?.isTab ? t('editing.titleRound', { id, round }) : t('editing.title', { id })}
        </h2>
        {changes?.open && (
          <p className={styles.body}>
            {t.rich(
              'editing.open',
              { b: (c) => <b className={styles.time}>{c}</b> },
              { time: formatCountdown(changes.secondsLeft) },
            )}
          </p>
        )}
        {changes && !changes.open && (
          <p className={cx(styles.body, styles.closed)} role="status">
            {t('editing.closed')}
          </p>
        )}
      </div>
      <Button variant="secondary" size="sm" className={styles.cancel} onClick={stopEditing}>
        {t('editing.cancel')}
      </Button>
    </section>
  );
}
