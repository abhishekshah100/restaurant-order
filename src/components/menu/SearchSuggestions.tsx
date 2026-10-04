'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useId } from 'react';
import { Chip, Icon, VegMark, type IconName } from '@/components/ui';
import { cx } from '@/lib/cx';
import { useContent, useMenu, useRegion } from '@/api/hooks';
import { dishImage, startingPrice } from '@/lib/menu';
import type { CategoryId, Dish } from '@/types/menu';
import styles from './SearchSuggestions.module.css';

export interface SearchSuggestionsProps {
  /** Run a search for this term. */
  onPick: (term: string) => void;
  /** Called when a link is followed (e.g. to close a dropdown). */
  onNavigate?: () => void;
  /** Desktop dropdown density: 2×2 trending grid, 4-column categories. */
  compact?: boolean;
}

/** Trending photos repeat the dish name beside them, so screen readers skip them. */
const DECORATIVE = '';

/** A recognisable icon per category (from the app's icon set). */
const CATEGORY_ICON: Record<CategoryId, IconName> = {
  starters: 'flame',
  mains: 'cutlery',
  meals: 'cloche',
  pizza: 'chef',
  'breads-rice': 'leaf',
  desserts: 'heart',
  beverages: 'drop',
};

/**
 * What the search screen shows before you type — the same sections on every device:
 * Trending tonight (dishes with photos), Popular searches, Browse by category.
 */
export function SearchSuggestions({ onPick, onNavigate, compact }: SearchSuggestionsProps) {
  const { categories, popularSearches, trendingTonight, getDish, categoryCountLabel } = useMenu();
  const trending = trendingTonight.map(getDish).filter((d): d is Dish => d !== undefined);
  // The header dropdown and the /search page can both be on screen, so ids must be unique.
  const id = useId();
  const t = useContent('menu');
  const { money } = useRegion();

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
              const thumb = dishImage(dish, 'thumb');
              return (
                <li key={dish.slug} className={styles.trend}>
                  <Link
                    href={`/dish/${dish.slug}/`}
                    className={styles.trendLink}
                    onClick={onNavigate}
                  >
                    <span className={styles.trendImg}>
                      {thumb && (
                        <Image
                          className={styles.trendPhoto}
                          src={thumb.src}
                          alt={DECORATIVE}
                          width={thumb.width}
                          height={thumb.height}
                          sizes="168px"
                        />
                      )}
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

      <section className={styles.section} aria-labelledby={`${id}-popular`}>
        <h2 id={`${id}-popular`} className={styles.heading}>
          <Icon name="flame" size="xs" className={styles.headingIcon} />
          {t('search.suggestions.popular')}
        </h2>
        <div className={styles.chips}>
          {popularSearches.map((term) => (
            <Chip key={term} iconStart="search" onClick={() => onPick(term)}>
              {term}
            </Chip>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby={`${id}-cats`}>
        <h2 id={`${id}-cats`} className={styles.heading}>
          <Icon name="menu" size="xs" className={styles.headingIcon} />
          {t('search.suggestions.browse')}
        </h2>
        <ul className={styles.cats}>
          {categories.map((cat) => (
            <li key={cat.id}>
              <Link href={`/menu/${cat.id}/`} className={styles.cat} onClick={onNavigate}>
                <span className={styles.catIcon}>
                  <Icon name={CATEGORY_ICON[cat.id]} size="sm" />
                </span>
                <span className={styles.catName}>{cat.name}</span>
                <span className={styles.catCount}>{categoryCountLabel(cat)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
