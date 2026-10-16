import type { CSSProperties } from 'react';
import { useContent } from '@/api/hooks';
import { VegMark } from '@/components/ui';
import type { DishCount } from '@/lib/kitchenActivity';
import styles from './ActivityCharts.module.css';

/** The dishes ordered most today: a bar for each, longest first, the quantity beside it. */
export function TopDishes({ dishes }: { dishes: readonly DishCount[] }) {
  const t = useContent('kitchen');
  const max = Math.max(1, ...dishes.map((d) => d.quantity));

  return (
    <section className={styles.card} aria-labelledby="kitchen-dishes">
      <header className={styles.head}>
        <h2 id="kitchen-dishes" className={styles.title}>
          {t('activity.dishes.title')}
        </h2>
        <p className={styles.subtitle}>{t('activity.dishes.subtitle')}</p>
      </header>
      {dishes.length > 0 ? (
        <ol className={styles.rows}>
          {dishes.map((dish) => (
            <li
              key={dish.dishSlug}
              className={styles.row}
              // The bar's length is the dish's share of the most ordered one.
              style={{ '--value': `${(dish.quantity / max) * 100}%` } as CSSProperties}
              aria-label={t('activity.dishes.bar', { dish: dish.name, count: dish.quantity })}
            >
              <span className={styles.rowName} aria-hidden="true">
                <VegMark veg={dish.veg} decorative />
                {dish.name}
              </span>
              <span className={styles.track} aria-hidden="true">
                <span className={styles.fill} />
              </span>
              <span className={styles.rowValue} aria-hidden="true">
                {dish.quantity}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.empty}>{t('activity.dishes.empty')}</p>
      )}
    </section>
  );
}
