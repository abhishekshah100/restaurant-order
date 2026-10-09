import Image from 'next/image';
import Link from 'next/link';
import { memo } from 'react';
import { Tag, VegMark } from '@/components/ui';
import { useContent } from '@/api/hooks';
import { useDishOffer } from '@/hooks/useOffers';
import { dishImage, startingPrice } from '@/lib/menu';
import type { Dish } from '@/types/menu';
import { AddControl } from './AddControl';
import { OfferBadge, OfferPrice } from './OfferPrice';
import { TAG_VARIANT, firstHighlight, tagLabel, type DishHighlight } from './dishTag';
import styles from './DishCard.module.css';

export interface DishCardProps {
  dish: Dish;
  /** Load eagerly (above the fold). */
  priority?: boolean;
  /** Inside "Chef's picks" the chef's-pick tag says nothing new, so it's hidden. */
  hideChefTag?: boolean;
}

const CARD_ORDER: readonly DishHighlight[] = ['new', 'spicy', 'bestseller', 'chef'];
const CARD_ORDER_NO_CHEF = CARD_ORDER.filter((h) => h !== 'chef');

function CardTag({ dish, hideChefTag }: { dish: Dish; hideChefTag?: boolean }) {
  const t = useContent('menu');
  const highlight = firstHighlight(dish, hideChefTag ? CARD_ORDER_NO_CHEF : CARD_ORDER);
  if (!highlight) return null;
  if (highlight === 'spicy')
    return (
      <Tag variant="pop" icon="flame">
        {t('filters.spicy')}
      </Tag>
    );
  return <Tag variant={TAG_VARIANT[highlight]}>{tagLabel(t, highlight)}</Tag>;
}

/**
 * Feature card (chef's picks): a white card with the photo on top, then name,
 * one-line description, and a price row with a compact ADD / stepper.
 * The whole card opens the dish; the ADD control stays separately operable.
 */
export const DishCard = memo(function DishCard({ dish, priority, hideChefTag }: DishCardProps) {
  const image = dishImage(dish, 'card');
  const price = startingPrice(dish);
  // While an offer is on, its badge takes the photo's tag spot.
  const offer = useDishOffer(dish, price);
  return (
    <li className={styles.card}>
      <div className={styles.media}>
        {image && (
          <Image
            className={styles.img}
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes="(min-width: 1024px) 300px, 70vw"
            priority={priority}
          />
        )}
        <span className={styles.tag}>
          {offer ? (
            <OfferBadge dish={dish} price={price} />
          ) : (
            <CardTag dish={dish} hideChefTag={hideChefTag} />
          )}
        </span>
      </div>
      <div className={styles.body}>
        <div className={styles.top}>
          <VegMark veg={dish.veg} />
          <h3 className={styles.name}>
            <Link href={`/dish/${dish.slug}/`} className={styles.link}>
              {dish.name}
            </Link>
          </h3>
        </div>
        <p className={styles.desc}>{dish.cardDescription ?? dish.description}</p>
        <div className={styles.foot}>
          <span className={styles.price}>
            <OfferPrice dish={dish} price={price} />
          </span>
          <AddControl dish={dish} className={styles.control} size="sm" customisableHint />
        </div>
      </div>
    </li>
  );
});
