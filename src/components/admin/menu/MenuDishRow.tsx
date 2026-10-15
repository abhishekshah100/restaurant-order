import Image from 'next/image';
import { useContent } from '@/api/hooks';
import { Icon, IconButton, VegMark } from '@/components/ui';
import { menuStatus, sizesOff } from '@/lib/adminMenu';
import { cx } from '@/lib/cx';
import { dishImage } from '@/lib/menu';
import type { Dish } from '@/types/menu';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { Switch } from './Switch';
import styles from './MenuDishRow.module.css';

/** The thumbnail repeats the dish name beside it, so screen readers skip it. */
const DECORATIVE = '';

/**
 * One dish for staff: its picture, name and type, sizes and prices, and whether guests can order
 * it. The switch takes it off (asking how: sold out, until when, off today) or puts it back;
 * the state opens the same choice; Edit opens the dish.
 */
export function MenuDishRow({
  dish,
  onSwitch,
  onAvailability,
  onEdit,
  reorder,
}: {
  dish: Dish;
  /** On: back on the menu at once. Off: ask how it's off. */
  onSwitch: (on: boolean) => void;
  onAvailability: () => void;
  onEdit: () => void;
  /** While reordering: move up / down instead of the switch and Edit. */
  reorder?: { first: boolean; last: boolean; onMove: (by: -1 | 1) => void };
}) {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  const status = menuStatus(dish);
  const on = status === 'available';
  const thumb = dishImage(dish, 'thumb');
  const off = sizesOff(dish);
  const { availability } = dish;
  let statusLabel = t('adminMenu.status.available');
  if (availability.status === 'sold-out') {
    statusLabel = availability.backAt
      ? t('adminMenu.status.backAt', { time: availability.backAt })
      : t('adminMenu.status.soldOut');
  }
  if (availability.status === 'unavailable-today') statusLabel = t('adminMenu.status.offToday');
  // What the dish has, so staff see it at a glance: "2 sizes · 5 choices · 3 add-ons".
  const parts = [
    ...((dish.variants?.length ?? 0) > 1
      ? [t.plural('adminMenu.meta.sizes', dish.variants?.length ?? 0)]
      : []),
    ...(dish.optionGroups?.length
      ? [t.plural('adminMenu.meta.groups', dish.optionGroups.length)]
      : []),
    ...(dish.addOns?.length ? [t.plural('adminMenu.meta.addOns', dish.addOns.length)] : []),
  ];

  return (
    <li className={cx(styles.row, !on && styles.off)}>
      <span className={styles.thumb} aria-hidden="true">
        {thumb ? (
          <Image
            className={styles.img}
            src={thumb.src}
            alt={DECORATIVE}
            width={thumb.width}
            height={thumb.height}
            sizes="56px"
          />
        ) : (
          <Icon name="cutlery" size="sm" />
        )}
      </span>

      <div className={styles.main}>
        <p className={styles.name}>
          <VegMark veg={dish.veg} />
          {dish.name}
        </p>
        <p className={styles.prices}>
          {dish.variants && dish.variants.length > 0
            ? dish.variants.map((v) => (
                <span key={v.id} className={cx(v.available === false && styles.sizeOff)}>
                  {t('adminMenu.sizePrice', { size: v.name, price: money.format(v.price) })}
                </span>
              ))
            : money.format(dish.price)}
        </p>
        {parts.length > 0 && <p className={styles.meta}>{parts.join(' · ')}</p>}
      </div>

      <button
        type="button"
        className={cx(styles.status, styles[status])}
        onClick={onAvailability}
        aria-label={t('adminMenu.changeAvailability', { dish: dish.name })}
      >
        <span className={styles.dot} aria-hidden="true" />
        {statusLabel}
        {on && off.length > 0 && (
          <span className={styles.partly}>{t.plural('adminMenu.sizesOff', off.length)}</span>
        )}
      </button>

      <div className={styles.controls}>
        {reorder ? (
          <>
            <IconButton
              icon="chevd"
              className={styles.up}
              disabled={reorder.first}
              label={t('adminMenu.editor.moveUp', { name: dish.name })}
              onClick={() => reorder.onMove(-1)}
            />
            <IconButton
              icon="chevd"
              disabled={reorder.last}
              label={t('adminMenu.editor.moveDown', { name: dish.name })}
              onClick={() => reorder.onMove(1)}
            />
          </>
        ) : (
          <>
            <Switch
              checked={on}
              onChange={onSwitch}
              label={t('adminMenu.toggle', { dish: dish.name })}
            />
            <button
              type="button"
              className={styles.edit}
              onClick={onEdit}
              aria-label={t('adminMenu.edit', { dish: dish.name })}
            >
              <Icon name="pencil" size="xs" />
            </button>
          </>
        )}
      </div>
    </li>
  );
}
