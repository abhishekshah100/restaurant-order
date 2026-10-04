'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { AddControl } from '@/components/menu/AddControl';
import { VegMark } from '@/components/ui';
import { useCart } from '@/hooks/useCart';
import { useContent, useMenu, useRegion } from '@/api/hooks';
import { dishImage, isAvailable, startingPrice } from '@/lib/menu';
import type { Dish } from '@/types/menu';
import styles from './CartSuggestions.module.css';

/**
 * "Goes well with your order": three drinks or desserts that weren't in the cart when it
 * opened. A pick stays put once added (its "+" becomes a stepper), and focus moves to the
 * stepper so keyboard users aren't dropped back to the top of the page.
 */
export function CartSuggestions() {
  const { cartSuggestions, getDish } = useMenu();
  const { lines } = useCart();
  const t = useContent('cart');
  const { money } = useRegion();
  const [initialSlugs] = useState(() => new Set(lines.map((l) => l.dishSlug)));
  const listRef = useRef<HTMLUListElement>(null);
  const picks = cartSuggestions
    .map(getDish)
    .filter((d): d is Dish => !!d && isAvailable(d) && !initialSlugs.has(d.slug))
    .slice(0, 3);
  const inCart = new Set(lines.map((l) => l.dishSlug));
  const added = picks
    .filter((d) => inCart.has(d.slug))
    .map((d) => d.slug)
    .join(' ');
  const prevAdded = useRef(added);

  useEffect(() => {
    const before = prevAdded.current.split(' ');
    prevAdded.current = added;
    const fresh = added.split(' ').find((slug) => slug && !before.includes(slug));
    if (!fresh) return;
    // After the quick-add dialog (if any) has closed and tried to restore focus.
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      listRef.current
        ?.querySelector<HTMLElement>(`[data-slug="${fresh}"] [role="group"] button:last-of-type`)
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [added]);

  if (picks.length === 0) return null;

  return (
    <section className={styles.root} aria-labelledby="goes-well">
      <h2 id="goes-well" className={styles.title}>
        {t('suggestions.title')}
      </h2>
      <ul ref={listRef} className={styles.list}>
        {picks.map((dish) => {
          const thumb = dishImage(dish, 'thumb');
          return (
            <li key={dish.slug} className={styles.item} data-slug={dish.slug}>
              <span className={styles.media} aria-hidden="true">
                {thumb ? (
                  <Image
                    className={styles.img}
                    src={thumb.src}
                    alt={''}
                    width={thumb.width}
                    height={thumb.height}
                    sizes="120px"
                  />
                ) : (
                  <span className={styles.initial}>{dish.name.charAt(0)}</span>
                )}
                <span className={styles.mark}>
                  <VegMark veg={dish.veg} />
                </span>
              </span>
              <span className={styles.name}>{dish.name}</span>
              <span className={styles.foot}>
                <span className={styles.price}>{money.format(startingPrice(dish))}</span>
                <AddControl dish={dish} size="icon" className={styles.control} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
