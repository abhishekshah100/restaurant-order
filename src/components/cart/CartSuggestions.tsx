'use client';

import Image from 'next/image';
import type { CartSuggestion } from '@/api/contracts';
import type { ContentMap } from '@/api/queries';
import type { Translator } from '@/api/translator';
import { AddControl } from '@/components/menu/AddControl';
import { VegMark } from '@/components/ui';
import { useCart } from '@/hooks/useCart';
import { useCartSuggestions, useContent, useMenu, useRegion } from '@/api/hooks';
import { dishImage, isAvailable, startingPrice } from '@/lib/menu';
import type { Dish } from '@/types/menu';
import styles from './CartSuggestions.module.css';

/**
 * "Goes well with your order": up to three dishes for what's in the cart, from GET
 * …/menu/cart-suggestions (staff's picks, then what's ordered together with these dishes, then
 * what's popular, from the categories staff chose; Admin › Menu › Suggestions › Cart). Each
 * card says why it's there. A dish in the cart is never suggested: once added, its card makes way
 * for the next. Until the server answers, nothing shows; if it can't be reached, the menu's own
 * picks stand in.
 */
export function CartSuggestions() {
  const { cartSuggestions, getDish } = useMenu();
  const { lines } = useCart();
  const t = useContent('cart');
  const { money } = useRegion();
  const cart = [...new Set(lines.map((l) => l.dishSlug))];
  const inCart = new Set(cart);
  const { data, isError } = useCartSuggestions(cart);

  const picks: { dish: Dish; reason?: string }[] = isError
    ? cartSuggestions
        .map(getDish)
        .filter((d): d is Dish => !!d && isAvailable(d) && !inCart.has(d.slug))
        .slice(0, 3)
        .map((dish) => ({ dish }))
    : (data?.dishes ?? []).flatMap((s) => {
        const dish = getDish(s.slug);
        // The last answer stays while a changed cart's comes: drop what's now in the cart.
        if (!dish || !isAvailable(dish) || inCart.has(s.slug)) return [];
        return [{ dish, reason: reasonOf(s, t) }];
      });

  if (cart.length === 0 || picks.length === 0) return null;

  return (
    <section className={styles.root} aria-labelledby="goes-well">
      <h2 id="goes-well" className={styles.title}>
        {t('suggestions.title')}
      </h2>
      <ul className={styles.list}>
        {picks.map(({ dish, reason }) => {
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
                    // Three small cards near the top of the cart: often its largest image.
                    loading="eager"
                  />
                ) : (
                  <span className={styles.initial}>{dish.name.charAt(0)}</span>
                )}
                <span className={styles.mark}>
                  <VegMark veg={dish.veg} />
                </span>
              </span>
              <span className={styles.name}>{dish.name}</span>
              {reason && <span className={styles.reason}>{reason}</span>}
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

/** Why a dish is suggested, in a few words ("Often ordered with Butter Chicken"); none for the menu's. */
function reasonOf(s: CartSuggestion, t: Translator<ContentMap['cart']>): string | undefined {
  if (s.source === 'together') return t('suggestions.reason.together', { dish: s.withName ?? '' });
  if (s.source === 'pinned') return t('suggestions.reason.pinned');
  if (s.source === 'popular') return t('suggestions.reason.popular');
  return undefined;
}
