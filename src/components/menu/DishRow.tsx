'use client';

import Image from 'next/image';
import Link from 'next/link';
import { memo } from 'react';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import { dishImage, highlight, isAvailable, startingPrice } from '@/lib/menu';
import type { Dish } from '@/types/menu';
import { AddControl } from './AddControl';
import { DishTags } from './DishTags';
import { ExpandableText } from './ExpandableText';
import { OfferBadge, OfferPrice } from './OfferPrice';
import styles from './DishRow.module.css';

/** The thumbnail repeats the dish name next to it, so screen readers skip it. */
const DECORATIVE = '';

export interface DishRowProps {
  dish: Dish;
  /** Highlight these words in the name (search results). */
  query?: string;
  /** Show prep time for dishes with a photo (category view). */
  showPrepTime?: boolean;
  /** Search result layout: category instead of tag, "In cart" note. */
  searchResult?: boolean;
}

/**
 * Menu dish card: tags, name, description and an optional photo on top;
 * prices, a short note and the ADD / stepper in a fixed bottom-right spot.
 * The whole card opens the dish; ADD stays separately operable.
 */
export const DishRow = memo(function DishRow({
  dish,
  query,
  showPrepTime,
  searchResult,
}: DishRowProps) {
  const thumb = dishImage(dish, 'thumb');
  const available = isAvailable(dish);

  return (
    <li className={cx(styles.item, !available && styles.out)}>
      <div className={styles.main}>
        <div className={styles.body}>
          <DishTags dish={dish} showCategory={searchResult} />
          <h3 className={styles.name}>
            <Link href={`/dish/${dish.slug}/`} className={styles.link}>
              {query
                ? highlight(dish.name, query).map((part, i) =>
                    part.match ? (
                      <mark key={i} className={styles.mark}>
                        {part.text}
                      </mark>
                    ) : (
                      <span key={i}>{part.text}</span>
                    ),
                  )
                : dish.name}
            </Link>
          </h3>
          <ExpandableText className={styles.desc} text={dish.description} itemName={dish.name} />
          {showPrepTime && dish.image && dish.prepTime && (
            <span className={styles.prep}>
              <Icon name="clock" size="xs" />
              {dish.prepTime}
            </span>
          )}
        </div>
        {thumb && (
          <div className={styles.thumb}>
            <Image
              className={styles.img}
              src={thumb.src}
              alt={DECORATIVE}
              width={thumb.width}
              height={thumb.height}
              sizes="96px"
            />
          </div>
        )}
      </div>

      <div className={styles.foot}>
        <div className={styles.priceBlock}>
          {/* Starting price; sizes and add-ons are chosen in the pop-up */}
          <span className={styles.price}>
            <OfferPrice dish={dish} price={startingPrice(dish)} />
          </span>
          <OfferBadge dish={dish} price={startingPrice(dish)} className={styles.badge} />
        </div>
        <AddControl dish={dish} className={styles.control} size="sm" customisableHint />
      </div>
    </li>
  );
});
