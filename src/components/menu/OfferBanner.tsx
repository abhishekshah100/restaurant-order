'use client';

import Link from 'next/link';
import { useContent, useMenu, useRegion } from '@/api/hooks';
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
 * Beverages till 7:00 PM" (branch time), with a link to the category it covers. Nothing
 * otherwise, and nothing in the prerendered HTML.
 */
export function OfferBanner({ categoryId }: { categoryId?: string }) {
  const offers = useActiveOffers();
  const minute = useMinute();
  const t = useContent('menu');
  const { money, clock } = useRegion();
  const { categories } = useMenu();
  if (offers.length === 0 || minute === null) return null;
  const now = new Date(minute);
  return (
    <div className={styles.row}>
      {offers.map((offer) => {
        // One category: named, and linked. Anything else: "selected dishes".
        const only =
          offer.scope.categories?.length === 1 && !offer.scope.dishes?.length
            ? categories.find((c) => c.id === offer.scope.categories?.[0])
            : undefined;
        const words = {
          name: offer.name,
          what: only?.name ?? t('offers.selected'),
          time: clock.time(clock.localTimestamp(0, offer.to, now)),
        };
        return (
          <p key={offer.id} className={styles.banner}>
            <Icon name="tag" size="sm" />
            <span className={styles.text}>
              {offer.type === 'priceOverride'
                ? t.rich(
                    'offers.bannerPrice',
                    { b: (chunk) => <b>{chunk}</b> },
                    { ...words, price: money.format(offer.value) },
                  )
                : t.rich(
                    'offers.banner',
                    { b: (chunk) => <b>{chunk}</b> },
                    { ...words, discount: offerAmount(offer, money) },
                  )}
            </span>
            {only && only.id !== categoryId && (
              <Link href={`/menu/${only.id}/`} className={styles.link}>
                {t('offers.link', { category: only.name })}
                <Icon name="chev" size="xs" />
              </Link>
            )}
          </p>
        );
      })}
    </div>
  );
}
