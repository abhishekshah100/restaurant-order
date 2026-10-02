'use client';

import Link from 'next/link';
import { Chip, Icon, IconButton } from '@/components/ui';
import { categories, popularSearches } from '@/data/menu';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { cx } from '@/lib/cx';
import { categoryCountLabel } from '@/lib/menu';
import type { CategoryId } from '@/types/menu';
import styles from './SearchSuggestions.module.css';

export interface SearchSuggestionsProps {
  /** Run a search for this term. */
  onPick: (term: string) => void;
  /** Called when a category link is followed (e.g. to close a dropdown). */
  onNavigate?: () => void;
  /** Desktop dropdown density: arrows on recent rows, 3 category tiles. */
  compact?: boolean;
}

const COMPACT_CATEGORIES: CategoryId[] = ['starters', 'mains', 'beverages'];
const MOBILE_ORDER: CategoryId[] = [
  'starters',
  'mains',
  'breads-rice',
  'desserts',
  'beverages',
  'pizza',
];

/** Recent searches, popular searches and categories (mobile search screen, desktop dropdown). */
export function SearchSuggestions({ onPick, onNavigate, compact }: SearchSuggestionsProps) {
  const { recent, remove, clear } = useRecentSearches();
  const cats = (compact ? COMPACT_CATEGORIES : MOBILE_ORDER)
    .map((id) => categories.find((c) => c.id === id))
    .filter((c) => c !== undefined);

  return (
    <div className={cx(styles.root, compact && styles.compact)}>
      {recent.length > 0 && (
        <section className={cx(styles.section, styles.recent)} aria-labelledby="sugg-recent">
          <div className={styles.headRow}>
            <h2 id="sugg-recent" className="t-caption c3">
              Recent searches
            </h2>
            <button type="button" className={styles.clear} onClick={clear}>
              Clear
            </button>
          </div>
          <ul>
            {recent.map((term) => (
              <li key={term} className={styles.row}>
                <button type="button" className={styles.rowLink} onClick={() => onPick(term)}>
                  <Icon name="history" size="sm" />
                  <span className={styles.rowText}>{term}</span>
                  <Icon name="arrow" size="xs" className={styles.arrow} />
                </button>
                {!compact && (
                  <IconButton
                    icon="x"
                    iconSize="xs"
                    label={`Remove ${term} from recent`}
                    className="c3"
                    onClick={() => remove(term)}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section} aria-labelledby="sugg-popular">
        <h2 id="sugg-popular" className="t-caption c3">
          Popular at The Olive Table
        </h2>
        <div className={styles.chips}>
          {popularSearches.map((term) => (
            <Chip key={term} onClick={() => onPick(term)}>
              {term}
            </Chip>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sugg-cats">
        <h2 id="sugg-cats" className="t-caption c3">
          Browse by category
        </h2>
        <div className={styles.cats}>
          {cats.map((cat) => (
            <Link
              key={cat.id}
              href={`/menu/${cat.id}/`}
              className={styles.cat}
              onClick={onNavigate}
            >
              <span className={styles.catName}>{cat.name}</span>
              <span className="t-small c3">{categoryCountLabel(cat)}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
