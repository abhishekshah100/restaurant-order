import type { Dish } from '@/types/menu';
import { DishRow, type DishRowProps } from './DishRow';
import styles from './DishList.module.css';

export interface DishListProps extends Omit<DishRowProps, 'dish' | 'eager'> {
  dishes: Dish[];
  label?: string;
  /** The first rows, near the top of the page: their photos load at once. */
  eagerRows?: number;
}

/** One column on mobile, two from 768px (tablet and desktop). */
export function DishList({ dishes, label, eagerRows = 0, ...rowProps }: DishListProps) {
  return (
    <ul className={styles.list} aria-label={label}>
      {dishes.map((dish, i) => (
        <DishRow key={dish.slug} dish={dish} eager={i < eagerRows} {...rowProps} />
      ))}
    </ul>
  );
}
