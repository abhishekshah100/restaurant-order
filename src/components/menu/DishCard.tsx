import Image from 'next/image';
import Link from 'next/link';
import { Tag, VegMark } from '@/components/ui';
import { formatINR } from '@/lib/format';
import { dishImage, isSpicy } from '@/lib/menu';
import type { Dish } from '@/types/menu';
import { AddControl } from './AddControl';
import styles from './DishCard.module.css';

export interface DishCardProps {
  dish: Dish;
  /** Load eagerly (above the fold). */
  priority?: boolean;
}

/** Shorter line for cards: "Wild mushrooms, truffle oil, aged parmesan". */
const SHORT_DESC: Record<string, string> = {
  'truffle-mushroom-pasta': 'Wild mushrooms, truffle oil, aged parmesan',
  'chilli-garlic-prawns': 'Burnt garlic, Kashmiri chilli butter',
  'wood-fired-margherita': 'San Marzano tomato, fior di latte, basil',
};

function CardTag({ dish }: { dish: Dish }) {
  if (dish.tags.includes('chef')) return <Tag variant="chef">Chef&apos;s pick</Tag>;
  if (dish.tags.includes('new')) return <Tag variant="new">New</Tag>;
  if (isSpicy(dish))
    return (
      <Tag variant="pop" icon="flame">
        Spicy
      </Tag>
    );
  if (dish.tags.includes('bestseller')) return <Tag variant="pop">Bestseller</Tag>;
  return null;
}

/** Chef's picks card: photo, tag, ADD, name, price. */
export function DishCard({ dish, priority }: DishCardProps) {
  const image = dishImage(dish, 'card');
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
            sizes="(min-width: 1024px) 300px, 236px"
            priority={priority}
          />
        )}
        <span className={styles.tag}>
          <CardTag dish={dish} />
        </span>
      </div>
      <AddControl dish={dish} className={styles.control} hideNote />
      <div className={styles.text}>
        <div className={styles.top}>
          <VegMark veg={dish.veg} />
          <h3 className={styles.name}>
            <Link href={`/dish/${dish.slug}/`} className={styles.link}>
              {dish.name}
            </Link>
          </h3>
        </div>
        <p className={`${styles.desc} hide-mobile`}>{SHORT_DESC[dish.slug] ?? dish.description}</p>
        <span className={styles.price}>{formatINR(dish.price)}</span>
      </div>
    </li>
  );
}
