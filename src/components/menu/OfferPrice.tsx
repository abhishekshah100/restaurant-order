import { useContent, useRegion } from '@/api/hooks';
import { Tag } from '@/components/ui';
import { useDishOffer } from '@/hooks/useOffers';
import type { Dish, Price } from '@/types/menu';
import styles from './OfferPrice.module.css';

interface OfferProps {
  dish: Pick<Dish, 'slug' | 'categoryId'>;
  /** The menu price shown (the starting price, or the configured one). */
  price: Price;
}

/**
 * A dish's price. While an offer is on (happy hour), the offer price comes first and the menu
 * price follows struck through; screen readers hear "₹159, was ₹199".
 */
export function OfferPrice({ dish, price }: OfferProps) {
  const offer = useDishOffer(dish, price);
  const { money } = useRegion();
  const t = useContent('menu');
  if (!offer) return money.format(price);
  const now = money.format(offer.price);
  const was = money.format(offer.was);
  return (
    <span className={styles.offer}>
      <span aria-hidden="true">{now}</span>
      <s className={styles.was} aria-hidden="true">
        {was}
      </s>
      <span className="visually-hidden">{t('dish.offerPrice', { price: now, was })}</span>
    </span>
  );
}

/** The offer's badge ("Happy hour") on a dish it covers, while it's on; nothing otherwise. */
export function OfferBadge({ dish, price, className }: OfferProps & { className?: string }) {
  const offer = useDishOffer(dish, price);
  const t = useContent('menu');
  if (!offer) return null;
  return (
    <Tag variant="ok" icon="tag" className={className}>
      {t(`offers.${offer.offer.labelKey}.badge`)}
    </Tag>
  );
}
