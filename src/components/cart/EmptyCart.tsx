import Image from 'next/image';
import Link from 'next/link';
import { Button, EmptyState } from '@/components/ui';
import { cx } from '@/lib/cx';
import { useContent, useMenu, useRegion } from '@/api/hooks';
import { dishImage } from '@/lib/menu';
import styles from './CartView.module.css';

/** Empty cart with popular suggestions (s06 · ws06). */
export function EmptyCart() {
  const { popularAtTable, getDish } = useMenu();
  const t = useContent('cart');
  const { money } = useRegion();
  return (
    <div className={styles.emptyWrap}>
      <EmptyState
        className={styles.emptyCard}
        icon="bag"
        title={t('empty.title')}
        as="h1"
        titleClassName={styles.emptyTitle}
        actions={
          <Button href="/menu/" className={styles.emptyBtn}>
            {t('empty.browse')}
          </Button>
        }
      >
        {t('empty.body')}
      </EmptyState>
      <section className={styles.popular} aria-labelledby="popular-title">
        <h2 id="popular-title" className="t-caption c3">
          {t('empty.popular')}
        </h2>
        <div className={styles.popularGrid}>
          {popularAtTable.map((item, i) => {
            const dish = getDish(item.slug);
            const thumb = dish && dishImage(dish, 'thumb');
            if (!dish || !thumb) return null;
            return (
              <Link
                key={item.slug}
                href={`/dish/${dish.slug}/`}
                className={cx(styles.popularCard, i === 2 && styles.popularThird)}
              >
                <Image
                  src={thumb.src}
                  alt={''}
                  width={thumb.width}
                  height={thumb.height}
                  sizes="52px"
                />
                <span className={styles.popularText}>
                  <span className="t-small">
                    <b>{item.label}</b>
                  </span>
                  <span className="t-small c2">{money.format(dish.price)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
