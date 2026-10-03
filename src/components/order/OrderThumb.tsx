import Image from 'next/image';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import { useMenu } from '@/api/hooks';
import { dishImage } from '@/lib/menu';
import type { Order } from '@/types/order';
import styles from './OrderThumb.module.css';

/**
 * 56px photo of the order's first dish that has one; otherwise a soft tile with the
 * first dish's initial (as in the cart). Cancelled orders show a cross tile.
 */
export function OrderThumb({ order }: { order: Order }) {
  const menu = useMenu();
  const cancelled = order.status === 'cancelled';
  const photo = cancelled
    ? undefined
    : order.items
        .map((item) => menu.getDish(item.dishSlug))
        .map((dish) => dish && dishImage(dish, 'thumb'))
        .find(Boolean);
  return (
    <span
      className={cx(styles.thumb, !photo && !cancelled && styles.initialTile)}
      aria-hidden="true"
    >
      {photo ? (
        <Image
          className={styles.img}
          src={photo.src}
          alt={''}
          width={photo.width}
          height={photo.height}
          sizes="56px"
        />
      ) : cancelled ? (
        <Icon name="xc" size="sm" />
      ) : (
        <span className={styles.initial}>{order.items[0]?.name.charAt(0)}</span>
      )}
    </span>
  );
}
