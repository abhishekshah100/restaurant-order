'use client';

import Link from 'next/link';
import { useContent, useRegion } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { useActiveOffers, useMinute } from '@/hooks/useOffers';
import type { Money } from '@/lib/money';
import type { AutoOffer } from '@/types/promotion';
import styles from './OfferBanner.module.css';

/** What an offer takes off (or costs), as its banner says it: "20%", or an amount ("₹50"). */
const offerAmount = (offer: AutoOffer, money: Money) =>
  offer.type === 'percent' ? `${offer.value}%` : money.format(offer.value);

/**
 * A slim banner under the menu headers while an automatic offer is on: "Happy hour · 20% off
 * drinks till 7:00 PM" (branch time), with a link to the dishes it covers. Nothing otherwise,
 * and nothing in the prerendered HTML.
 */
export function OfferBanner({ categoryId }: { categoryId?: string }) {
  const offers = useActiveOffers();
  const minute = useMinute();
  const t = useContent('menu');
  const { money, clock } = useRegion();
  if (offers.length === 0 || minute === null) return null;
  const now = new Date(minute);
  return (
    <div className={styles.row}>
      {offers.map((offer) => {
        const target = offer.scope.categories?.[0];
        return (
          <p key={offer.id} className={styles.banner}>
            <Icon name="tag" size="sm" />
            <span className={styles.text}>
              {t.rich(
                `offers.${offer.labelKey}.banner`,
                { b: (chunk) => <b>{chunk}</b> },
                {
                  discount: offerAmount(offer, money),
                  time: clock.time(clock.localTimestamp(0, offer.to, now)),
                },
              )}
            </span>
            {target && target !== categoryId && (
              <Link href={`/menu/${target}/`} className={styles.link}>
                {t(`offers.${offer.labelKey}.link`)}
                <Icon name="chev" size="xs" />
              </Link>
            )}
          </p>
        );
      })}
    </div>
  );
}
