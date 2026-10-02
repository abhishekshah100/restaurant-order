import type { Dish } from '@/types/menu';
import { DishRow, type DishRowProps } from './DishRow';
import styles from './DishList.module.css';

export interface DishListProps extends Omit<DishRowProps, 'dish'> {
  dishes: Dish[];
  label?: string;
}

/** One column on mobile, two from 768px (tablet and desktop). */
export function DishList({ dishes, label, ...rowProps }: DishListProps) {
  return (
    <ul className={styles.list} aria-label={label}>
      {dishes.map((dish) => (
        <DishRow key={dish.slug} dish={dish} {...rowProps} />
      ))}
    </ul>
  );
}
