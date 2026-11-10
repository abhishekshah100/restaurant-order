'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Chip, Icon, Skeleton, VegMark } from '@/components/ui';
import { cx } from '@/lib/cx';
import { useContent, useMenu, useRegion, useSearchSuggestions } from '@/api/hooks';
import { useBrandName } from '@/hooks/useBrandName';
import { dishHref, dishImage, dishInitials, startingPrice } from '@/lib/menu';
import type { Dish, DishImage } from '@/types/menu';
import styles from './SearchSuggestions.module.css';

export interface SearchSuggestionsProps {
  /** Run a search for this term. */
  onPick: (term: string) => void;
  /** Called when a link is followed (e.g. to close a dropdown). */
  onNavigate?: () => void;
  /** Desktop dropdown density: 2×2 trending grid. */
  compact?: boolean;
}

/** Trending photos repeat the dish name beside them, so screen readers skip them. */
const DECORATIVE = '';

/**
 * What the search screen shows before you type — the same sections on every device:
 * Trending tonight (dishes) and Popular searches. Both come from GET …/menu/suggestions (what's
 * ordered most, after staff's picks: Admin › Menu › Suggestions); placeholders until it's read,
 * and the menu's own lists (staff's picks) only if it can't be.
 */
export function SearchSuggestions({ onPick, onNavigate, compact }: SearchSuggestionsProps) {
  const { popularSearches: menuPopular, trendingTonight: menuTrending, getDish } = useMenu();
  const { data: live, isError } = useSearchSuggestions();
  // Only the server's answer is shown, so nothing is swapped in front of the guest; the menu's
  // own lists stand in only when it can't be had.
  const loading = !live && !isError;
  const popularSearches = live?.popular ?? (isError ? menuPopular : []);
  const trending = (live?.trending ?? (isError ? menuTrending : []))
    .map(getDish)
    .filter((d): d is Dish => d !== undefined);
  // The header dropdown and the /search page can both be on screen, so ids must be unique.
  const id = useId();
  const t = useContent('menu');
  const brand = useBrandName();
  const { money } = useRegion();

  if (loading) {
    return (
      <div
        className={cx(styles.root, compact && styles.compact)}
        aria-busy="true"
        aria-label={t('search.suggestions.loading')}
      >
        <section className={styles.section}>
          <Skeleton shape="line" width={140} />
          <ul className={styles.trending} aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className={styles.trend}>
                <Skeleton shape="block" width="100%" height={compact ? 120 : 170} />
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.section}>
          <Skeleton shape="line" width={180} />
          <Skeleton shape="block" width="100%" height={40} />
        </section>
      </div>
    );
  }

  return (
    <div className={cx(styles.root, compact && styles.compact)}>
      {trending.length > 0 && (
        <section className={styles.section} aria-labelledby={`${id}-trending`}>
          <h2 id={`${id}-trending`} className={styles.heading}>
            <Icon name="sparkle" size="xs" className={styles.headingIcon} />
            {t('search.suggestions.trending')}
          </h2>
          <ul className={styles.trending}>
            {trending.map((dish) => {
              // A card 150–168 px wide: the full picture (a thumbnail would blur).
              const thumb = dishImage(dish, 'card');
              return (
                <li key={dish.slug} className={styles.trend}>
                  <Link
                    href={dishHref(dish.slug)}
                    className={styles.trendLink}
                    onClick={onNavigate}
                  >
                    <span className={styles.trendImg}>
                      <TrendPhoto image={thumb} name={dish.name} />
                      <span className={styles.trendMark}>
                        <VegMark veg={dish.veg} />
                      </span>
                    </span>
                    <span className={styles.trendText}>
                      <span className={styles.trendName}>{dish.name}</span>
                      <span className={styles.trendFoot}>
                        <span className={styles.trendPrice}>
                          {money.format(startingPrice(dish))}
                        </span>
                        <span className={styles.trendGo} aria-hidden="true">
                          <Icon name="arrow" size="xs" />
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {popularSearches.length > 0 && (
        <section className={styles.section} aria-labelledby={`${id}-popular`}>
          <h2 id={`${id}-popular`} className={styles.heading}>
            <Icon name="flame" size="xs" className={styles.headingIcon} />
            {t('search.suggestions.popular', { restaurant: brand })}
          </h2>
          <div className={styles.chips}>
            {popularSearches.map((term) => (
              <Chip key={term} iconStart="search" onClick={() => onPick(term)}>
                {term}
              </Chip>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * A trending card's picture: the dish's photo, or its initials ("GN") when it has none or the
 * photo can't be loaded (a file gone from the server), never an empty or broken tile.
 */
function TrendPhoto({ image, name }: { image: DishImage | undefined; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) {
    return (
      <span className={styles.trendInitials} aria-hidden="true">
        {dishInitials(name)}
      </span>
    );
  }
  return (
    <Image
      className={styles.trendPhoto}
      src={image.src}
      alt={DECORATIVE}
      width={image.width}
      height={image.height}
      sizes="168px"
      // The first thing on the search screen: often its largest image.
      loading="eager"
      onError={() => setFailed(true)}
    />
  );
}
