import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import { formatINR } from '@/lib/format';
import { dishImage, highlight, isAvailable, variantSummary } from '@/lib/menu';
import type { Dish } from '@/types/menu';
import { AddControl } from './AddControl';
import { DishTags } from './DishTags';
import styles from './DishRow.module.css';

export interface DishRowProps {
  dish: Dish;
  /** Highlight these words in the name (search results). */
  query?: string;
  /** Show prep time for dishes with a photo (category view). */
  showPrepTime?: boolean;
  /** Search result layout: category instead of tag, "In cart" note. */
  searchResult?: boolean;
  /** Heading level for the dish name. */
  headingAs?: 'h3' | 'h4';
}

/** Menu list row (.item). The whole row links to the dish; ADD / stepper stays separately operable. */
export function DishRow({
  dish,
  query,
  showPrepTime,
  searchResult,
  headingAs: Heading = 'h3',
}: DishRowProps) {
  const thumb = dishImage(dish, 'thumb');
  const alt = variantSummary(dish);
  const available = isAvailable(dish);

  return (
    <li className={cx(styles.item, !available && styles.out)}>
      <div className={styles.body}>
        <DishTags dish={dish} showCategory={searchResult} />
        <Heading className={styles.name}>
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
        </Heading>
        <span className={styles.price}>
          {formatINR(dish.price)}
          {alt && <span className={styles.priceAlt}>{alt}</span>}
        </span>
        <p className={styles.desc}>{dish.description}</p>
        {showPrepTime && dish.image && dish.prepTime && (
          <span className={styles.prep}>
            <Icon name="clock" size="xs" />
            {dish.prepTime}
          </span>
        )}
      </div>
      {thumb ? (
        <div className={styles.media}>
          <Image
            className={styles.img}
            src={thumb.src}
            alt=""
            width={thumb.width}
            height={thumb.height}
            sizes="116px"
          />
          <AddControl
            dish={dish}
            className={styles.control}
            inCartNote={searchResult ? 'In cart' : undefined}
            showCustomisable={!searchResult}
          />
        </div>
      ) : (
        <div className={styles.act}>
          <AddControl
            dish={dish}
            inCartNote={searchResult ? 'In cart' : undefined}
            showCustomisable={!searchResult}
          />
        </div>
      )}
    </li>
  );
}
