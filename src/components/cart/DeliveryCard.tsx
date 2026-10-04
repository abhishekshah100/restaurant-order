'use client';

import { useState } from 'react';
import { useBranch, useContent, useRegion } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { DeliveryAreaSelect } from '@/components/start/DeliveryAreaSelect';
import { useVisitActions } from '@/context/GuestSessionContext';
import { useOrderBill } from '@/hooks/useFulfilment';
import { useRequestFailed } from '@/hooks/useRequestFailed';
import { cx } from '@/lib/cx';
import styles from './DeliveryCard.module.css';

/**
 * Delivery: the area the cart is going to (changing it updates the session, so the fee and
 * minimum follow), its zone and ETA, and how far the cart is from free delivery.
 */
export function DeliveryCard({ id, className }: { id: string; className?: string }) {
  const branch = useBranch();
  const { money } = useRegion();
  const { area, quote, quotePending, bill } = useOrderBill();
  const { update } = useVisitActions();
  const requestFailed = useRequestFailed();
  const t = useContent('cart');
  const [changing, setChanging] = useState<string | null>(null);

  const choose = async (next: string) => {
    setChanging(next);
    const ok = await update({ deliveryArea: next });
    setChanging(null);
    if (!ok) requestFailed();
  };

  let detail: string = t('delivery.chooseFirst');
  if (changing || (area && quotePending && !quote)) detail = t('delivery.pending');
  else if (quote) detail = t('delivery.zone', { zone: quote.zoneName, minutes: quote.etaMinutes });

  const toFree = quote?.freeAbove !== undefined ? quote.freeAbove - bill.itemTotal : null;

  return (
    <section className={cx(styles.card, className)} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.title}>
        <Icon name="scooter" size="sm" />
        {t('delivery.title')}
      </h2>
      <DeliveryAreaSelect
        id={id}
        branch={branch}
        label={t('delivery.label')}
        value={changing ?? area ?? ''}
        onChange={(next) => void choose(next)}
        showZone={false}
      />
      <p className={styles.detail} aria-live="polite">
        {detail}
      </p>
      {quote && toFree !== null && !changing && (
        <p className={cx(styles.free, toFree <= 0 && styles.freeOn)}>
          <Icon name={toFree <= 0 ? 'checkc' : 'sparkle'} size="xs" />
          {toFree <= 0
            ? t('delivery.freeUnlocked')
            : t('delivery.addForFree', { amount: money.format(toFree) })}
        </p>
      )}
    </section>
  );
}
